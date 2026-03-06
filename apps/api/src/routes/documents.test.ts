import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

// Mock auth middleware — injects a test user into req.user
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
    folder: { findFirst: vi.fn() },
    document: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

import documentsRouter from './documents.js';
import { errorHandler } from '../middleware/errorHandler.js';
import prisma from '../lib/prisma.js';
import { uuidToBuffer } from '../lib/uid.js';

const app = express();
app.use(express.json());
app.use('/documents', documentsRouter);
app.use(errorHandler);

const mockDocumentFindFirst = vi.mocked(prisma.document.findFirst);
const mockDocumentCreate = vi.mocked(prisma.document.create);
const mockFolderFindFirst = vi.mocked(prisma.folder.findFirst);

const FOLDER_UUID = '550e8400-e29b-41d4-a716-446655440000';
const DOC_UUID = '660e8400-e29b-41d4-a716-446655440001';

const validBody = {
  fileName: 'report.pdf',
  fileSizeBytes: 1024,
  mimeType: 'application/pdf',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /documents', () => {
  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it('returns 400 for missing fileName', async () => {
    const res = await request(app)
      .post('/documents')
      .send({ fileSizeBytes: 100, mimeType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for negative fileSizeBytes', async () => {
    const res = await request(app)
      .post('/documents')
      .send({ ...validBody, fileSizeBytes: -1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty body', async () => {
    const res = await request(app).post('/documents').send({});
    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // Folder resolution
  // ---------------------------------------------------------------------------

  it('returns 400 for a malformed folderUid', async () => {
    const res = await request(app)
      .post('/documents')
      .send({ ...validBody, folderUid: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_UID');
  });

  it('returns 404 when folderUid does not exist', async () => {
    mockFolderFindFirst.mockResolvedValue(null);
    const res = await request(app)
      .post('/documents')
      .send({ ...validBody, folderUid: FOLDER_UUID });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ---------------------------------------------------------------------------
  // Root-level duplicate check
  // ---------------------------------------------------------------------------

  it('returns 409 when a document with the same name already exists at root', async () => {
    mockDocumentFindFirst.mockResolvedValue({ id: BigInt(99) } as any);
    const res = await request(app).post('/documents').send(validBody);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------

  it('returns 201 with DocumentDTO on success (root)', async () => {
    mockDocumentFindFirst.mockResolvedValue(null);
    mockDocumentCreate.mockResolvedValue({
      uid: uuidToBuffer(DOC_UUID),
      fileName: 'report.pdf',
      s3Key: 'uploads/xxx/report.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: BigInt(1024),
      status: 'ACTIVE',
      createdAt: new Date('2024-01-01'),
    } as any);

    const res = await request(app).post('/documents').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('uid', DOC_UUID);
    expect(res.body).toHaveProperty('fileName', 'report.pdf');
    expect(res.body).not.toHaveProperty('s3Key');
  });

  it('returns 201 with DocumentDTO when placed inside a folder', async () => {
    mockFolderFindFirst.mockResolvedValue({ id: BigInt(5) } as any);
    mockDocumentCreate.mockResolvedValue({
      uid: uuidToBuffer(DOC_UUID),
      fileName: 'report.pdf',
      s3Key: 'uploads/xxx/report.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: BigInt(1024),
      status: 'ACTIVE',
      createdAt: new Date('2024-01-01'),
    } as any);

    const res = await request(app)
      .post('/documents')
      .send({ ...validBody, folderUid: FOLDER_UUID });
    expect(res.status).toBe(201);
    expect(res.body.folderUid).toBe(FOLDER_UUID);
  });

  // ---------------------------------------------------------------------------
  // Prisma P2002 on create
  // ---------------------------------------------------------------------------

  it('returns 409 when Prisma raises P2002 on create', async () => {
    mockDocumentFindFirst.mockResolvedValue(null);
    const p2002 = new Prisma.PrismaClientKnownRequestError('Duplicate', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    mockDocumentCreate.mockRejectedValue(p2002);

    const res = await request(app).post('/documents').send(validBody);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});
