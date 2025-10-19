import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LlmProvider } from '@prisma/client';
import { userRouter } from './user';

const hoisted = vi.hoisted(() => {
  const update = vi.fn().mockResolvedValue({});
  return { update };
});

vi.mock('@/server/db', () => ({
  db: { user: { update: hoisted.update } },
}));

beforeEach(() => {
  hoisted.update.mockClear();
});

describe('userRouter.setTimezone', () => {
  it('updates timezone for authenticated user', async () => {
    await userRouter.createCaller({ session: { user: { id: 'u1' } } as any }).setTimezone({ timezone: 'UTC' });
    expect(hoisted.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { timezone: 'UTC' } });
  });

  it('throws when unauthenticated', async () => {
    await expect(userRouter.createCaller({}).setTimezone({ timezone: 'UTC' })).rejects.toThrow();
  });
});

describe('userRouter.setSettings', () => {
  const caller = userRouter.createCaller({ session: { user: { id: 'u1' } } as any });

  it('updates scheduling and AI preferences', async () => {
    await caller.setSettings({
      timezone: 'UTC',
      dayWindowStartHour: 9,
      dayWindowEndHour: 18,
      defaultDurationMinutes: 45,
      googleSyncEnabled: false,
      llmProvider: LlmProvider.LM_STUDIO,
      openaiApiKey: null,
      lmStudioUrl: 'http://localhost:1234',
    });

    expect(hoisted.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        timezone: 'UTC',
        dayWindowStartHour: 9,
        dayWindowEndHour: 18,
        defaultDurationMinutes: 45,
        googleSyncEnabled: false,
        llmProvider: LlmProvider.LM_STUDIO,
        openaiApiKey: null,
        lmStudioUrl: 'http://localhost:1234',
      },
    });
  });

  it('requires an OpenAI key when selecting the OpenAI provider', async () => {
    await expect(
      caller.setSettings({
        timezone: 'UTC',
        dayWindowStartHour: 8,
        dayWindowEndHour: 17,
        defaultDurationMinutes: 30,
        googleSyncEnabled: true,
        llmProvider: LlmProvider.OPENAI,
        openaiApiKey: null,
        lmStudioUrl: 'http://localhost:1234',
      })
    ).rejects.toThrow(/openai api key/i);
    expect(hoisted.update).not.toHaveBeenCalled();
  });

  it('rejects when the day window end hour is not after the start hour', async () => {
    await expect(
      caller.setSettings({
        timezone: 'UTC',
        dayWindowStartHour: 18,
        dayWindowEndHour: 18,
        defaultDurationMinutes: 30,
        googleSyncEnabled: true,
        llmProvider: LlmProvider.NONE,
        openaiApiKey: null,
        lmStudioUrl: 'http://localhost:1234',
      })
    ).rejects.toThrow(/end hour must be later than the start hour/i);
    expect(hoisted.update).not.toHaveBeenCalled();
  });
});
