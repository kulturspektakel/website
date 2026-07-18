import {beforeEach, describe, expect, test, vi} from 'vitest';
import {sub} from 'date-fns';

const {findFirst} = vi.hoisted(() => ({findFirst: vi.fn()}));
const {fetchUser} = vi.hoisted(() => ({fetchUser: vi.fn()}));
const {upsertViewer} = vi.hoisted(() => ({upsertViewer: vi.fn()}));

vi.mock('../prismaClient.server', () => ({
  prismaClient: {viewerLocation: {findFirst}},
}));
vi.mock('../slack.server', () => ({fetchUser}));
vi.mock('../upsertViewer.server', () => ({upsertViewer}));

process.env.SITE_URL = 'https://www.kulturspektakel.de';
const {handleOwnTracksCommand} = await import('./owntracks');

beforeEach(() => vi.clearAllMocks());

function command(text: string) {
  return handleOwnTracksCommand(
    new Request('https://www.kulturspektakel.de/api/slack/owntracks', {
      method: 'POST',
      body: new URLSearchParams({user_id: 'U1', text}),
      headers: {'content-type': 'application/x-www-form-urlencoded'},
    }),
  );
}

describe('handleOwnTracksCommand — /location lookup', () => {
  test('tagged user with a recent location returns a Google Maps link', async () => {
    findFirst.mockResolvedValueOnce({
      latitude: 47.883,
      longitude: 10.617,
      createdAt: sub(new Date(), {hours: 2}),
    });

    const res = await command('<@U2|dan>');
    const body = await res.json();
    const text = body.blocks[0].text.text as string;

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({where: expect.objectContaining({viewerId: 'U2'})}),
    );
    expect(text).toContain('https://www.google.com/maps?q=47.883,10.617');
    expect(text).toContain('<@U2>');
  });

  test('tagged user with no recent location returns the "kein Standort" message', async () => {
    findFirst.mockResolvedValueOnce(null);

    const res = await command('<@U2>');
    const body = await res.json();
    const text = body.blocks[0].text.text as string;

    expect(text).toContain('keinen Standort geteilt');
    expect(text).not.toContain('google.com/maps');
  });

  test('no mention falls through to the setup instructions', async () => {
    fetchUser.mockResolvedValueOnce({id: 'U1', displayName: 'X'});
    upsertViewer.mockResolvedValueOnce({id: 'U1', displayName: 'X'});

    const res = await command('');
    const body = await res.json();
    const text = body.blocks[0].text.text as string;

    expect(findFirst).not.toHaveBeenCalled();
    expect(text).toContain('OwnTracks');
  });
});
