import {beforeEach, describe, expect, test, vi} from 'vitest';

const {prismaMock} = vi.hoisted(() => ({
  prismaMock: {
    bandApplication: {findUniqueOrThrow: vi.fn(), update: vi.fn()},
  },
}));

vi.mock('../../server/prismaClient.server', () => ({prismaClient: prismaMock}));

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
  prismaMock.bandApplication.update.mockResolvedValue({});
});

describe('handleBandApplicationDemo', () => {
  test.each([
    'https://youtube.com/shorts/U-nxqFuy2mk?feature=share',
    'https://www.youtube.com/shorts/U-nxqFuy2mk',
  ])('resolves YouTube Shorts link %s', async (demo) => {
    // Would otherwise be treated as the channel handle "shorts"
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    prismaMock.bandApplication.findUniqueOrThrow.mockResolvedValue({
      id: 'app1',
      demo,
    });

    const res = await handleBandApplicationDemo(request('app1'));

    expect(res.status).toBe(204);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prismaMock.bandApplication.update).toHaveBeenCalledWith({
      where: {id: 'app1'},
      data: {demoEmbed: 'U-nxqFuy2mk', demoEmbedType: 'YouTubeVideo'},
    });
  });
});
