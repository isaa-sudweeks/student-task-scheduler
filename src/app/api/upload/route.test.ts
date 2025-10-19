import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getServerSessionMock = vi.hoisted(() => vi.fn());

const fsMocks = vi.hoisted(() => {
  const mkdirMock = vi.fn(async () => undefined);
  const writeFileMock = vi.fn(async () => undefined);
  return { mkdirMock, writeFileMock };
});

vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: { providers: [], secret: 'test-secret' },
}));

vi.mock('fs/promises', () => ({
  __esModule: true,
  mkdir: fsMocks.mkdirMock,
  writeFile: fsMocks.writeFileMock,
  default: {
    mkdir: fsMocks.mkdirMock,
    writeFile: fsMocks.writeFileMock,
  },
}));

vi.mock('node:fs/promises', () => ({
  __esModule: true,
  mkdir: fsMocks.mkdirMock,
  writeFile: fsMocks.writeFileMock,
  default: {
    mkdir: fsMocks.mkdirMock,
    writeFile: fsMocks.writeFileMock,
  },
}));

import { authOptions } from '@/app/api/auth/[...nextauth]/route';

describe('POST /api/upload', () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');

  beforeEach(() => {
    getServerSessionMock.mockReset();
    getServerSessionMock.mockResolvedValue({ user: { id: 'user-123' } });
    fsMocks.mkdirMock.mockClear();
    fsMocks.writeFileMock.mockClear();
  });

  it('rejects unauthenticated requests', async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/upload', { method: 'POST' }));

    expect(getServerSessionMock).toHaveBeenCalledWith(authOptions);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('prevents directory traversal in uploaded filenames', async () => {
    const { POST } = await import('./route');

    const file = {
      name: '../tricky.pdf',
      arrayBuffer: async () => new TextEncoder().encode('hello world').buffer,
      size: 10,
      type: 'application/pdf',
    } as unknown as File;

    const response = await POST({
      formData: async () => ({
        get: (key: string) => (key === 'file' ? file : null),
      }) as unknown as FormData,
    } as unknown as Request);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.url).toMatch(/^\/uploads\/[a-f0-9-]+-tricky\.pdf$/);

    expect(fsMocks.writeFileMock).toHaveBeenCalledTimes(1);

    const [writtenPath] = fsMocks.writeFileMock.mock.calls[0];
    const relative = path.relative(uploadDir, writtenPath as string);

    expect(relative).toMatch(/^[a-f0-9-]+-tricky\.pdf$/);
    expect(relative.startsWith('..')).toBe(false);
    expect(path.isAbsolute(relative)).toBe(false);
  });

  it('rejects unsupported file extensions', async () => {
    const { POST } = await import('./route');

    const file = {
      name: 'malware.exe',
      arrayBuffer: async () => new TextEncoder().encode('hello world').buffer,
      size: 10,
      type: 'application/pdf',
    } as unknown as File;

    const response = await POST({
      formData: async () => ({
        get: (key: string) => (key === 'file' ? file : null),
      }) as unknown as FormData,
    } as unknown as Request);

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Unsupported file type');
    expect(fsMocks.writeFileMock).not.toHaveBeenCalled();
  });
});
