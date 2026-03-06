import { describe, it, expect } from 'vitest';
import { toFolderDTO, toDocumentInternal, toDocumentDTO, toItemDTO } from './mappers.js';
import { uuidToBuffer, bufferToUuid } from './uid.js';

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_BUF = uuidToBuffer(TEST_UUID);
const CREATED_AT = new Date('2024-06-01T10:00:00.000Z');

// ---------------------------------------------------------------------------
// toFolderDTO
// ---------------------------------------------------------------------------

describe('toFolderDTO', () => {
  it('maps all fields correctly', () => {
    const row = { uid: TEST_BUF, name: 'Reports', status: 'ACTIVE', createdAt: CREATED_AT };
    const result = toFolderDTO(row, 'parent-uid-string');
    expect(result).toEqual({
      uid: TEST_UUID,
      name: 'Reports',
      parentFolderUid: 'parent-uid-string',
      status: 'ACTIVE',
      createdAt: '2024-06-01T10:00:00.000Z',
    });
  });

  it('passes null parentFolderUid through', () => {
    const row = { uid: TEST_BUF, name: 'Root Folder', status: 'ACTIVE', createdAt: CREATED_AT };
    expect(toFolderDTO(row, null).parentFolderUid).toBeNull();
  });

  it('converts createdAt Date to ISO string', () => {
    const row = { uid: TEST_BUF, name: 'X', status: 'ACTIVE', createdAt: CREATED_AT };
    expect(toFolderDTO(row, null).createdAt).toBe('2024-06-01T10:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// toDocumentInternal
// ---------------------------------------------------------------------------

describe('toDocumentInternal', () => {
  const row = {
    uid: TEST_BUF,
    fileName: 'report.pdf',
    s3Key: 'uploads/owner/report.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: BigInt(2048),
    status: 'ACTIVE',
    createdAt: CREATED_AT,
  };

  it('maps all fields correctly', () => {
    const result = toDocumentInternal(row, 'folder-uid');
    expect(result).toEqual({
      uid: TEST_UUID,
      fileName: 'report.pdf',
      s3Key: 'uploads/owner/report.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: '2048',
      folderUid: 'folder-uid',
      status: 'ACTIVE',
      createdAt: '2024-06-01T10:00:00.000Z',
    });
  });

  it('serialises BigInt fileSizeBytes as a decimal string', () => {
    const result = toDocumentInternal(row, null);
    expect(typeof result.fileSizeBytes).toBe('string');
    expect(result.fileSizeBytes).toBe('2048');
  });

  it('passes null folderUid through', () => {
    expect(toDocumentInternal(row, null).folderUid).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// toDocumentDTO
// ---------------------------------------------------------------------------

describe('toDocumentDTO', () => {
  it('strips s3Key from the internal object', () => {
    const internal = {
      uid: TEST_UUID,
      fileName: 'report.pdf',
      s3Key: 'uploads/owner/report.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: '2048',
      folderUid: null,
      status: 'ACTIVE' as const,
      createdAt: '2024-06-01T10:00:00.000Z',
    };
    const dto = toDocumentDTO(internal);
    expect(dto).not.toHaveProperty('s3Key');
  });

  it('retains all non-sensitive fields', () => {
    const internal = {
      uid: TEST_UUID,
      fileName: 'report.pdf',
      s3Key: 'uploads/owner/report.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: '2048',
      folderUid: 'folder-uid',
      status: 'ACTIVE' as const,
      createdAt: '2024-06-01T10:00:00.000Z',
    };
    const dto = toDocumentDTO(internal);
    expect(dto.uid).toBe(TEST_UUID);
    expect(dto.fileName).toBe('report.pdf');
    expect(dto.fileSizeBytes).toBe('2048');
    expect(dto.folderUid).toBe('folder-uid');
  });
});

// ---------------------------------------------------------------------------
// toItemDTO
// ---------------------------------------------------------------------------

describe('toItemDTO', () => {
  it('maps a folder row to ItemDTO', () => {
    const row = { uid: TEST_BUF, createdAt: CREATED_AT };
    const result = toItemDTO(row, 'My Folder', 'folder', 'Alice');
    expect(result).toEqual({
      uid: TEST_UUID,
      name: 'My Folder',
      type: 'folder',
      createdAt: '2024-06-01T10:00:00.000Z',
      createdBy: 'Alice',
    });
    expect(result).not.toHaveProperty('fileSizeBytes');
  });

  it('maps a document row to ItemDTO including fileSizeBytes', () => {
    const row = { uid: TEST_BUF, createdAt: CREATED_AT, fileSizeBytes: BigInt(512) };
    const result = toItemDTO(row, 'doc.pdf', 'document', 'Bob');
    expect(result.type).toBe('document');
    expect(result.fileSizeBytes).toBe('512');
  });

  it('omits fileSizeBytes when undefined (folder rows)', () => {
    const row = { uid: TEST_BUF, createdAt: CREATED_AT };
    expect(toItemDTO(row, 'Folder', 'folder', 'Alice')).not.toHaveProperty('fileSizeBytes');
  });
});
