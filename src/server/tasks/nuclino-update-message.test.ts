import {beforeEach, describe, expect, test, vi} from 'vitest';

const {allItems, user} = vi.hoisted(() => ({allItems: vi.fn(), user: vi.fn()}));
const {sendMessage} = vi.hoisted(() => ({sendMessage: vi.fn()}));

// Keep the real NuclinoApiError so the task's `instanceof` checks work.
vi.mock('../../server/nuclino.server', async (importActual) => ({
  ...(await importActual<typeof import('../../server/nuclino.server')>()),
  allItems,
  user,
}));
vi.mock('../../server/slack.server', () => ({sendMessage}));

const {NuclinoApiError} = await import('../../server/nuclino.server');

const {handleNuclinoUpdateMessage} = await import('./nuclino-update-message');

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60_000).toISOString();

beforeEach(() => vi.clearAllMocks());

describe('handleNuclinoUpdateMessage', () => {
  test('announces pages edited 5-10 min ago to #wiki, skips fresh edits', async () => {
    allItems.mockResolvedValueOnce([
      {
        object: 'item',
        title: 'Settled page',
        url: 'https://app.nuclino.com/t/x',
        lastUpdatedUserId: 'NU1',
        lastUpdatedAt: minutesAgo(7), // in window
      },
      {
        object: 'item',
        title: 'Just edited',
        url: 'https://app.nuclino.com/t/y',
        lastUpdatedUserId: 'NU2',
        lastUpdatedAt: minutesAgo(1), // too fresh
      },
    ]);
    user.mockResolvedValue({firstName: 'A', lastName: 'B'});

    const res = await handleNuclinoUpdateMessage();
    expect(res.status).toBe(204);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C03F5E07Z', // #wiki
        text: expect.stringContaining('Settled page'),
      }),
    );
  });

  test('completes (204) without posting when the Nuclino API is unavailable', async () => {
    allItems.mockRejectedValueOnce(new NuclinoApiError(503, 'Service Unavailable'));

    const res = await handleNuclinoUpdateMessage();
    expect(res.status).toBe(204);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  test('skips an item whose author lookup is rate-limited, posts the rest', async () => {
    allItems.mockResolvedValueOnce([
      {
        object: 'item',
        title: 'Page A',
        url: 'https://app.nuclino.com/t/a',
        lastUpdatedUserId: 'NU1',
        lastUpdatedAt: minutesAgo(7),
      },
      {
        object: 'item',
        title: 'Page B',
        url: 'https://app.nuclino.com/t/b',
        lastUpdatedUserId: 'NU2',
        lastUpdatedAt: minutesAgo(7),
      },
    ]);
    user
      .mockRejectedValueOnce(new NuclinoApiError(429, 'Too Many Requests'))
      .mockResolvedValueOnce({firstName: 'A', lastName: 'B'});

    const res = await handleNuclinoUpdateMessage();
    expect(res.status).toBe(204);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({text: expect.stringContaining('Page B')}),
    );
  });

  test('rethrows non-transient Nuclino errors (so they still alert)', async () => {
    allItems.mockRejectedValueOnce(new NuclinoApiError(401, 'Unauthorized'));

    await expect(handleNuclinoUpdateMessage()).rejects.toThrow(NuclinoApiError);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
