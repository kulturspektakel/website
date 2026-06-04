import {beforeEach, describe, expect, test, vi} from 'vitest';

const {allItems, user} = vi.hoisted(() => ({allItems: vi.fn(), user: vi.fn()}));
const {sendMessage} = vi.hoisted(() => ({sendMessage: vi.fn()}));

vi.mock('../../utils/nuclino.server', () => ({allItems, user}));
vi.mock('../../utils/slack.server', () => ({sendMessage}));

const {handleNuclinoUpdateMessage} = await import('./tasks.nuclino-update-message');

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
});
