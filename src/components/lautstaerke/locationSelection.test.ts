import {describe, expect, it} from 'vitest';
import {
  defaultSelection,
  parseSelection,
  resolveSelection,
} from './locationSelection';

// What the list opens on, and what it opens on the second time. Two rules meet here: a
// browser that has never chosen gets the first few places in display order, and one that
// has gets exactly what it chose — including having chosen nothing.

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

  it('keeps a stored empty selection empty', () => {
    // Deselecting everything is a choice the list has a message for; putting three cards
    // back on the next reload would undo it.
    expect(resolveSelection([], locations)).toEqual([]);
  });

  it('drops ids whose location is gone and answers in display order', () => {
    expect(resolveSelection(['a', 'gone', 'b'], locations)).toEqual(['b', 'a']);
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
