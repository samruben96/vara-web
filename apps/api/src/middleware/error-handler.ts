import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { env } from '../config/env';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error(error);

  // Handle AppError
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    } satisfies ApiErrorResponse);
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.errors,
      },
    } satisfies ApiErrorResponse);
  }

  // Handle Fastify errors
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code || 'REQUEST_ERROR',
        message: error.message,
      },
    } satisfies ApiErrorResponse);
  }

  // Handle unknown errors
  const isDev = env.NODE_ENV === 'development';
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? error.message : 'An unexpected error occurred',
      details: isDev ? error.stack : undefined,
    },
  } satisfies ApiErrorResponse);
}
