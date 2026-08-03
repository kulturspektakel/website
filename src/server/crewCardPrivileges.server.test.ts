import {beforeEach, describe, expect, test, vi} from 'vitest';

const {conversationMembers} = vi.hoisted(() => ({
  conversationMembers: vi.fn(),
}));
const {prismaMock} = vi.hoisted(() => ({
  prismaMock: {crewCard: {updateMany: vi.fn()}},
}));

vi.mock('./slack.server', () => ({conversationMembers}));
vi.mock('./prismaClient.server', () => ({prismaClient: prismaMock}));

const {
  grantBonbudePrivilege,
  revokeBonbudePrivilege,
  isBonbudeMember,
  reconcileBonbudePrivileges,
} = await import('./crewCardPrivileges.server');

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.crewCard.updateMany.mockResolvedValue({count: 0});
});

describe('crewCardPrivileges', () => {
  test('granting is limited to currently-valid, unsuspended cards', async () => {
    await grantBonbudePrivilege('U1');
    expect(prismaMock.crewCard.updateMany).toHaveBeenCalledWith({
      where: {
        viewerId: 'U1',
        validUntil: {gt: expect.any(Date)},
        suspended: {not: true},
        privileged: {not: true},
      },
      data: {privileged: true},
    });
  });

  test('revoking ignores validity and suspension', async () => {
    // Expired privileged cards are still shipped to the devices by
    // `handleLists`, so leaving one privileged would leave it live.
    await revokeBonbudePrivilege('U1');
    expect(prismaMock.crewCard.updateMany).toHaveBeenCalledWith({
      where: {viewerId: 'U1', privileged: true},
      data: {privileged: false},
    });
  });

  test('isBonbudeMember resolves false when Slack fails', async () => {
    conversationMembers.mockRejectedValueOnce(new Error('nope'));
    expect(await isBonbudeMember('U1')).toBe(false);

    conversationMembers.mockResolvedValueOnce(['U1', 'U2']);
    expect(await isBonbudeMember('U1')).toBe(true);
  });

  test('reconcile grants to members and revokes from everyone else with a viewer', async () => {
    conversationMembers.mockResolvedValue(['U1', 'U2']);

    expect(await reconcileBonbudePrivileges()).toEqual({
      granted: 0,
      revoked: 0,
    });
    expect(conversationMembers).toHaveBeenCalledWith('C0BKU2WSN7K');

    const [[grant], [revoke]] = prismaMock.crewCard.updateMany.mock.calls;
    expect(grant).toEqual({
      where: {
        viewerId: {in: ['U1', 'U2']},
        validUntil: {gt: expect.any(Date)},
        suspended: {not: true},
        privileged: {not: true},
      },
      data: {privileged: true},
    });
    expect(revoke).toEqual({
      where: {viewerId: {notIn: ['U1', 'U2'], not: null}, privileged: true},
      data: {privileged: false},
    });
  });

  test('reconcile writes nothing when the channel reads back empty', async () => {
    conversationMembers.mockResolvedValue([]);

    expect(await reconcileBonbudePrivileges()).toBeNull();
    expect(prismaMock.crewCard.updateMany).not.toHaveBeenCalled();
  });
});
