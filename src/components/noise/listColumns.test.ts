import {describe, expect, it} from 'vitest';
import {parseColumns} from './listColumns';

// What a stored count means. The only rule with any weight: anything that isn't one of the
// counts offered is null, so the view falls back to one column rather than laying its cards
// out in whatever was in localStorage.
describe('parseColumns', () => {
  it('reads back a count that is offered', () => {
    expect(parseColumns('1')).toBe(1);
    expect(parseColumns('3')).toBe(3);
  });

  it('is null for nothing stored and for anything it cannot use', () => {
    expect(parseColumns(null)).toBeNull();
    // A count from a version that offered more of them, a leftover from the search param
    // days, and a value that was never a number.
    expect(parseColumns('4')).toBeNull();
    expect(parseColumns('0')).toBeNull();
    expect(parseColumns('zwei')).toBeNull();
  });
});
