import { describe, it, expect } from 'vitest';
import { bufferToUuid, uuidToBuffer } from './uid.js';

const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('uuidToBuffer', () => {
  it('returns a 16-byte Uint8Array', () => {
    const buf = uuidToBuffer(SAMPLE_UUID);
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.byteLength).toBe(16);
  });

  it('throws on a string that is too short', () => {
    expect(() => uuidToBuffer('not-a-uuid')).toThrow('Invalid UUID');
  });

  it('throws on an empty string', () => {
    expect(() => uuidToBuffer('')).toThrow('Invalid UUID');
  });

  it('throws when hex length is not 32 after stripping dashes', () => {
    expect(() => uuidToBuffer('550e8400-e29b-41d4-a716')).toThrow('Invalid UUID');
  });
});

describe('bufferToUuid', () => {
  it('round-trips: uuidToBuffer → bufferToUuid returns the original UUID', () => {
    const buf = uuidToBuffer(SAMPLE_UUID);
    expect(bufferToUuid(buf)).toBe(SAMPLE_UUID);
  });

  it('round-trips with a nil UUID (all zeros)', () => {
    const nilUuid = '00000000-0000-0000-0000-000000000000';
    const buf = uuidToBuffer(nilUuid);
    expect(bufferToUuid(buf)).toBe(nilUuid);
  });

  it('round-trips with a max UUID (all f)', () => {
    const maxUuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const buf = uuidToBuffer(maxUuid);
    expect(bufferToUuid(buf)).toBe(maxUuid);
  });

  it('produces a correctly formatted UUID string (8-4-4-4-12)', () => {
    const result = bufferToUuid(uuidToBuffer(SAMPLE_UUID));
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
