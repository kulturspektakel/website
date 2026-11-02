import {describe, expect, test} from 'vitest';
import {parseInstagramHandle} from './instagramHandle';

describe('parseInstagramHandle', () => {
  test.each([
    ['@kulturspektakel', 'kulturspektakel'],
    ['www.Instagram.com/fishandscale', 'fishandscale'],
    ['https://www.instagram.com/kulturspektakel/?hl=de', 'kulturspektakel'],
    ['https://instagram.com/stories/kulturspektakel/3456789', 'kulturspektakel'],
    ['', undefined],
    ['https://www.instagram.com/p/C1a2b3c4/', null],
    ['https://instagram.com/stories/', null],
  ])('%j → %j', (input, expected) => {
    expect(parseInstagramHandle(input)).toBe(expected);
  });
});
