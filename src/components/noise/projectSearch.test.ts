import {describe, expect, it} from 'vitest';
import {
  projectSearchFor,
  projectSearchSelection,
  validateProjectSearch,
} from './projectSearch';

// What the project page's URL says about the window being looked at. The values arrive
// already parsed (the router's own parseSearch turns `live=false` into a boolean and
// `from=…` into a number), so these are about which of them count as a pick — and about
// the playhead, which is not in the URL and so has to survive one arriving.

const from = Date.parse('2026-07-25T18:00:00Z');
const to = Date.parse('2026-07-25T20:00:00Z');

describe('validateProjectSearch', () => {
  it('reads a live page as one with nothing pinned', () => {
    expect(validateProjectSearch({})).toEqual({});
    expect(projectSearchSelection(validateProjectSearch({}), null)).toBeNull();
  });

  // Half a range would otherwise be resolved against the window and read as a crop the
  // user made, which pins the page to it.
  it('drops a range missing one of its ends', () => {
    expect(validateProjectSearch({live: false, from}).from).toBeUndefined();
    expect(
      projectSearchSelection(validateProjectSearch({to}), null),
    ).toBeNull();
  });

  it('ignores anything that is not an instant', () => {
    expect(validateProjectSearch({from: 'gestern', to: -1})).toEqual({});
  });
});

describe('projectSearchSelection', () => {
  const search = {live: false, from, to} as const;

  // A pinned link opened cold has no cursor to keep and does not invent one: a URL
  // carries the window, and the playhead is where a pointer is.
  it('arrives with no playhead when there is no page to keep one from', () => {
    expect(projectSearchSelection(search, null)).toEqual({
      start: from,
      end: to,
      current: null,
    });
  });

  // Whether one the crop has left behind is pulled to the nearest edge is
  // setSelectionCurrent's, and projectSelection's own tests own it.
  it('keeps a playhead the arriving crop still contains', () => {
    const at = from + 60_000;
    expect(
      projectSearchSelection(search, {start: from, current: at, end: to}),
    ).toEqual({start: from, end: to, current: at});
  });
});

describe('projectSearchFor', () => {
  const selection = {start: from, current: from + 60_000, end: to};

  // Live carries no crop: the pick survives the switch in state, and a URL that named
  // both would be saying two different things about what is on screen.
  it('says nothing at all while live', () => {
    expect(projectSearchFor(true, selection)).toEqual({});
  });

  // The playhead is left out of the URL, so a scrub inside a crop writes the same search
  // as the crop it is in — which is what keeps hovering a chart from navigating at all.
  it('carries the crop and not the instant inside it', () => {
    expect(projectSearchFor(false, selection)).toEqual({
      live: false,
      from,
      to,
    });
    expect(projectSearchFor(false, {...selection, current: to})).toEqual(
      projectSearchFor(false, selection),
    );
  });

  it('pins the page without a pick when nothing has been picked yet', () => {
    expect(projectSearchFor(false, null)).toEqual({live: false});
  });
});
