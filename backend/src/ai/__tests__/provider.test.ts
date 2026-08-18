import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatibleProvider } from '../provider';

describe('OpenAICompatibleProvider', () => {
  const originalEnv = { ...process.env };
  const context = { shifts: [], staff: [] };

  beforeEach(() => {
    process.env.AI_BASE_URL = 'https://api.example.com/v1';
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'test-model';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('parses a valid assignment result', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: JSON.stringify({ assignments: [{ rosterShiftId: 'rs-1', staffIds: ['staff-1'] }] }) } },
        ],
      }),
    });

    const provider = new OpenAICompatibleProvider();
    const result = await provider.assignShifts(context);

    expect(result.assignments).toEqual([{ rosterShiftId: 'rs-1', staffIds: ['staff-1'] }]);
  });

  it('throws when the http request fails', async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500 });

    const provider = new OpenAICompatibleProvider();
    await expect(provider.assignShifts(context)).rejects.toThrow('status 500');
  });

  it('throws when the response content is not valid JSON', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    });

    const provider = new OpenAICompatibleProvider();
    await expect(provider.assignShifts(context)).rejects.toThrow('invalid JSON');
  });

  it('throws when the response shape is unexpected', async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ foo: 'bar' }) } }] }),
    });

    const provider = new OpenAICompatibleProvider();
    await expect(provider.assignShifts(context)).rejects.toThrow('unexpected response shape');
  });

  it('throws when required env vars are missing', async () => {
    delete process.env.AI_BASE_URL;

    const provider = new OpenAICompatibleProvider();
    await expect(provider.assignShifts(context)).rejects.toThrow('not configured');
  });
});
