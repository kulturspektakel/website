import {describe, expect, test} from 'vitest';
import {parseFollowerCount} from './instagram-follower';

describe('parseFollowerCount', () => {
  test('reads an exact, comma-grouped count (under 10,000)', () => {
    expect(
      parseFollowerCount(
        '2,570 Followers, 139 Following, 284 Posts - See Instagram photos and videos from Kulturspektakel Gauting (@kulturspektakel)',
      ),
    ).toBe(2570);
  });

  test('expands the abbreviations Instagram uses at 10,000 and above', () => {
    expect(parseFollowerCount('17K Followers, 2,192 Following')).toBe(17_000);
    expect(parseFollowerCount('1.5K Followers, 0 Following')).toBe(1500);
    expect(parseFollowerCount('2M Followers, 40 Following')).toBe(2_000_000);
  });

  test('returns null when the tag does not lead with a follower count', () => {
    expect(parseFollowerCount('See Instagram photos and videos')).toBeNull();
  });
});
