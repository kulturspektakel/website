import {beforeEach, describe, expect, test, vi} from 'vitest';

const {nonceUpdate, ccUpdateMany, ccUpdate} = vi.hoisted(() => ({
  nonceUpdate: vi.fn(),
  ccUpdateMany: vi.fn(),
  ccUpdate: vi.fn(),
}));
const {fetchUser, slackApiRequest, sendMessage, postResponseUrl} = vi.hoisted(
  () => ({
    fetchUser: vi.fn(),
    slackApiRequest: vi.fn(),
    sendMessage: vi.fn(),
    postResponseUrl: vi.fn(),
  }),
);
const {upsertViewer} = vi.hoisted(() => ({upsertViewer: vi.fn()}));

vi.mock('../prismaClient.server', () => ({
  prismaClient: {
    nonceRequest: {update: nonceUpdate},
    crewCard: {updateManyAndReturn: ccUpdateMany, update: ccUpdate},
    twoFactor: {findFirstOrThrow: vi.fn()},
  },
}));
vi.mock('../slack.server', () => ({
  fetchUser,
  slackApiRequest,
  sendMessage,
  postResponseUrl,
}));
vi.mock('../upsertViewer.server', () => ({upsertViewer}));

const {handleSlackInteraction} = await import('./interaction');

function interaction(payload: unknown) {
  return new Request('https://test/slack/interaction', {
    method: 'POST',
    body: new URLSearchParams({payload: JSON.stringify(payload)}),
    headers: {'content-type': 'application/x-www-form-urlencoded'},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({json: () => Promise.resolve({})}),
  );
});

describe('handleSlackInteraction', () => {
  test('approve-nonce-request updates status and deletes the message', async () => {
    nonceUpdate.mockResolvedValueOnce({});
    const res = await handleSlackInteraction(
      interaction({
        type: 'block_actions',
        user: {id: 'U1'},
        response_url: 'https://hooks.slack/resp',
        actions: [
          {type: 'button', action_id: 'approve-nonce-request', value: 'nr1'},
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(nonceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({data: {status: 'Approved'}}),
    );
    expect(postResponseUrl).toHaveBeenCalledWith('https://hooks.slack/resp', {
      delete_original: 'true',
    });
  });

  test('assign-crew-card view submission resolves the Slack user and assigns the card', async () => {
    fetchUser.mockResolvedValueOnce({
      id: 'U9',
      profile: {real_name: 'Test', image_192: '', email: 't@e.de'},
    });
    upsertViewer.mockResolvedValueOnce({id: 'U9'});
    ccUpdateMany.mockResolvedValueOnce([]);
    ccUpdate.mockResolvedValueOnce({validUntil: new Date('2026-08-01')});

    const res = await handleSlackInteraction(
      interaction({
        type: 'view_submission',
        user: {id: 'U1'},
        view: {
          callback_id: 'assign-crew-card',
          private_metadata: JSON.stringify({
            responseUrl: 'https://hooks.slack/resp',
            cardId: 'AA:BB:CC',
          }),
          state: {
            values: {
              b1: {'users_select-action': {type: 'users_select', selected_user: 'U9'}},
            },
          },
        },
      }),
    );
    expect(await res.json()).toEqual({response_action: 'clear'});
    expect(fetchUser).toHaveBeenCalledWith('U9');
    expect(upsertViewer).toHaveBeenCalled();
    expect(ccUpdate).toHaveBeenCalledWith(
      expect.objectContaining({data: {viewerId: 'U9', nickname: null}}),
    );
  });
});
