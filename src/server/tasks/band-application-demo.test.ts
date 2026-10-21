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

/** Stub the Apify run-sync calls, one dataset per call in order. */
function mockApify(...datasets: unknown[]) {
  const fetchMock = vi.fn();
  for (const items of datasets) {
    fetchMock.mockResolvedValueOnce(Response.json(items));
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  process.env.APIFY_TOKEN = 'apify_api_test';
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

  test('resolves a Bandcamp track via Apify', async () => {
    const demo =
      'https://jeskobraun.bandcamp.com/track/das-leben-stellt-dich-blo';
    query.bandApplication.findFirst.mockResolvedValue({id: 'app1', demo});
    const fetchMock = mockApify([{type: 'track', id: 1759530840, url: demo}]);

    const res = await handleBandApplicationDemo(request('app1'));
    expect(res.status).toBe(204);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('service-paradis~bandcamp-crawler');
    expect(options.headers.Authorization).toBe('Bearer apify_api_test');
    expect(JSON.parse(options.body)).toEqual({
      startUrls: [{url: demo}],
      maxItems: 1,
      includeDiscography: false,
    });
    expect(updates).toHaveBeenCalledWith(
      'BandApplication',
      {demoEmbed: '1759530840', demoEmbedType: 'BandcampTrack'},
      ['app1'],
    );
  });

  test('resolves a Bandcamp artist page to its newest release', async () => {
    query.bandApplication.findFirst.mockResolvedValue({
      id: 'app1',
      demo: 'https://jeskobraun.bandcamp.com',
    });
    const albumUrl = 'https://jeskobraun.bandcamp.com/album/ode-et-al';
    const fetchMock = mockApify(
      [
        {
          type: 'artist',
          releases: [
            {url: albumUrl},
            {url: 'https://jeskobraun.bandcamp.com/track/ma-facture'},
          ],
        },
      ],
      [{type: 'album', id: 42, url: albumUrl}],
    );

    await handleBandApplicationDemo(request('app1'));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).startUrls).toEqual([
      {url: albumUrl},
    ]);
    expect(updates).toHaveBeenCalledWith(
      'BandApplication',
      {demoEmbed: '42', demoEmbedType: 'BandcampAlbum'},
      ['app1'],
    );
  });

  test('marks a Bandcamp URL Apify cannot find as unresolvable', async () => {
    query.bandApplication.findFirst.mockResolvedValue({
      id: 'app1',
      demo: 'https://jeskobraun.bandcamp.com/track/does-not-exist',
    });
    mockApify([]);

    await handleBandApplicationDemo(request('app1'));

    expect(updates).toHaveBeenCalledWith(
      'BandApplication',
      {demoEmbed: undefined, demoEmbedType: 'Unresolvable'},
      ['app1'],
    );
  });

  test('throws when Apify fails so Cloud Tasks retries', async () => {
    query.bandApplication.findFirst.mockResolvedValue({
      id: 'app1',
      demo: 'https://jeskobraun.bandcamp.com/album/ode-et-al',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('boom', {status: 502})),
    );

    await expect(handleBandApplicationDemo(request('app1'))).rejects.toThrow(
      'Apify HTTP502: boom',
    );
    expect(updates).not.toHaveBeenCalled();
  });
});
