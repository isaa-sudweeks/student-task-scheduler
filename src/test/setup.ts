import { afterAll, afterEach, beforeAll, vi } from 'vitest';

process.env.TZ = 'UTC';
process.env.DATABASE_URL ??= 'postgres://localhost:5432/test';
process.env.NEXTAUTH_SECRET ??= 'ValidSecretKey123!ValidSecretKey123!';
process.env.NEXTAUTH_URL ??= 'http://localhost:3000';
process.env.GOOGLE_CLIENT_ID ??= 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET ??= 'test-google-client-secret';

vi.mock('@prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = 'PrismaClientKnownRequestError';
    }
  }
  return {
    TaskPriority: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
    RecurrenceType: { NONE: 'NONE', DAILY: 'DAILY', WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY' },
    LlmProvider: { NONE: 'NONE', OPENAI: 'OPENAI', LM_STUDIO: 'LM_STUDIO' },
    GoalType: { SUBJECT: 'SUBJECT', COURSE: 'COURSE' },
    Prisma: { PrismaClientKnownRequestError },
  } as any;
});

const originalFetch = globalThis.fetch;

beforeAll(() => {
  if (!globalThis.fetch) {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('fetch not implemented')));
  }
});

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

afterAll(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    delete (globalThis as any).fetch;
  }
});
