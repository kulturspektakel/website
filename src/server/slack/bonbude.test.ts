import {beforeEach, describe, expect, test, vi} from 'vitest';

const {reconcileBonbudePrivileges} = vi.hoisted(() => ({
  reconcileBonbudePrivileges: vi.fn(),
}));

vi.mock('../crewCardPrivileges.server', () => ({reconcileBonbudePrivileges}));

const {handleBonbudeCommand} = await import('./bonbude');

function command() {
  return new Request('https://test/slack/bonbude', {
    method: 'POST',
    body: new URLSearchParams({command: '/bonbude', user_id: 'U1'}),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('handleBonbudeCommand', () => {
  test('reports the counts', async () => {
    reconcileBonbudePrivileges.mockResolvedValue({granted: 2, revoked: 1});
    const {text} = await (await handleBonbudeCommand(command())).json();
    expect(text).toContain('2 vergeben');
    expect(text).toContain('1 entzogen');
  });

  test('says so when everything already agrees', async () => {
    reconcileBonbudePrivileges.mockResolvedValue({granted: 0, revoked: 0});
    const {text} = await (await handleBonbudeCommand(command())).json();
    expect(text).toContain('stimmen bereits');
  });

  test('warns instead of reporting a sync when the channel reads back empty', async () => {
    reconcileBonbudePrivileges.mockResolvedValue(null);
    const {text} = await (await handleBonbudeCommand(command())).json();
    expect(text).toContain('⚠️');
  });
});
