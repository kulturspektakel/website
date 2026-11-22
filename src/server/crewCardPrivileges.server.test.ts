import {beforeEach, describe, expect, test, vi} from 'vitest';

const {conversationMembers} = vi.hoisted(() => ({
  conversationMembers: vi.fn(),
}));
// `updates` resolves to the rows `.returning()` reports as changed.
const {db, updates} = await vi.hoisted(async () =>
  (await import('../../test/dbMock')).dbMock(),
);

const {refreshHolderWalletPasses} = vi.hoisted(() => ({
  refreshHolderWalletPasses: vi.fn(),
}));

vi.mock('./slack.server', () => ({conversationMembers}));
vi.mock('./crewCardPass.server', () => ({refreshHolderWalletPasses}));
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
  test('granting and revoking set the holder, covering all their cards', async () => {
    await grantBonbudePrivilege('U1');
    // viewer, not privileged yet
    expect(updates).toHaveBeenCalledWith('CrewCardHolder', {privileged: true}, [
      'U1',
      false,
    ]);
    await revokeBonbudePrivilege('U1');
    expect(updates).toHaveBeenCalledWith(
      'CrewCardHolder',
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
      'CrewCardHolder',
      {privileged: true},
      ['U1', 'U2', false],
    ]);
    // viewerId IS NOT NULL (no parameter), NOT IN members, privileged
    expect(revoke).toEqual([
      'CrewCardHolder',
      {privileged: false},
      ['U1', 'U2', true],
    ]);
  });

  test('reconcile refreshes wallet passes with a message per direction', async () => {
    conversationMembers.mockResolvedValue(['U1']);
    const granted = 'holder-1';
    const revoked = 'holder-2';
    updates
      .mockResolvedValueOnce([{id: granted}])
      .mockResolvedValueOnce([{id: revoked}]);

    await reconcileBonbudePrivileges();

    expect(refreshHolderWalletPasses).toHaveBeenCalledWith([granted], {
      message: 'Bonbude freigeschaltet',
    });
    expect(refreshHolderWalletPasses).toHaveBeenCalledWith([revoked], {
      message: 'Bonbude-Zugang entfernt',
    });
  });

  test('reconcile writes nothing when the channel reads back empty', async () => {
    conversationMembers.mockResolvedValue([]);

    expect(await reconcileBonbudePrivileges()).toBeNull();
    expect(updates).not.toHaveBeenCalled();
  });
});
