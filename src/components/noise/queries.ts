// The section's react-query keys, in one place.
//
// These were bare string literals spread over three files, and keeping them here is
// what lets two components that don't know about each other invalidate the same data.
//
// The shapes are deliberately flat rather than nested under a common prefix, so that
// invalidating one can't evict another (see projectLogs below).
export const noiseQueryKeys = {
  projects: ['noiseProjects'] as const,
  // Monitors with no open assignment anywhere — offered by the map's create-location
  // dialog, which is placing a spot that has nobody standing at it yet.
  assignableDevices: ['assignableNoiseDevices'] as const,
  // Every monitor, assigned or not — the assignments dialog's picker. Separate from
  // `assignableDevices` because the two answer different questions.
  //
  // The set itself changes only when a monitor first reports in, but the payload now
  // carries where each one is standing (see noiseMonitorDevices), which an assignment
  // edit changes — so what is cached here can lag one, and nothing invalidates it. The
  // pickers that read it show names and do not mind. The landing page's device list does
  // mind, and so reads the same server function through its route loader instead.
  monitorDevices: ['noiseMonitorDevices'] as const,
  project: (projectId: string) => ['noiseProject', projectId] as const,
  // A project's whole stored history, and deliberately keyed on nothing else. The
  // timeframe isn't in it because the payload covers the entire event and the page
  // slices it locally; the weighting and the Leq window aren't because every column
  // travels. So this is fetched once and then answers scrubbing, cropping, zooming
  // and both header dropdowns without coming back.
  //
  // Outside `project` for the same reason as everything else here: the invalidation
  // after an assignment change must not evict measurements, which are immutable once
  // recorded and expensive to re-read.
  projectLogs: (projectId: string) => ['noiseProjectLogs', projectId] as const,
};
