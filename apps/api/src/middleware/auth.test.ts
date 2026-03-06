import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mock prisma before importing the middleware
vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { requireAuth, JWT_SECRET } from './auth.js';
import prisma from '../lib/prisma.js';
import { uuidToBuffer } from '../lib/uid.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

function makeReqWithToken(token: string): Request {
  return { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
}

function makeRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json } as unknown as Response, status, json };
}

function signToken(sub: string) {
  return jwt.sign({ sub }, JWT_SECRET, { expiresIn: '1h' });
}

const mockFindUnique = vi.mocked(prisma.user.findUnique);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Missing / malformed header
// ---------------------------------------------------------------------------

describe('requireAuth — missing/malformed header', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const req = { headers: {} } as unknown as Request;
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireAuth(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization does not start with Bearer', async () => {
    const req = { headers: { authorization: 'Basic abc' } } as unknown as Request;
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireAuth(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
  });
});

// ---------------------------------------------------------------------------
// Invalid JWT
// ---------------------------------------------------------------------------

describe('requireAuth — invalid JWT', () => {
  it('returns 401 for a malformed token', async () => {
    const req = makeReqWithToken('not.a.jwt');
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireAuth(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    const token = jwt.sign({ sub: VALID_UUID }, 'wrong-secret');
    const req = makeReqWithToken(token);
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireAuth(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for a token without a string sub', async () => {
    const token = jwt.sign({ sub: 12345 }, JWT_SECRET);
    const req = makeReqWithToken(token);
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireAuth(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for a token with a non-UUID sub', async () => {
    const token = signToken('not-a-uuid-at-all');
    const req = makeReqWithToken(token);
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireAuth(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
  });
});

// ---------------------------------------------------------------------------
// User lookup failures
// ---------------------------------------------------------------------------

describe('requireAuth — user lookup', () => {
  it('returns 401 when user is not found in DB', async () => {
    mockFindUnique.mockResolvedValue(null);
    const token = signToken(VALID_UUID);
    const req = makeReqWithToken(token);
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireAuth(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when user status is INACTIVE', async () => {
    mockFindUnique.mockResolvedValue({
      id: BigInt(1),
      uid: uuidToBuffer(VALID_UUID),
      name: 'Test User',
      status: 'INACTIVE',
    });
    const token = signToken(VALID_UUID);
    const req = makeReqWithToken(token);
    const { res, status } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireAuth(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
  });
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe('requireAuth — success', () => {
  it('calls next() and sets req.user when token and user are valid', async () => {
    const uidBuf = uuidToBuffer(VALID_UUID);
    mockFindUnique.mockResolvedValue({
      id: BigInt(1),
      uid: uidBuf,
      name: 'Alice',
      status: 'ACTIVE',
    });
    const token = signToken(VALID_UUID);
    const req = makeReqWithToken(token) as Request & { user?: unknown };
    const { res } = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ name: 'Alice' });
  });
});
