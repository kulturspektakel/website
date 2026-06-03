import {beforeEach, describe, expect, test, vi} from 'vitest';

const {slackApiRequest} = vi.hoisted(() => ({slackApiRequest: vi.fn()}));

vi.mock('../../utils/slack.server', () => ({slackApiRequest}));

const {handleCrewCardEnrolled} = await import('./tasks.crew-card-enrolled');

function enrolledRequest(body: unknown) {
  return new Request('https://example.test/x', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {'content-type': 'application/json'},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  slackApiRequest.mockResolvedValue({ok: true});
});

describe('handleCrewCardEnrolled', () => {
  test('posts an activation message to #crewcards with an assign button', async () => {
    const res = await handleCrewCardEnrolled(
      enrolledRequest({
        crewCardId: [0xab, 0x01, 0xff],
        // 1 day is subtracted, in Europe/Berlin — should read as the 14th.
        validUntil: '2026-08-15T00:00:00.000Z',
      }),
    );
    expect(res.status).toBe(204);

    expect(slackApiRequest).toHaveBeenCalledTimes(1);
    const [endpoint, body] = slackApiRequest.mock.calls[0];
    expect(endpoint).toBe('chat.postMessage');
    expect(body.channel).toBe('C0965QS6763');
    expect(body.text).toBe('CrewCard AB:01:FF wurde aktiviert');
    expect(body.blocks[0].text.text).toContain('AB:01:FF');
    expect(body.blocks[0].text.text).toContain('14.08.2026');
    expect(body.blocks[1].elements[0]).toMatchObject({
      action_id: 'assign-crew-card-modal',
      value: 'AB:01:FF',
    });
  });

  test('throws when Slack rejects the post', async () => {
    slackApiRequest.mockResolvedValue({ok: false, error: 'channel_not_found'});
    await expect(
      handleCrewCardEnrolled(
        enrolledRequest({
          crewCardId: [0x01],
          validUntil: '2026-08-15T00:00:00.000Z',
        }),
      ),
    ).rejects.toThrow();
  });
});
