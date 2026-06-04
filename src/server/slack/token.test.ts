import {beforeEach, describe, expect, test, vi} from 'vitest';

const {create} = vi.hoisted(() => ({create: vi.fn()}));
const {fetchUser, slackApiRequest} = vi.hoisted(() => ({
  fetchUser: vi.fn(),
  slackApiRequest: vi.fn(),
}));
const {upsertViewer} = vi.hoisted(() => ({upsertViewer: vi.fn()}));
const {enqueueGcpTask} = vi.hoisted(() => ({enqueueGcpTask: vi.fn()}));

vi.mock('../prismaClient.server', () => ({
  prismaClient: {nonce: {create}},
}));
vi.mock('../slack.server', () => ({fetchUser, slackApiRequest}));
vi.mock('../upsertViewer.server', () => ({upsertViewer}));
vi.mock('../enqueueGcpTask.server', () => ({enqueueGcpTask}));

process.env.NUCLINO_TEAM_ID = 'team123';
process.env.SITE_URL = 'https://www.kulturspektakel.de';
const {handleNuclinoTokenCommand, handleNuclinoTokenRedirect} = await import(
  './token'
);

beforeEach(() => vi.clearAllMocks());

describe('handleNuclinoTokenRedirect (GET)', () => {
  test('sets the nonce cookie and redirects to the Nuclino SSO url', () => {
    const redirect =
      'https://api.nuclino.com/api/sso/team123/login?redirectUrl=x';
    const res = handleNuclinoTokenRedirect(
      new Request(
        `https://www.kulturspektakel.de/slack/token?nonce=abc&redirect=${encodeURIComponent(redirect)}`,
      ),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(redirect);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('nonce=abc');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Domain=.kulturspektakel.de');
  });

  test('400s without nonce/redirect', () => {
    expect(() =>
      handleNuclinoTokenRedirect(
        new Request('https://www.kulturspektakel.de/slack/token'),
      ),
    ).toThrow();
  });
});

describe('handleNuclinoTokenCommand (POST)', () => {
  test('mints a nonce and opens the login modal', async () => {
    fetchUser.mockResolvedValueOnce({
      id: 'U1',
      profile: {real_name: 'X', image_192: '', email: 'x@e.de'},
    });
    upsertViewer.mockResolvedValueOnce({id: 'U1'});
    create.mockResolvedValueOnce({nonce: 'n-1'});
    slackApiRequest.mockResolvedValueOnce({ok: true});

    const res = await handleNuclinoTokenCommand(
      new Request('https://www.kulturspektakel.de/slack/token', {
        method: 'POST',
        body: new URLSearchParams({user_id: 'U1', trigger_id: 'T1'}),
        headers: {'content-type': 'application/x-www-form-urlencoded'},
      }),
    );
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({data: expect.objectContaining({createdForId: 'U1'})}),
    );
    // modal opened, button links back to /slack/token with the nonce
    const view = slackApiRequest.mock.calls[0][1].view;
    const buttonUrl = view.blocks[1].elements[0].url as string;
    expect(buttonUrl).toContain('https://www.kulturspektakel.de/api/slack/token');
    expect(buttonUrl).toContain('nonce=n-1');
  });
});
