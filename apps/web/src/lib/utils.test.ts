import { describe, it, expect } from 'vitest';
import {
  generateUuid,
  formatDate,
  formatFileSize,
  paginate,
  totalPages,
  guessMimeType,
} from './utils';

// ---------------------------------------------------------------------------
// generateUuid
// ---------------------------------------------------------------------------

describe('generateUuid', () => {
  it('returns a string matching UUID v4 format', () => {
    const uuid = generateUuid();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('returns a different value each call', () => {
    expect(generateUuid()).not.toBe(generateUuid());
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('formats an ISO date string as DD Mon YYYY', () => {
    const result = formatDate('2024-06-01T00:00:00.000Z');
    // en-GB locale: "01 Jun 2024"
    expect(result).toMatch(/\d{2} \w{3} \d{4}/);
  });

  it('includes the correct year', () => {
    expect(formatDate('2023-12-25T00:00:00.000Z')).toContain('2023');
  });
});

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

describe('formatFileSize', () => {
  it('returns "-" for undefined', () => {
    expect(formatFileSize(undefined)).toBe('-');
  });

  it('returns "-" for null', () => {
    expect(formatFileSize(null as any)).toBe('-');
  });

  it('returns "-" for a non-numeric string', () => {
    expect(formatFileSize('abc')).toBe('-');
  });

  it('returns "0 B" for 0', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('returns bytes label for values under 1 KB', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('returns KB label for values 1 KB – 1 MB', () => {
    expect(formatFileSize(2048)).toBe('2 KB');
  });

  it('returns MB label for values >= 1 MB', () => {
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  it('accepts a numeric string', () => {
    expect(formatFileSize('1024')).toBe('1 KB');
  });
});

// ---------------------------------------------------------------------------
// paginate
// ---------------------------------------------------------------------------

describe('paginate', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('returns the first page', () => {
    expect(paginate(items, 1, 3)).toEqual([1, 2, 3]);
  });

  it('returns the second page', () => {
    expect(paginate(items, 2, 3)).toEqual([4, 5, 6]);
  });

  it('returns a partial last page', () => {
    expect(paginate(items, 4, 3)).toEqual([10]);
  });

  it('returns an empty array when page is out of range', () => {
    expect(paginate(items, 5, 3)).toEqual([]);
  });

  it('returns all items when perPage >= total', () => {
    expect(paginate(items, 1, 100)).toEqual(items);
  });
});

// ---------------------------------------------------------------------------
// totalPages
// ---------------------------------------------------------------------------

describe('totalPages', () => {
  it('returns 1 for 0 items', () => {
    expect(totalPages(0, 20)).toBe(1);
  });

  it('returns 1 when all items fit on one page', () => {
    expect(totalPages(10, 20)).toBe(1);
  });

  it('returns the correct number of pages', () => {
    expect(totalPages(21, 20)).toBe(2);
    expect(totalPages(40, 20)).toBe(2);
    expect(totalPages(41, 20)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// guessMimeType
// ---------------------------------------------------------------------------

describe('guessMimeType', () => {
  it.each([
    ['report.pdf', 'application/pdf'],
    ['document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['spreadsheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['image.png', 'image/png'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
    ['data.csv', 'text/csv'],
    ['notes.txt', 'text/plain'],
    ['archive.zip', 'application/zip'],
  ])('returns correct MIME type for %s', (fileName, expected) => {
    expect(guessMimeType(fileName)).toBe(expected);
  });

  it('returns application/octet-stream for unknown extensions', () => {
    expect(guessMimeType('file.xyz')).toBe('application/octet-stream');
  });

  it('returns application/octet-stream for files without extensions', () => {
    expect(guessMimeType('Makefile')).toBe('application/octet-stream');
  });

  it('is case-insensitive for the extension', () => {
    expect(guessMimeType('IMAGE.PNG')).toBe('image/png');
  });
});
