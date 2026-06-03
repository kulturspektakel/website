import {beforeEach, describe, expect, test, vi} from 'vitest';

const {enqueueGcpTask} = vi.hoisted(() => ({enqueueGcpTask: vi.fn()}));
const {slackApiRequest} = vi.hoisted(() => ({slackApiRequest: vi.fn()}));
const {prismaMock} = vi.hoisted(() => ({
  prismaMock: {bandApplication: {findUniqueOrThrow: vi.fn()}},
}));

vi.mock('../../utils/enqueueGcpTask.server', () => ({enqueueGcpTask}));
vi.mock('../../utils/slack.server', () => ({slackApiRequest}));
vi.mock('../../utils/prismaClient.server', () => ({prismaClient: prismaMock}));

const {handleCreateBandApplication} = await import(
  './tasks.create-band-application'
);

function request(id: string) {
  return new Request('https://example.test/x', {
    method: 'POST',
    body: JSON.stringify({id}),
    headers: {'content-type': 'application/json'},
  });
}

const baseApplication = {
  id: 'app1',
  bandname: 'The Testers',
  email: 'band@example.test',
  genreCategory: 'Rock',
  genre: null,
  city: 'Gauting',
  contactName: 'Max',
  contactPhone: '0123',
  demo: null,
  facebook: null,
  instagram: null,
  spotifyArtist: null,
  event: {start: new Date('2026-08-01T00:00:00.000Z')},
};

beforeEach(() => {
  vi.clearAllMocks();
  enqueueGcpTask.mockResolvedValue(undefined);
  slackApiRequest.mockResolvedValue({ok: true});
});

describe('handleCreateBandApplication', () => {
  test('always sends email + distance + Slack; skips enrichment with no links', async () => {
    prismaMock.bandApplication.findUniqueOrThrow.mockResolvedValue(
      baseApplication,
    );

    const res = await handleCreateBandApplication(request('app1'));
    expect(res.status).toBe(204);

    expect(enqueueGcpTask).toHaveBeenCalledWith('send-email', {
      template: 'confirmBandApplication',
      variables: {bandname: 'The Testers', eventYear: '2026'},
      to: 'band@example.test',
      from: 'Kulturspektakel Gauting Booking <booking@kulturspektakel.de>',
    });
    expect(enqueueGcpTask).toHaveBeenCalledWith('band-application-distance', {
      id: 'app1',
    });
    expect(slackApiRequest).toHaveBeenCalledWith(
      'chat.postMessage',
      expect.objectContaining({channel: 'C3U99AB54'}),
    );

    const tasks = enqueueGcpTask.mock.calls.map((c) => c[0]);
    expect(tasks).not.toContain('band-application-demo');
    expect(tasks).not.toContain('facebook-likes');
    expect(tasks).not.toContain('instagram-follower');
    expect(tasks).not.toContain('spotify-listeners');
  });

  test('DJ application posts to #dj and emails from info@', async () => {
    prismaMock.bandApplication.findUniqueOrThrow.mockResolvedValue({
      ...baseApplication,
      genreCategory: 'DJ',
    });

    await handleCreateBandApplication(request('app1'));

    expect(slackApiRequest).toHaveBeenCalledWith(
      'chat.postMessage',
      expect.objectContaining({channel: 'C0491HCU5G9'}),
    );
    expect(enqueueGcpTask).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({
        from: 'Kulturspektakel Gauting <info@kulturspektakel.de>',
      }),
    );
  });

  test('fans out enrichment tasks when links are present', async () => {
    prismaMock.bandApplication.findUniqueOrThrow.mockResolvedValue({
      ...baseApplication,
      demo: 'https://youtu.be/abc',
      facebook: 'https://facebook.com/band',
      instagram: 'band',
      spotifyArtist: 'xyz',
    });

    await handleCreateBandApplication(request('app1'));

    const tasks = enqueueGcpTask.mock.calls.map((c) => c[0]);
    expect(tasks).toContain('band-application-demo');
    expect(tasks).toContain('facebook-likes');
    expect(tasks).toContain('instagram-follower');
    expect(tasks).toContain('spotify-listeners');
  });
});
