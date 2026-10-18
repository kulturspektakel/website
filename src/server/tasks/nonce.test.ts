import {beforeEach, describe, expect, test, vi} from 'vitest';
import {ApiError} from '../../server/apiError.server';

const {slackApiRequest} = vi.hoisted(() => ({slackApiRequest: vi.fn()}));
const {upsertViewer} = vi.hoisted(() => ({upsertViewer: vi.fn()}));
const {db, updates, deletes} = await vi.hoisted(async () =>
  (await import('../../../test/dbMock')).dbMock(),
);

vi.mock('../../server/slack.server', () => ({slackApiRequest}));
vi.mock('../../server/upsertViewer.server', () => ({upsertViewer}));
vi.mock('../../server/db.server', () => ({db}));

const {handleCreateNonceRequest} = await import('./create-nonce-request');
const {handleNonceRequestInvalidate} =
  await import('./nonce-request-invalidate');
const {handleNonceInvalidate} = await import('./nonce-invalidate');

function postJson(body: unknown) {
  return new Request('https://example.test/api/tasks/x', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {'content-type': 'application/json'},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleCreateNonceRequest', () => {
  const id = '00000000-0000-0000-0000-000000000001';
  const email = 'user@example.test';
  const slackId = 'U0SLACK';

  test('looks up Slack user, upserts viewer, links NonceRequest, sends DM', async () => {
    const slackUser = {id: slackId, profile: {real_name: 'Test User'}};
    slackApiRequest
      .mockResolvedValueOnce({ok: true, user: slackUser}) // users.lookupByEmail
      .mockResolvedValueOnce({ok: true}); // chat.postMessage
    upsertViewer.mockResolvedValueOnce({id: slackId});

    const res = await handleCreateNonceRequest(postJson({id, email}));

    expect(res.status).toBe(204);
    expect(slackApiRequest).toHaveBeenNthCalledWith(
      1,
      `users.lookupByEmail?email=${encodeURIComponent(email)}`,
    );
    expect(upsertViewer).toHaveBeenCalledWith(slackUser);
    expect(updates).toHaveBeenCalledWith(
      'NonceRequest',
      {createdForId: slackId},
      [id],
    );
    // chat.postMessage with the approve/reject buttons referencing this id
    const [endpoint, body] = slackApiRequest.mock.calls[1];
    expect(endpoint).toBe('chat.postMessage');
    const actions = (body as any).blocks[1].elements;
    expect(actions[0]).toMatchObject({
      action_id: 'approve-nonce-request',
      value: id,
    });
    expect(actions[1]).toMatchObject({
      action_id: 'reject-nonce-request',
      value: id,
    });
  });

  test('returns 204 (no-op) when no Slack user matches the email', async () => {
    slackApiRequest.mockResolvedValueOnce({
      ok: false,
      error: 'users_not_found',
    });

    const res = await handleCreateNonceRequest(postJson({id, email}));

    expect(res.status).toBe(204);
    expect(upsertViewer).not.toHaveBeenCalled();
    expect(updates).not.toHaveBeenCalled();
    expect(slackApiRequest).toHaveBeenCalledTimes(1); // no DM sent
  });

  test('throws ApiError(502) when chat.postMessage fails', async () => {
    slackApiRequest
      .mockResolvedValueOnce({ok: true, user: {id: slackId}})
      .mockResolvedValueOnce({ok: false, error: 'channel_not_found'});
    upsertViewer.mockResolvedValueOnce({id: slackId});

    await expect(
      handleCreateNonceRequest(postJson({id, email})),
    ).rejects.toThrow(ApiError);
  });
});

describe('handleNonceRequestInvalidate', () => {
  test('deletes the row and returns 204', async () => {
    const res = await handleNonceRequestInvalidate(
      postJson({nonceRequestId: 'r-1'}),
    );
    expect(res.status).toBe(204);
    expect(deletes).toHaveBeenCalledWith('NonceRequest', ['r-1']);
  });
});

describe('handleNonceInvalidate', () => {
  test('deletes the row and returns 204', async () => {
    const res = await handleNonceInvalidate(postJson({nonce: 'n-1'}));
    expect(res.status).toBe(204);
    expect(deletes).toHaveBeenCalledWith('Nonce', ['n-1']);
  });

  test('rejects malformed JSON body with ApiError(400)', async () => {
    const req = new Request('https://example.test/api/tasks/x', {
      method: 'POST',
      body: 'not json',
      headers: {'content-type': 'application/json'},
    });
    await expect(handleNonceInvalidate(req)).rejects.toThrow(ApiError);
  });
});
