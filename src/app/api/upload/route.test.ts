import { describe, it, expect, vi, beforeEach } from 'vitest';

const getServerSessionMock = vi.hoisted(() => vi.fn());

vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: { providers: [], secret: 'test-secret' },
}));

import { authOptions } from '@/app/api/auth/[...nextauth]/route';

describe('POST /api/upload', () => {
  beforeEach(() => {
    getServerSessionMock.mockReset();
  });

  it('rejects unauthenticated requests', async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/upload', { method: 'POST' }));

    expect(getServerSessionMock).toHaveBeenCalledWith(authOptions);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });
});
