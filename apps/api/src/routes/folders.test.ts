import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn((req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      id: BigInt(1),
      uid: new Uint8Array(16) as Uint8Array<ArrayBuffer>,
      name: 'Test User',
    };
    next();
  }),
  JWT_SECRET: 'test-secret',
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    folder: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import foldersRouter from './folders.js';
import { errorHandler } from '../middleware/errorHandler.js';
import prisma from '../lib/prisma.js';
import { uuidToBuffer } from '../lib/uid.js';

const app = express();
app.use(express.json());
app.use('/folders', foldersRouter);
app.use(errorHandler);

const mockFolderFindFirst = vi.mocked(prisma.folder.findFirst);
const mockFolderCreate = vi.mocked(prisma.folder.create);

const PARENT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const NEW_FOLDER_UUID = '660e8400-e29b-41d4-a716-446655440001';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /folders', () => {
  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it('returns 400 for missing name', async () => {
    const res = await request(app).post('/folders').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for empty name', async () => {
    const res = await request(app).post('/folders').send({ name: '' });
    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // Parent folder resolution
  // ---------------------------------------------------------------------------

  it('returns 400 for a malformed parentFolderUid', async () => {
    const res = await request(app)
      .post('/folders')
      .send({ name: 'Sub', parentFolderUid: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_UID');
  });

  it('returns 404 when parentFolderUid does not exist', async () => {
    mockFolderFindFirst.mockResolvedValue(null);
    const res = await request(app)
      .post('/folders')
      .send({ name: 'Sub', parentFolderUid: PARENT_UUID });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ---------------------------------------------------------------------------
  // Root-level duplicate check
  // ---------------------------------------------------------------------------

  it('returns 409 when a folder with the same name already exists at root', async () => {
    mockFolderFindFirst.mockResolvedValue({ id: BigInt(99) } as any);
    const res = await request(app).post('/folders').send({ name: 'Reports' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------

  it('returns 201 with FolderDTO on success (root)', async () => {
    mockFolderFindFirst.mockResolvedValue(null);
    mockFolderCreate.mockResolvedValue({
      uid: uuidToBuffer(NEW_FOLDER_UUID),
      name: 'Reports',
      status: 'ACTIVE',
      createdAt: new Date('2024-01-01'),
    } as any);

    const res = await request(app).post('/folders').send({ name: 'Reports' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('uid', NEW_FOLDER_UUID);
    expect(res.body).toHaveProperty('name', 'Reports');
    expect(res.body.parentFolderUid).toBeNull();
  });

  it('returns 201 with parentFolderUid set when creating a subfolder', async () => {
    // First findFirst: resolves parent; findFirst for duplicate check is not called (inside folder)
    mockFolderFindFirst.mockResolvedValue({ id: BigInt(5) } as any);
    mockFolderCreate.mockResolvedValue({
      uid: uuidToBuffer(NEW_FOLDER_UUID),
      name: 'Sub',
      status: 'ACTIVE',
      createdAt: new Date('2024-01-01'),
    } as any);

    const res = await request(app)
      .post('/folders')
      .send({ name: 'Sub', parentFolderUid: PARENT_UUID });
    expect(res.status).toBe(201);
    expect(res.body.parentFolderUid).toBe(PARENT_UUID);
  });

  // ---------------------------------------------------------------------------
  // Prisma P2002 on create
  // ---------------------------------------------------------------------------

  it('returns 409 when Prisma raises P2002 on create', async () => {
    mockFolderFindFirst.mockResolvedValue(null);
    const p2002 = new Prisma.PrismaClientKnownRequestError('Duplicate', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    mockFolderCreate.mockRejectedValue(p2002);

    const res = await request(app).post('/folders').send({ name: 'Reports' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});
