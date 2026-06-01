import {beforeEach, describe, expect, test, vi} from 'vitest';
import {ApiError} from '../../utils/apiError.server';

const {slackApiRequest} = vi.hoisted(() => ({slackApiRequest: vi.fn()}));
const {upsertViewer} = vi.hoisted(() => ({upsertViewer: vi.fn()}));
const {prismaMock} = vi.hoisted(() => ({
  prismaMock: {
    nonce: {delete: vi.fn()},
    nonceRequest: {update: vi.fn(), delete: vi.fn()},
  },
}));

vi.mock('../../utils/slack.server', () => ({slackApiRequest}));
vi.mock('../../utils/upsertViewer.server', () => ({upsertViewer}));
vi.mock('../../utils/prismaClient.server', () => ({prismaClient: prismaMock}));

const {handleCreateNonceRequest} = await import('./tasks.create-nonce-request');
const {handleNonceRequestInvalidate} = await import(
  './tasks.nonce-request-invalidate'
);
const {handleNonceInvalidate} = await import('./tasks.nonce-invalidate');

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
    prismaMock.nonceRequest.update.mockResolvedValueOnce({});

    const res = await handleCreateNonceRequest(postJson({id, email}));

    expect(res.status).toBe(204);
    expect(slackApiRequest).toHaveBeenNthCalledWith(
      1,
      `users.lookupByEmail?email=${encodeURIComponent(email)}`,
    );
    expect(upsertViewer).toHaveBeenCalledWith(slackUser);
    expect(prismaMock.nonceRequest.update).toHaveBeenCalledWith({
      where: {id},
      data: {createdForId: slackId},
    });
    // chat.postMessage with the approve/reject buttons referencing this id
    const [endpoint, body] = slackApiRequest.mock.calls[1];
    expect(endpoint).toBe('chat.postMessage');
    const actions = (body as any).blocks[1].elements;
    expect(actions[0]).toMatchObject({action_id: 'approve-nonce-request', value: id});
    expect(actions[1]).toMatchObject({action_id: 'reject-nonce-request', value: id});
  });

  test('returns 204 (no-op) when no Slack user matches the email', async () => {
    slackApiRequest.mockResolvedValueOnce({ok: false, error: 'users_not_found'});

    const res = await handleCreateNonceRequest(postJson({id, email}));

    expect(res.status).toBe(204);
    expect(upsertViewer).not.toHaveBeenCalled();
    expect(prismaMock.nonceRequest.update).not.toHaveBeenCalled();
    expect(slackApiRequest).toHaveBeenCalledTimes(1); // no DM sent
  });

  test('throws ApiError(502) when chat.postMessage fails', async () => {
    slackApiRequest
      .mockResolvedValueOnce({ok: true, user: {id: slackId}})
      .mockResolvedValueOnce({ok: false, error: 'channel_not_found'});
    upsertViewer.mockResolvedValueOnce({id: slackId});
    prismaMock.nonceRequest.update.mockResolvedValueOnce({});

    await expect(handleCreateNonceRequest(postJson({id, email}))).rejects.toThrow(
      ApiError,
    );
  });
});

describe('handleNonceRequestInvalidate', () => {
  test('deletes the row and returns 204', async () => {
    prismaMock.nonceRequest.delete.mockResolvedValueOnce({});
    const res = await handleNonceRequestInvalidate(
      postJson({nonceRequestId: 'r-1'}),
    );
    expect(res.status).toBe(204);
    expect(prismaMock.nonceRequest.delete).toHaveBeenCalledWith({where: {id: 'r-1'}});
  });

  test('returns 204 even when the row is already gone (delete throws)', async () => {
    prismaMock.nonceRequest.delete.mockRejectedValueOnce(
      new Error('record not found'),
    );
    const res = await handleNonceRequestInvalidate(
      postJson({nonceRequestId: 'r-1'}),
    );
    expect(res.status).toBe(204);
  });
});

describe('handleNonceInvalidate', () => {
  test('deletes the row and returns 204', async () => {
    prismaMock.nonce.delete.mockResolvedValueOnce({});
    const res = await handleNonceInvalidate(postJson({nonce: 'n-1'}));
    expect(res.status).toBe(204);
    expect(prismaMock.nonce.delete).toHaveBeenCalledWith({where: {nonce: 'n-1'}});
  });

  test('returns 204 even when the row is already gone', async () => {
    prismaMock.nonce.delete.mockRejectedValueOnce(new Error('record not found'));
    const res = await handleNonceInvalidate(postJson({nonce: 'n-1'}));
    expect(res.status).toBe(204);
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
