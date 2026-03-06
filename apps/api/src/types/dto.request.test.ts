import { describe, it, expect } from 'vitest';
import {
  createFolderSchema,
  createDocumentSchema,
  listItemsQuerySchema,
} from './dto.request.js';

// ---------------------------------------------------------------------------
// createFolderSchema
// ---------------------------------------------------------------------------

describe('createFolderSchema', () => {
  it('accepts a valid name', () => {
    const result = createFolderSchema.safeParse({ name: 'Reports' });
    expect(result.success).toBe(true);
  });

  it('accepts name with optional parentFolderUid', () => {
    const result = createFolderSchema.safeParse({
      name: 'Sub',
      parentFolderUid: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
    expect(result.data?.parentFolderUid).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('accepts null parentFolderUid', () => {
    const result = createFolderSchema.safeParse({ name: 'Root', parentFolderUid: null });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createFolderSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = createFolderSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createDocumentSchema
// ---------------------------------------------------------------------------

describe('createDocumentSchema', () => {
  const valid = {
    fileName: 'report.pdf',
    fileSizeBytes: 1024,
    mimeType: 'application/pdf',
  };

  it('accepts a fully valid body', () => {
    const result = createDocumentSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts zero fileSizeBytes', () => {
    const result = createDocumentSchema.safeParse({ ...valid, fileSizeBytes: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts an optional folderUid', () => {
    const result = createDocumentSchema.safeParse({
      ...valid,
      folderUid: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty fileName', () => {
    const result = createDocumentSchema.safeParse({ ...valid, fileName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects negative fileSizeBytes', () => {
    const result = createDocumentSchema.safeParse({ ...valid, fileSizeBytes: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer fileSizeBytes', () => {
    const result = createDocumentSchema.safeParse({ ...valid, fileSizeBytes: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects empty mimeType', () => {
    const result = createDocumentSchema.safeParse({ ...valid, mimeType: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(createDocumentSchema.safeParse({}).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// listItemsQuerySchema
// ---------------------------------------------------------------------------

describe('listItemsQuerySchema', () => {
  it('applies defaults when no params provided', () => {
    const result = listItemsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ page: 1, limit: 20, sortBy: 'name', sortDir: 'asc' });
  });

  it('coerces string numbers for page and limit', () => {
    const result = listItemsQuerySchema.safeParse({ page: '3', limit: '50' });
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(3);
    expect(result.data?.limit).toBe(50);
  });

  it('accepts valid sortBy values', () => {
    expect(listItemsQuerySchema.safeParse({ sortBy: 'name' }).success).toBe(true);
    expect(listItemsQuerySchema.safeParse({ sortBy: 'date' }).success).toBe(true);
  });

  it('accepts valid sortDir values', () => {
    expect(listItemsQuerySchema.safeParse({ sortDir: 'asc' }).success).toBe(true);
    expect(listItemsQuerySchema.safeParse({ sortDir: 'desc' }).success).toBe(true);
  });

  it('rejects invalid sortBy', () => {
    const result = listItemsQuerySchema.safeParse({ sortBy: 'size' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sortDir', () => {
    const result = listItemsQuerySchema.safeParse({ sortDir: 'random' });
    expect(result.success).toBe(false);
  });

  it('rejects limit above 100', () => {
    const result = listItemsQuerySchema.safeParse({ limit: '101' });
    expect(result.success).toBe(false);
  });

  it('rejects page of 0', () => {
    const result = listItemsQuerySchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('passes through optional folder param', () => {
    const uid = '550e8400-e29b-41d4-a716-446655440000';
    const result = listItemsQuerySchema.safeParse({ folder: uid });
    expect(result.success).toBe(true);
    expect(result.data?.folder).toBe(uid);
  });
});
