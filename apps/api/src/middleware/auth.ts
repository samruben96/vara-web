import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabaseAdmin } from '../config/supabase';
import { prisma } from '../config/prisma';
import { AppError } from './error-handler';

/**
 * Auth error codes - must match the codes in routes/auth.ts
 */
const AUTH_ERROR_CODES = {
  MISSING_TOKEN: 'AUTH_MISSING_TOKEN',
  INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
} as const;

export interface AuthUser {
  id: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Ensures a user exists in the application database.
 * Creates the user and profile if they don't exist (just-in-time provisioning).
 * This handles cases where:
 * - OAuth/social login bypasses the signup endpoint
 * - Signup endpoint succeeded in Supabase but failed to create app DB records
 */
async function ensureUserExists(userId: string, email: string): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (existingUser) {
    return;
  }

  // User doesn't exist in app DB - create them with profile
  await prisma.user.create({
    data: {
      id: userId,
      email: email,
      profile: {
        create: {
          riskLevel: 'LOW',
          onboardingCompleted: false,
        },
      },
    },
  });
}

/**
 * Determines if a Supabase auth error indicates an expired token
 */
function isTokenExpiredError(error: { message?: string; status?: number } | null): boolean {
  if (!error) return false;

  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('expired') ||
    message.includes('token has expired') ||
    message.includes('jwt expired')
  );
}

/**
 * Extracts token expiry time from a JWT token (if decodable)
 * Returns null if the token cannot be decoded
 */
function getTokenExpiryFromJwt(token: string): number | null {
  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode the payload (base64url)
    const payload = parts[1];
    if (!payload) return null;

    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as { exp?: number };

    return parsed.exp ? parsed.exp * 1000 : null; // Convert to milliseconds
  } catch {
    return null;
  }
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    request.log.debug('Auth failed: missing or malformed authorization header');
    throw new AppError(401, AUTH_ERROR_CODES.MISSING_TOKEN, 'Authentication required');
  }

  const token = authHeader.slice(7);

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      const isExpired = isTokenExpiredError(error);
      const tokenExpiry = getTokenExpiryFromJwt(token);

      // Log detailed information for debugging
      request.log.warn({
        errorType: isExpired ? 'token_expired' : 'token_invalid',
        errorMessage: error?.message,
        tokenExpiry: tokenExpiry ? new Date(tokenExpiry).toISOString() : null,
        currentTime: new Date().toISOString(),
      }, `Auth failed: ${isExpired ? 'token expired' : 'invalid token'}`);

      if (isExpired) {
        throw new AppError(401, AUTH_ERROR_CODES.TOKEN_EXPIRED, 'Token has expired', {
          expired: true,
          expiredAt: tokenExpiry ? new Date(tokenExpiry).toISOString() : null,
          requiresRefresh: true,
        });
      }

      throw new AppError(401, AUTH_ERROR_CODES.INVALID_TOKEN, 'Invalid authentication token', {
        expired: false,
        requiresReauth: true,
      });
    }

    const supabaseUser = data.user;

    // Ensure user exists in application database (just-in-time provisioning)
    await ensureUserExists(supabaseUser.id, supabaseUser.email!);

    request.user = {
      id: supabaseUser.id,
      email: supabaseUser.email!,
    };

    request.log.debug({ userId: supabaseUser.id }, 'Auth successful');
  } catch (err) {
    if (err instanceof AppError) throw err;

    // Unexpected error during auth - log and return generic error
    request.log.error({ err }, 'Unexpected error during authentication');
    throw new AppError(401, AUTH_ERROR_CODES.INVALID_TOKEN, 'Authentication failed');
  }
}
