import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { errorHandler } from './errorHandler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json } as unknown as Response, status, json };
}

const req = {} as Request;
const next = vi.fn() as unknown as NextFunction;

beforeEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// PrismaClientKnownRequestError
// ---------------------------------------------------------------------------

describe('errorHandler — PrismaClientKnownRequestError', () => {
  it('returns 404 for P2025 (record not found)', () => {
    const { res, status, json } = makeRes();
    const err = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });
    errorHandler(err, req, res, next);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'P2025' }) }),
    );
  });

  it('returns 409 for P2002 (unique constraint)', () => {
    const { res, status, json } = makeRes();
    const err = new Prisma.PrismaClientKnownRequestError('Duplicate', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    errorHandler(err, req, res, next);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'P2002' }) }),
    );
  });

  it('returns 409 for P2003 (foreign key constraint)', () => {
    const { res, status } = makeRes();
    const err = new Prisma.PrismaClientKnownRequestError('FK violation', {
      code: 'P2003',
      clientVersion: '5.0.0',
    });
    errorHandler(err, req, res, next);
    expect(status).toHaveBeenCalledWith(409);
  });

  it('returns 409 with "Database error" for unknown Prisma error codes', () => {
    const { res, status, json } = makeRes();
    const err = new Prisma.PrismaClientKnownRequestError('Unknown', {
      code: 'P9999',
      clientVersion: '5.0.0',
    });
    errorHandler(err, req, res, next);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Database error' }),
      }),
    );
  });

  describe('dev/prod meta visibility', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('includes meta in dev environment', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const { errorHandler: eh } = await import('./errorHandler.js');
      const { res, json } = makeRes();
      const err = new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['name'] },
      });
      eh(err, req, res, next);
      const body = json.mock.calls[0]?.[0] as { error: { meta?: unknown } };
      expect(body.error).toHaveProperty('meta');
    });

    it('omits meta in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { errorHandler: eh } = await import('./errorHandler.js');
      const { res, json } = makeRes();
      const err = new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['name'] },
      });
      eh(err, req, res, next);
      const body = json.mock.calls[0]?.[0] as { error: { meta?: unknown } };
      expect(body.error).not.toHaveProperty('meta');
    });
  });
});

// ---------------------------------------------------------------------------
// PrismaClientValidationError
// ---------------------------------------------------------------------------

describe('errorHandler — PrismaClientValidationError', () => {
  it('returns 400 with DB_VALIDATION_ERROR code', () => {
    const { res, status, json } = makeRes();
    const err = new Prisma.PrismaClientValidationError('Bad query', {
      clientVersion: '5.0.0',
    });
    errorHandler(err, req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'DB_VALIDATION_ERROR' }),
      }),
    );
  });

  describe('dev/prod detail visibility', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('omits detail in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { errorHandler: eh } = await import('./errorHandler.js');
      const { res, json } = makeRes();
      const err = new Prisma.PrismaClientValidationError('Bad query', {
        clientVersion: '5.0.0',
      });
      eh(err, req, res, next);
      const body = json.mock.calls[0]?.[0] as { error: { detail?: unknown } };
      expect(body.error).not.toHaveProperty('detail');
    });
  });
});

// ---------------------------------------------------------------------------
// Unknown / generic errors
// ---------------------------------------------------------------------------

describe('errorHandler — unknown errors', () => {
  it('returns 500 for a plain Error', () => {
    const { res, status, json } = makeRes();
    errorHandler(new Error('Something broke'), req, res, next);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL_SERVER_ERROR' }),
      }),
    );
  });

  it('returns 500 for a thrown string', () => {
    const { res, status } = makeRes();
    errorHandler('raw string error', req, res, next);
    expect(status).toHaveBeenCalledWith(500);
  });

  describe('dev/prod detail visibility', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('omits detail in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { errorHandler: eh } = await import('./errorHandler.js');
      const { res, json } = makeRes();
      eh(new Error('secret detail'), req, res, next);
      const body = json.mock.calls[0]?.[0] as { error: { detail?: unknown } };
      expect(body.error).not.toHaveProperty('detail');
    });

    it('includes detail in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const { errorHandler: eh } = await import('./errorHandler.js');
      const { res, json } = makeRes();
      eh(new Error('visible detail'), req, res, next);
      const body = json.mock.calls[0]?.[0] as { error: { detail?: unknown } };
      expect(body.error).toHaveProperty('detail', 'visible detail');
    });
  });
});
