import {beforeEach, describe, expect, test, vi} from 'vitest';

const {conversationMembers} = vi.hoisted(() => ({
  conversationMembers: vi.fn(),
}));
// `updates` resolves to the rows `.returning()` reports as changed.
const {db, updates} = await vi.hoisted(async () =>
  (await import('../../test/dbMock')).dbMock(),
);

vi.mock('./slack.server', () => ({conversationMembers}));
vi.mock('./db.server', () => ({db}));

const {
  grantBonbudePrivilege,
  revokeBonbudePrivilege,
  isBonbudeMember,
  reconcileBonbudePrivileges,
} = await import('./crewCardPrivileges.server');

beforeEach(() => {
  vi.clearAllMocks();
  updates.mockResolvedValue([]);
});

describe('crewCardPrivileges', () => {
  test('granting is limited to currently-valid, unsuspended cards', async () => {
    await grantBonbudePrivilege('U1');
    // viewer, validUntil > now (sent as an ISO string), suspended <> true,
    // privileged <> true
    expect(updates).toHaveBeenCalledWith(
      'CrewCard',
      {privileged: true},
      ['U1', expect.any(String), true, true],
    );
  });

  test('revoking ignores validity and suspension', async () => {
    // Expired privileged cards are still shipped to the devices by
    // `handleLists`, so leaving one privileged would leave it live.
    await revokeBonbudePrivilege('U1');
    // viewer and privileged only: no validity or suspension filter
    expect(updates).toHaveBeenCalledWith(
      'CrewCard',
      {privileged: false},
      ['U1', true],
    );
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

    const [grant, revoke] = updates.mock.calls;
    expect(grant).toEqual([
      'CrewCard',
      {privileged: true},
      ['U1', 'U2', expect.any(String), true, true],
    ]);
    // viewerId IS NOT NULL (no parameter), NOT IN members, privileged
    expect(revoke).toEqual([
      'CrewCard',
      {privileged: false},
      ['U1', 'U2', true],
    ]);
  });

  test('reconcile writes nothing when the channel reads back empty', async () => {
    conversationMembers.mockResolvedValue([]);

    expect(await reconcileBonbudePrivileges()).toBeNull();
    expect(updates).not.toHaveBeenCalled();
  });
});
