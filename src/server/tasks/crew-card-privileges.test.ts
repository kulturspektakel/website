import {beforeEach, describe, expect, test, vi} from 'vitest';

const {conversationMembers} = vi.hoisted(() => ({
  conversationMembers: vi.fn(),
}));
const {prismaMock} = vi.hoisted(() => ({
  prismaMock: {crewCard: {updateMany: vi.fn()}},
}));

vi.mock('../../server/slack.server', () => ({conversationMembers}));
vi.mock('../../server/prismaClient.server', () => ({prismaClient: prismaMock}));

const {handleCrewCardPrivileges} = await import('./crew-card-privileges');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.crewCard.updateMany.mockResolvedValue({count: 0});
});

describe('handleCrewCardPrivileges', () => {
  test('grants to members and revokes from everyone else with a viewer', async () => {
    conversationMembers.mockResolvedValue(['U1', 'U2']);

    const res = await handleCrewCardPrivileges();
    expect(res.status).toBe(204);
    expect(conversationMembers).toHaveBeenCalledWith('C0BKU2WSN7K');

    const [[grant], [revoke]] = prismaMock.crewCard.updateMany.mock.calls;

    // Granting is limited to currently-valid, unsuspended cards.
    expect(grant).toEqual({
      where: {
        viewerId: {in: ['U1', 'U2']},
        validUntil: {gt: expect.any(Date)},
        suspended: {not: true},
        privileged: {not: true},
      },
      data: {privileged: true},
    });

    // Revoking ignores validity/suspension (expired privileged cards are still
    // shipped to the devices) but never touches nickname-only cards.
    expect(revoke).toEqual({
      where: {viewerId: {notIn: ['U1', 'U2'], not: null}, privileged: true},
      data: {privileged: false},
    });
  });

  test('revokes nothing when the channel reads back empty', async () => {
    conversationMembers.mockResolvedValue([]);

    const res = await handleCrewCardPrivileges();
    expect(res.status).toBe(204);
    expect(prismaMock.crewCard.updateMany).not.toHaveBeenCalled();
  });
});
