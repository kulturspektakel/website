// The section's react-query keys, in one place.
//
// These were bare string literals spread over three files, and two of them
// coordinate across files that don't otherwise know about each other: the
// unassigned-monitor list on the index page and the assign menu on a project
// page share `assignableDevices` so that assigning a device updates both.
//
// The shapes are deliberately flat rather than nested under a common prefix, so that
// invalidating one can't evict another (see projectLogs below).
export const noiseQueryKeys = {
  projects: ['noiseProjects'] as const,
  assignableDevices: ['assignableNoiseDevices'] as const,
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
