import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import logger from '../lib/logger.js';

const isDev = process.env['NODE_ENV'] !== 'production';

const prismaMessages: Record<string, string> = {
  P2002: 'An item with that name already exists here',
  P2025: 'The requested record was not found',
  P2003: 'Operation failed due to a reference constraint',
  P2014: 'The change would violate a required relation',
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Prisma known errors — always return a meaningful message
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const message = prismaMessages[err.code] ?? 'Database error';
    res.status(err.code === 'P2025' ? 404 : 409).json({
      error: {
        code: err.code,
        message,
        ...(isDev && { meta: err.meta }),
      },
    });
    return;
  }

  // Prisma validation errors (bad query shape, etc.)
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      error: {
        code: 'DB_VALIDATION_ERROR',
        message: 'Invalid database operation',
        ...(isDev && { detail: err.message }),
      },
    });
    return;
  }

  // All other errors
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      ...(isDev && { detail: err instanceof Error ? err.message : String(err) }),
    },
  });
};
