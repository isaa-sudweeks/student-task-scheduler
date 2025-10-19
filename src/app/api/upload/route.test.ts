import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

const mocks = vi.hoisted(() => {
  const mkdirMock = vi.fn(async () => undefined);
  const writeFileMock = vi.fn(async () => undefined);
  return { mkdirMock, writeFileMock };
});

vi.mock('fs/promises', () => ({
  __esModule: true,
  mkdir: mocks.mkdirMock,
  writeFile: mocks.writeFileMock,
  default: {
    mkdir: mocks.mkdirMock,
    writeFile: mocks.writeFileMock,
  },
}));

vi.mock('node:fs/promises', () => ({
  __esModule: true,
  mkdir: mocks.mkdirMock,
  writeFile: mocks.writeFileMock,
  default: {
    mkdir: mocks.mkdirMock,
    writeFile: mocks.writeFileMock,
  },
}));

import { POST } from './route';

describe('POST /api/upload', () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');

  beforeEach(() => {
    mocks.mkdirMock.mockClear();
    mocks.writeFileMock.mockClear();
  });

  it('prevents directory traversal in uploaded filenames', async () => {
    const file = {
      name: '../tricky.pdf',
      arrayBuffer: async () => new TextEncoder().encode('hello world').buffer,
    } as unknown as File;

    const response = await POST({
      formData: async () => ({
        get: (key: string) => (key === 'file' ? file : null),
      }) as unknown as FormData,
    } as unknown as Request);

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.url).toMatch(/^\/uploads\/[a-f0-9-]+-tricky\.pdf$/);

    expect(mocks.writeFileMock).toHaveBeenCalledTimes(1);

    const [writtenPath] = mocks.writeFileMock.mock.calls[0];
    const relative = path.relative(uploadDir, writtenPath as string);

    expect(relative).toMatch(/^[a-f0-9-]+-tricky\.pdf$/);
    expect(relative.startsWith('..')).toBe(false);
    expect(path.isAbsolute(relative)).toBe(false);
  });

  it('rejects unsupported file extensions', async () => {
    const file = {
      name: 'malware.exe',
      arrayBuffer: async () => new TextEncoder().encode('hello world').buffer,
    } as unknown as File;

    const response = await POST({
      formData: async () => ({
        get: (key: string) => (key === 'file' ? file : null),
      }) as unknown as FormData,
    } as unknown as Request);

    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Unsupported file type');
    expect(mocks.writeFileMock).not.toHaveBeenCalled();
  });
});
