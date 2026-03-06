import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use a fixed API base so tests don't depend on env
vi.mock('./config', () => ({ API_BASE_URL: 'http://test-api' }));

// Re-import the module fresh for each test suite to reset module-level state
// We use dynamic imports inside tests that need a clean token state.

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

describe('login', () => {
  it('calls POST /auth/login and returns the token', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(200, { token: 'my-jwt', name: 'Alice' }),
    );
    const { login } = await import('./api');
    const token = await login();
    expect(token).toBe('my-jwt');
    expect(fetch).toHaveBeenCalledWith(
      'http://test-api/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('stores token in localStorage', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { token: 'stored-jwt', name: 'Bob' }));
    const { login } = await import('./api');
    await login();
    expect(localStorage.getItem('dms_token')).toBe('stored-jwt');
  });

  it('stores user name in localStorage', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { token: 'jwt', name: 'Carol' }));
    const { login } = await import('./api');
    await login();
    expect(localStorage.getItem('dms_user_name')).toBe('Carol');
  });

  it('throws when the server responds with an error', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(500, { error: { message: 'Demo user not initialised' } }),
    );
    const { login } = await import('./api');
    await expect(login()).rejects.toThrow('Demo user not initialised');
  });
});

// ---------------------------------------------------------------------------
// getToken / getUserName
// ---------------------------------------------------------------------------

describe('getToken', () => {
  it('returns null when no token is stored', async () => {
    const { getToken } = await import('./api');
    expect(getToken()).toBeNull();
  });

  it('returns the token from localStorage', async () => {
    localStorage.setItem('dms_token', 'from-storage');
    const { getToken } = await import('./api');
    expect(getToken()).toBe('from-storage');
  });
});

// ---------------------------------------------------------------------------
// getItems
// ---------------------------------------------------------------------------

describe('getItems', () => {
  it('calls GET /items with no query string when no params passed', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { items: [], total: 0, page: 1, limit: 20, totalPages: 1, ancestors: [] }));
    const { getItems } = await import('./api');
    await getItems();
    expect(fetch).toHaveBeenCalledWith(
      'http://test-api/items',
      expect.any(Object),
    );
  });

  it('builds correct query string from params', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { items: [], total: 0, page: 2, limit: 10, totalPages: 1, ancestors: [] }));
    const { getItems } = await import('./api');
    await getItems({ page: 2, limit: 10, sortBy: 'date', sortDir: 'desc', folder: 'abc' });
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
    expect(url).toContain('sortBy=date');
    expect(url).toContain('sortDir=desc');
    expect(url).toContain('folder=abc');
  });

  it('includes search in query string when provided', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { items: [], total: 0, page: 1, limit: 20, totalPages: 1, ancestors: [] }));
    const { getItems } = await import('./api');
    await getItems({ search: 'report' });
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toContain('search=report');
  });

  it('omits search from query string when not provided', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { items: [], total: 0, page: 1, limit: 20, totalPages: 1, ancestors: [] }));
    const { getItems } = await import('./api');
    await getItems({ page: 1 });
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).not.toContain('search');
  });

  it('throws with error message on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { error: { message: 'Unauthorized' } }));
    const { getItems } = await import('./api');
    await expect(getItems()).rejects.toThrow('Unauthorized');
  });
});

// ---------------------------------------------------------------------------
// createFolder
// ---------------------------------------------------------------------------

describe('createFolder', () => {
  it('calls POST /folders with the correct body', async () => {
    const folderDto = { uid: 'uid-1', name: 'Reports', parentFolderUid: null, status: 'ACTIVE', createdAt: '2024-01-01' };
    vi.stubGlobal('fetch', mockFetch(201, folderDto));
    const { createFolder } = await import('./api');
    const result = await createFolder({ name: 'Reports' });
    expect(result).toEqual(folderDto);
    expect(fetch).toHaveBeenCalledWith(
      'http://test-api/folders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Reports' }),
      }),
    );
  });

  it('throws on conflict (409)', async () => {
    vi.stubGlobal('fetch', mockFetch(409, { error: { message: 'A folder with that name already exists here' } }));
    const { createFolder } = await import('./api');
    await expect(createFolder({ name: 'Dup' })).rejects.toThrow('A folder with that name already exists here');
  });
});

// ---------------------------------------------------------------------------
// createDocument
// ---------------------------------------------------------------------------

describe('createDocument', () => {
  it('calls POST /documents with the correct body', async () => {
    const docDto = { uid: 'doc-1', fileName: 'file.pdf', mimeType: 'application/pdf', fileSizeBytes: '1024', folderUid: null, status: 'ACTIVE', createdAt: '2024-01-01' };
    vi.stubGlobal('fetch', mockFetch(201, docDto));
    const { createDocument } = await import('./api');
    const body = { fileName: 'file.pdf', fileSizeBytes: 1024, mimeType: 'application/pdf' };
    const result = await createDocument(body);
    expect(result).toEqual(docDto);
    expect(fetch).toHaveBeenCalledWith(
      'http://test-api/documents',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
  });

  it('throws on validation error (400)', async () => {
    vi.stubGlobal('fetch', mockFetch(400, { error: { message: 'Invalid request body' } }));
    const { createDocument } = await import('./api');
    await expect(
      createDocument({ fileName: '', fileSizeBytes: 0, mimeType: '' }),
    ).rejects.toThrow('Invalid request body');
  });
});
