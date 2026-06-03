import {describe, expect, test} from 'vitest';
import {extractFbid} from './tasks.facebook-likes';

describe('extractFbid', () => {
  test('returns the page slug for a vanity URL', async () => {
    expect(await extractFbid('https://facebook.com/kulturspektakel')).toBe(
      'kulturspektakel',
    );
  });

  test('reads the numeric id from profile.php', async () => {
    expect(
      await extractFbid('https://www.facebook.com/profile.php?id=123456789'),
    ).toBe('123456789');
  });

  test('reads the id segment from a /pages/Name/ID URL', async () => {
    expect(
      await extractFbid('https://facebook.com/pages/Some-Band/100000000123'),
    ).toBe('100000000123');
  });

  test('ignores non-facebook hosts', async () => {
    expect(await extractFbid('https://example.com/band')).toBeUndefined();
  });
});
