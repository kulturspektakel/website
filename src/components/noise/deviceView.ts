import {createContext, useContext} from 'react';
import {type PickedSeries} from './level';
import {type SeriesKey} from './series';
import {type ReferenceMicSlice} from './useReferenceMic';

// What the device page is showing, picked in its toolbar (the device layout route) and
// read by the charts below it. Here rather than passed down because the toolbar and the
// view are siblings — the layout owns both — and because the choice has to survive the
// view being replaced.
//
// The same choice the project page's toolbar sets, and deliberately: a series means one
// thing across this section, so a monitor's chart and a location's row are read in the
// same terms.
//
// No `primary` here, unlike the project page's context: nothing on this page reads a
// single one. Its numbers are the tile row, which prints every series there is whatever
// is picked, so the pick is only ever the set of lines to draw and the set of tiles to
// light.
export type DeviceViewCtx = {
  // Which series the chart draws, in table order and never empty.
  picked: PickedSeries;
  // Adds or removes one — pressing a tile and ticking a box are the same commit.
  toggleSeries: (key: SeriesKey) => void;
  // The microphone on this computer that the monitor is being measured against, if any.
  // This page's alone — nowhere else in the section compares a monitor to anything — and
  // here for the same sibling reason as the pair above: it is picked in the toolbar's menu
  // and drawn by the chart underneath. Owned by the device route rather than the section
  // layout, so that navigating away releases it.
  referenceMic: ReferenceMicSlice;
};

export const DeviceViewContext = createContext<DeviceViewCtx | null>(null);

export function useDeviceView() {
  const ctx = useContext(DeviceViewContext);
  if (!ctx) {
    throw new Error('useDeviceView must be used within the device layout');
  }
  return ctx;
}
