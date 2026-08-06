// The section's react-query keys, in one place.
//
// These were bare string literals spread over three files, and two of them
// coordinate across files that don't otherwise know about each other: the
// unassigned-monitor list on the index page and the assign menu on a project
// page share `assignableDevices` so that assigning a device updates both.
//
// The shapes are deliberately flat rather than nested under a common prefix.
// `levelsAt` must NOT sit under `project`, or the invalidation that runs after
// every assignment change would also evict every minute the user has scrubbed
// through — those are immutable once measured and worth keeping.
export const noiseQueryKeys = {
  projects: ['noiseProjects'] as const,
  assignableDevices: ['assignableNoiseDevices'] as const,
  project: (projectId: string) => ['noiseProject', projectId] as const,
  levelsAt: (projectId: string, minuteMs: number) =>
    ['noiseLevelsAt', projectId, minuteMs] as const,
};
