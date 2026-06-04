import {beforeEach, describe, expect, test, vi} from 'vitest';

const {item, user} = vi.hoisted(() => ({item: vi.fn(), user: vi.fn()}));
const {unfurl} = vi.hoisted(() => ({unfurl: vi.fn()}));
const {addToMailingList} = vi.hoisted(() => ({addToMailingList: vi.fn()}));

vi.mock('../nuclino.server', () => ({item, user}));
vi.mock('../slack.server', () => ({unfurl}));
vi.mock('../addToMailingList.server', () => ({addToMailingList}));

const {handleSlackEvents} = await import('./events');

function event(body: unknown) {
  return new Request('https://test/slack/events', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {'content-type': 'application/json'},
  });
}

beforeEach(() => vi.clearAllMocks());

describe('handleSlackEvents', () => {
  test('answers the url_verification challenge', async () => {
    const res = await handleSlackEvents(
      event({type: 'url_verification', challenge: 'abc123'}),
    );
    expect(await res.json()).toEqual({challenge: 'abc123'});
  });

  test('team_join adds the new member to the mailing list', async () => {
    const res = await handleSlackEvents(
      event({
        type: 'event_callback',
        event: {type: 'team_join', user: {profile: {email: 'new@kult.de'}}},
      }),
    );
    expect(res.status).toBe(200);
    expect(addToMailingList).toHaveBeenCalledWith('new@kult.de');
  });

  test('link_shared unfurls a Nuclino link', async () => {
    item.mockResolvedValueOnce({
      title: 'Page',
      content: 'line1\nline2\nline3',
      lastUpdatedUserId: 'NU1',
      lastUpdatedAt: '2026-06-01T00:00:00Z',
    });
    user.mockResolvedValueOnce({firstName: 'A', lastName: 'B'});

    const url =
      'https://app.nuclino.com/Kulturspektakel/Page/abcdef12-3456-7890-abcd-ef1234567890';
    const res = await handleSlackEvents(
      event({
        type: 'event_callback',
        event: {
          type: 'link_shared',
          channel: 'C1',
          message_ts: '123.45',
          links: [{domain: 'app.nuclino.com', url}],
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(item).toHaveBeenCalledWith('abcdef12-3456-7890-abcd-ef1234567890');
    expect(unfurl).toHaveBeenCalledWith(
      expect.objectContaining({channel: 'C1', ts: '123.45'}),
    );
    expect(unfurl.mock.calls[0][0].unfurls[url]).toBeDefined();
  });
});
