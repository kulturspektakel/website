import {describe, expect, it} from 'vitest';
import {
  defaultSelection,
  focusSelection,
  parseSelection,
  resolveSelection,
  toggledSelection,
} from './locationSelection';

// What the list opens on, what it opens on the second time, and what pressing a place in
// the roster does to it. The rules that meet here: a browser that has never chosen gets the
// first few places in display order, one that has gets exactly what it chose, and either
// way the list is never empty — the last card can't be taken off it.

const place = (id: string, locationName: string) => ({id, locationName});

// Deliberately not in name order, and with a pair that only sorts right if numbers are
// read as numbers: this is the order the loader hands them over in.
const locations = [
  place('c', 'Bühne 10'),
  place('a', 'Zeltbühne'),
  place('b', 'Bühne 2'),
  place('d', 'Aussenbühne'),
];

describe('defaultSelection', () => {
  it('takes the first three in display order', () => {
    expect(defaultSelection(locations)).toEqual(['d', 'b', 'c']);
  });

  it('takes what there is when a project has fewer', () => {
    expect(defaultSelection(locations.slice(0, 2))).toEqual(['c', 'a']);
    expect(defaultSelection([])).toEqual([]);
  });
});

describe('resolveSelection', () => {
  it('falls back to the default when nothing was ever stored', () => {
    expect(resolveSelection(null, locations)).toEqual(['d', 'b', 'c']);
  });

  it('falls back to the default rather than resolving to an empty list', () => {
    // Two ways to get there — an entry written before the list insisted on a card, and one
    // whose every place has since been deleted. Neither is an arrangement to restore.
    expect(resolveSelection([], locations)).toEqual(['d', 'b', 'c']);
    expect(resolveSelection(['gone'], locations)).toEqual(['d', 'b', 'c']);
  });

  it('drops ids whose location is gone and answers in display order', () => {
    expect(resolveSelection(['a', 'gone', 'b'], locations)).toEqual(['b', 'a']);
  });
});

describe('toggledSelection', () => {
  it('adds and removes, in display order and without the ghosts', () => {
    expect(toggledSelection(new Set(['b']), 'a', locations)).toEqual([
      'b',
      'a',
    ]);
    expect(
      toggledSelection(new Set(['b', 'a', 'gone']), 'a', locations),
    ).toEqual(['b']);
  });

  it('ignores the press that would empty the list', () => {
    expect(toggledSelection(new Set(['a']), 'a', locations)).toEqual(['a']);
    // Same thing when what is left over is only a place that no longer exists.
    expect(toggledSelection(new Set(['a', 'gone']), 'a', locations)).toEqual([
      'a',
    ]);
  });
});

describe('focusSelection', () => {
  it('is the pressed place alone, whatever else was on the list', () => {
    expect(focusSelection('a', locations)).toEqual(['a']);
  });

  it('is null when nothing was handed over, or when it no longer exists', () => {
    // Both mean the same thing to the list: nothing to override the stored selection with.
    expect(focusSelection(undefined, locations)).toBeNull();
    expect(focusSelection('gone', locations)).toBeNull();
  });
});

describe('parseSelection', () => {
  it('reads back what was stored', () => {
    expect(parseSelection(JSON.stringify(['b', 'a']))).toEqual(['b', 'a']);
    expect(parseSelection('[]')).toEqual([]);
  });

  it('is null for nothing stored', () => {
    expect(parseSelection(null)).toBeNull();
  });

  it('is null for anything it cannot use, so the default applies', () => {
    expect(parseSelection('{oops')).toBeNull();
    expect(parseSelection('{"a":1}')).toBeNull();
    expect(parseSelection('[1,2]')).toBeNull();
    expect(resolveSelection(parseSelection('{oops'), locations)).toEqual([
      'd',
      'b',
      'c',
    ]);
  });
});
