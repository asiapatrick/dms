import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn((req: Request, _res: Response, next: NextFunction) => {
    req.user = {
      id: BigInt(1),
      uid: new Uint8Array(16) as Uint8Array<ArrayBuffer>,
      name: 'Alice',
    };
    next();
  }),
  JWT_SECRET: 'test-secret',
}));

vi.mock('../lib/prisma.js', () => ({
  default: {
    folder: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import itemsRouter from './items.js';
import { errorHandler } from '../middleware/errorHandler.js';
import prisma from '../lib/prisma.js';
import { uuidToBuffer } from '../lib/uid.js';

const app = express();
app.use(express.json());
app.use('/items', itemsRouter);
app.use(errorHandler);

const mockFolderFindFirst = vi.mocked(prisma.folder.findFirst);
const mockFolderFindMany = vi.mocked(prisma.folder.findMany);
const mockDocumentFindMany = vi.mocked(prisma.document.findMany);
const mockQueryRaw = vi.mocked(prisma.$queryRaw);

const FOLDER_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ITEM1_UUID = '660e8400-e29b-41d4-a716-446655440001';
const ITEM2_UUID = '770e8400-e29b-41d4-a716-446655440002';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Query validation
// ---------------------------------------------------------------------------

describe('GET /items — query validation', () => {
  it('returns 400 for invalid sortBy', async () => {
    mockFolderFindMany.mockResolvedValue([]);
    mockDocumentFindMany.mockResolvedValue([]);
    const res = await request(app).get('/items?sortBy=size');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid sortDir', async () => {
    const res = await request(app).get('/items?sortDir=random');
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed folder UID', async () => {
    const res = await request(app).get('/items?folder=not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_UID');
  });

  it('returns 404 when the folder UID does not exist', async () => {
    mockFolderFindFirst.mockResolvedValue(null);
    const res = await request(app).get(`/items?folder=${FOLDER_UUID}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Root listing
// ---------------------------------------------------------------------------

describe('GET /items — root listing', () => {
  beforeEach(() => {
    mockFolderFindMany.mockResolvedValue([
      { uid: uuidToBuffer(ITEM1_UUID), name: 'Folder A', createdAt: new Date('2024-01-01') },
    ] as any);
    mockDocumentFindMany.mockResolvedValue([
      {
        uid: uuidToBuffer(ITEM2_UUID),
        fileName: 'doc.pdf',
        fileSizeBytes: BigInt(2048),
        createdAt: new Date('2024-01-02'),
      },
    ] as any);
  });

  it('returns 200 with items and pagination', async () => {
    const res = await request(app).get('/items');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total', 2);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('totalPages');
    expect(res.body).toHaveProperty('ancestors');
  });

  it('lists folders before documents', async () => {
    const res = await request(app).get('/items');
    const items = res.body.items as Array<{ type: string; name: string }>;
    expect(items[0]?.type).toBe('folder');
    expect(items[1]?.type).toBe('document');
  });

  it('returns empty ancestors for root', async () => {
    const res = await request(app).get('/items');
    expect(res.body.ancestors).toEqual([]);
  });

  it('applies default pagination (page=1, limit=20)', async () => {
    const res = await request(app).get('/items');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Folder listing
// ---------------------------------------------------------------------------

describe('GET /items — inside a folder', () => {
  it('returns ancestors from the recursive query', async () => {
    mockFolderFindFirst.mockResolvedValue({ id: BigInt(5) } as any);
    mockFolderFindMany.mockResolvedValue([]);
    mockDocumentFindMany.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([
      { uid: FOLDER_UUID, name: 'Root' },
      { uid: ITEM1_UUID, name: 'Sub' },
    ] as any);

    const res = await request(app).get(`/items?folder=${FOLDER_UUID}`);
    expect(res.status).toBe(200);
    expect(res.body.ancestors).toHaveLength(2);
    expect(res.body.ancestors[0]).toMatchObject({ name: 'Root' });
  });
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

describe('GET /items — pagination', () => {
  it('respects page and limit query params', async () => {
    // 5 folders, no documents
    const folders = Array.from({ length: 5 }, (_, i) => ({
      uid: uuidToBuffer(`${i}60e8400-e29b-41d4-a716-44665544000${i}`),
      name: `Folder ${i}`,
      createdAt: new Date(),
    }));
    mockFolderFindMany.mockResolvedValue(folders as any);
    mockDocumentFindMany.mockResolvedValue([]);

    const res = await request(app).get('/items?page=2&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(2);
  });

  it('clamps page to totalPages when page exceeds total', async () => {
    mockFolderFindMany.mockResolvedValue([
      { uid: uuidToBuffer(ITEM1_UUID), name: 'A', createdAt: new Date() },
    ] as any);
    mockDocumentFindMany.mockResolvedValue([]);

    const res = await request(app).get('/items?page=999&limit=20');
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Server-side search (ngram FULLTEXT)
// ---------------------------------------------------------------------------

describe('GET /items — search', () => {
  it('uses $queryRaw (not findMany) when search >= 2 chars', async () => {
    // 2 raw calls at root: folder search + document search
    mockQueryRaw
      .mockResolvedValueOnce([
        { uid: uuidToBuffer(ITEM1_UUID), name: 'Report Q1', createdAt: new Date() },
      ])
      .mockResolvedValueOnce([]);

    const res = await request(app).get('/items?search=re');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Report Q1');
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(mockFolderFindMany).not.toHaveBeenCalled();
    expect(mockDocumentFindMany).not.toHaveBeenCalled();
  });

  it('matches documents as well as folders', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([]) // no folder matches
      .mockResolvedValueOnce([
        {
          uid: uuidToBuffer(ITEM2_UUID),
          fileName: 'report.pdf',
          fileSizeBytes: BigInt(1024),
          createdAt: new Date(),
        },
      ]);

    const res = await request(app).get('/items?search=report');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].type).toBe('document');
    expect(res.body.items[0].name).toBe('report.pdf');
  });

  it('returns empty result when search yields no matches', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await request(app).get('/items?search=xyznotfound');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('falls back to findMany (no raw query) when search is < 2 chars', async () => {
    mockFolderFindMany.mockResolvedValue([]);
    mockDocumentFindMany.mockResolvedValue([]);

    const res = await request(app).get('/items?search=r');
    expect(res.status).toBe(200);
    expect(mockFolderFindMany).toHaveBeenCalled();
    expect(mockDocumentFindMany).toHaveBeenCalled();
    // $queryRaw should only be called for ancestors (none at root)
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('issues 3 raw queries (folders + documents + ancestors) when searching inside a folder', async () => {
    mockFolderFindFirst.mockResolvedValue({ id: BigInt(5) } as any);
    mockQueryRaw
      .mockResolvedValueOnce([]) // folder search
      .mockResolvedValueOnce([
        {
          uid: uuidToBuffer(ITEM2_UUID),
          fileName: 'report.pdf',
          fileSizeBytes: BigInt(512),
          createdAt: new Date(),
        },
      ]) // document search
      .mockResolvedValueOnce([{ uid: FOLDER_UUID, name: 'Root' }]); // ancestors

    const res = await request(app).get(`/items?folder=${FOLDER_UUID}&search=report`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.ancestors).toHaveLength(1);
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it('still paginates search results correctly', async () => {
    // 5 matching folders returned by FULLTEXT, no documents
    const folders = Array.from({ length: 5 }, (_, i) => ({
      uid: uuidToBuffer(`${i}60e8400-e29b-41d4-a716-44665544000${i}`),
      name: `Report ${i}`,
      createdAt: new Date(),
    }));
    mockQueryRaw
      .mockResolvedValueOnce(folders)
      .mockResolvedValueOnce([]);

    const res = await request(app).get('/items?search=report&page=2&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.page).toBe(2);
  });
});
