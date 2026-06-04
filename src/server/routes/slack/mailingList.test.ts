import {beforeEach, describe, expect, test, vi} from 'vitest';

const {addToMailingList} = vi.hoisted(() => ({addToMailingList: vi.fn()}));
vi.mock('../../../utils/addToMailingList.server', () => ({addToMailingList}));

const {handleMailingListCommand} = await import('./mailingList');

function command(text: string) {
  return new Request('https://test/slack/mailingliste', {
    method: 'POST',
    body: new URLSearchParams({text}),
    headers: {'content-type': 'application/x-www-form-urlencoded'},
  });
}

beforeEach(() => vi.clearAllMocks());

describe('handleMailingListCommand', () => {
  test('adds the email and confirms', async () => {
    addToMailingList.mockResolvedValueOnce(true);
    const res = await handleMailingListCommand(command('  Foo@Bar.de '));
    expect(addToMailingList).toHaveBeenCalledWith('foo@bar.de');
    expect((await res.json()).text).toContain('hinzugefügt');
  });

  test('reports when already a member', async () => {
    addToMailingList.mockResolvedValueOnce(false);
    const res = await handleMailingListCommand(command('foo@bar.de'));
    expect((await res.json()).text).toContain('ist bereits');
  });

  test('rejects empty input without calling the API', async () => {
    const res = await handleMailingListCommand(command(''));
    expect(addToMailingList).not.toHaveBeenCalled();
    expect((await res.json()).text).toContain('fehlt');
  });
});
