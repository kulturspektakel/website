import {beforeEach, describe, expect, test, vi} from 'vitest';

const {db, query, updates} = await vi.hoisted(async () =>
  (await import('../../../test/dbMock')).dbMock(),
);

vi.mock('../../server/db.server', () => ({db}));

const {handleBandApplicationDemo} = await import('./band-application-demo');

function request(id: string) {
  return new Request('https://example.test/x', {
    method: 'POST',
    body: JSON.stringify({id}),
    headers: {'content-type': 'application/json'},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleBandApplicationDemo', () => {
  test.each([
    'https://youtube.com/shorts/U-nxqFuy2mk?feature=share',
    'https://www.youtube.com/shorts/U-nxqFuy2mk',
  ])('resolves YouTube Shorts link %s', async (demo) => {
    // Would otherwise be treated as the channel handle "shorts"
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    query.bandApplication.findFirst.mockResolvedValue({
      id: 'app1',
      demo,
    });

    const res = await handleBandApplicationDemo(request('app1'));

    expect(res.status).toBe(204);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(updates).toHaveBeenCalledWith(
      'BandApplication',
      {demoEmbed: 'U-nxqFuy2mk', demoEmbedType: 'YouTubeVideo'},
      ['app1'],
    );
  });
});
