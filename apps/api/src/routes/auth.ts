import type { FastifyInstance } from 'fastify';
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@vara/shared';
import { supabaseAdmin } from '../config/supabase';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error-handler';

/**
 * Auth error codes for consistent client-side handling
 */
const AUTH_ERROR_CODES = {
  SIGNUP_FAILED: 'AUTH_SIGNUP_FAILED',
  LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  MISSING_TOKEN: 'AUTH_MISSING_TOKEN',
  MISSING_REFRESH_TOKEN: 'AUTH_MISSING_REFRESH_TOKEN',
  REFRESH_FAILED: 'AUTH_REFRESH_FAILED',
  INVALID_REQUEST: 'AUTH_INVALID_REQUEST',
  RESET_FAILED: 'AUTH_RESET_FAILED',
  RESET_TOKEN_INVALID: 'AUTH_RESET_TOKEN_INVALID',
  RESET_TOKEN_EXPIRED: 'AUTH_RESET_TOKEN_EXPIRED',
} as const;

export async function authRoutes(app: FastifyInstance) {
  // Stricter rate limit on auth routes (20 req/min) to prevent brute force
  await app.register(import('@fastify/rate-limit'), {
    max: 20,
    timeWindow: '1 minute',
  });

  // Sign up
  app.post('/signup', async (request, reply) => {
    const body = signupSchema.parse(request.body);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: false,
    });

    if (authError) {
      throw new AppError(400, AUTH_ERROR_CODES.SIGNUP_FAILED, authError.message);
    }

    // Create user profile in our database
    // If this fails, the auth middleware will create the user on first authenticated request
    try {
      const user = await prisma.user.create({
        data: {
          id: authData.user.id,
          email: body.email,
          profile: {
            create: {
              riskLevel: 'LOW',
              onboardingCompleted: false,
            },
          },
        },
        include: {
          profile: true,
        },
      });

      return reply.status(201).send({
        data: {
          id: user.id,
          email: user.email,
          profile: user.profile,
        },
      });
    } catch (dbError) {
      // Log the error for debugging but don't fail the signup
      // The auth middleware will create the user on first authenticated request
      app.log.error({ err: dbError, userId: authData.user.id }, 'Failed to create user in app database during signup');

      // Still return success since Supabase user was created
      // User will be provisioned in app DB on first authenticated request
      return reply.status(201).send({
        data: {
          id: authData.user.id,
          email: body.email,
          profile: null,
        },
      });
    }
  });

  // Login
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) {
      throw new AppError(401, AUTH_ERROR_CODES.LOGIN_FAILED, 'Invalid email or password');
    }

    const user = await prisma.user.findUnique({
      where: { id: data.user.id },
      include: { profile: true },
    });

    return reply.send({
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          emailVerified: !!data.user.email_confirmed_at,
          profile: user?.profile || null,
        },
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    });
  });

  // Logout
  app.post('/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      await supabaseAdmin.auth.admin.signOut(token);
    }

    return reply.status(204).send();
  });

  // Refresh token
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    if (!refreshToken) {
      throw new AppError(400, AUTH_ERROR_CODES.MISSING_REFRESH_TOKEN, 'Refresh token is required');
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      // Distinguish between expired and invalid refresh tokens
      const isExpired = error?.message?.toLowerCase().includes('expired');
      const errorCode = isExpired ? AUTH_ERROR_CODES.TOKEN_EXPIRED : AUTH_ERROR_CODES.REFRESH_FAILED;
      const message = isExpired ? 'Refresh token has expired' : 'Failed to refresh token';

      app.log.warn({
        error: error?.message,
        errorCode
      }, 'Token refresh failed');

      throw new AppError(401, errorCode, message, {
        requiresReauth: true,
        reason: isExpired ? 'token_expired' : 'refresh_failed',
      });
    }

    return reply.send({
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    });
  });

  // Forgot password
  app.post('/forgot-password', async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);

    await supabaseAdmin.auth.resetPasswordForEmail(body.email);

    // Always return success to prevent email enumeration
    return reply.send({
      data: { message: 'If an account exists, a reset link has been sent' },
    });
  });

  // Reset password
  // The token here is the OTP token from the password reset email link
  // Supabase reset links contain a token that must be verified with verifyOtp
  app.post('/reset-password', async (request, reply) => {
    // Validate request body with proper schema
    const body = resetPasswordSchema.parse(request.body);
    const { token, password } = body;

    // Verify the recovery token and get the user session
    // This validates that the token is legitimate and not expired
    const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    });

    if (verifyError || !verifyData.user) {
      // Distinguish between expired and invalid tokens for better client handling
      const isExpired = verifyError?.message?.toLowerCase().includes('expired');
      const errorCode = isExpired
        ? AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED
        : AUTH_ERROR_CODES.RESET_TOKEN_INVALID;
      const message = isExpired
        ? 'Password reset link has expired. Please request a new one.'
        : 'Invalid password reset link. Please request a new one.';

      app.log.warn({
        error: verifyError?.message,
        errorCode,
      }, 'Password reset token verification failed');

      throw new AppError(400, errorCode, message, {
        expired: isExpired,
      });
    }

    // Token is valid, now update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      verifyData.user.id,
      { password }
    );

    if (updateError) {
      app.log.error({
        userId: verifyData.user.id,
        error: updateError.message,
      }, 'Failed to update password after token verification');

      throw new AppError(500, AUTH_ERROR_CODES.RESET_FAILED, 'Failed to reset password. Please try again.');
    }

    app.log.info({ userId: verifyData.user.id }, 'Password reset successful');

    return reply.send({
      data: { message: 'Password reset successfully' },
    });
  });

  // Alternative reset password endpoint for clients that exchange the token for a session first
  // This is useful when the client handles the OTP verification in the frontend
  app.post('/reset-password-with-session', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, AUTH_ERROR_CODES.MISSING_TOKEN, 'Authentication required');
    }

    const accessToken = authHeader.slice(7);
    const { password } = request.body as { password: string };

    if (!password) {
      throw new AppError(400, AUTH_ERROR_CODES.INVALID_REQUEST, 'Password is required');
    }

    // Verify the access token is valid
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !userData.user) {
      const isExpired = userError?.message?.toLowerCase().includes('expired');
      throw new AppError(
        401,
        isExpired ? AUTH_ERROR_CODES.TOKEN_EXPIRED : AUTH_ERROR_CODES.INVALID_TOKEN,
        isExpired ? 'Session has expired' : 'Invalid session'
      );
    }

    // Update the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.user.id,
      { password }
    );

    if (updateError) {
      app.log.error({
        userId: userData.user.id,
        error: updateError.message,
      }, 'Failed to update password with session');

      throw new AppError(500, AUTH_ERROR_CODES.RESET_FAILED, 'Failed to reset password. Please try again.');
    }

    app.log.info({ userId: userData.user.id }, 'Password reset with session successful');

    return reply.send({
      data: { message: 'Password reset successfully' },
    });
  });
}
