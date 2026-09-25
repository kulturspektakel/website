import type {DeviceWindows, NoiseProject} from './projectView';

export type NoiseRangeTag = NoiseProject['tags'][number];

/**
 * The tags that belong on one location's chart.
 *
 * A tag says what it applies to by which of its keys is set (see the schema), and each of
 * the three reaches this chart differently: the event's are on every chart, a location's on
 * its own, and a monitor's only where that monitor stood while the tag was running — a
 * device ignored during its hour at the main stage has nothing to say about the side stage
 * it was carried to afterwards.
 *
 * A marker (no end) is an instant, and stands where it is if the monitor was there then.
 */
export function locationTags(
  tags: readonly NoiseRangeTag[],
  locationId: string,
  lines: readonly DeviceWindows[],
): NoiseRangeTag[] {
  return tags.filter((tag) => {
    if (tag.deviceId == null) {
      return tag.locationId == null || tag.locationId === locationId;
    }
    const line = lines.find((l) => l.deviceId === tag.deviceId);
    const tagEnd = tag.end ?? tag.start;
    return (
      line?.windows.some(
        (w) => w.start <= tagEnd && (w.end == null || w.end > tag.start),
      ) ?? false
    );
  });
}

/**
 * Which of the monitors standing at a location are ignored at one instant — what a map
 * pin, which reads a single instant rather than a crop, has to leave out.
 *
 * A tag on the event or on the place ignores every monitor standing there; a device tag
 * only its own. Only ranges count, `start` inclusive and `end` exclusive like every other
 * window on the page: a marker is a note about an instant, not a stretch set aside.
 */
export function ignoredDevicesAt(
  tags: readonly NoiseRangeTag[],
  locationId: string,
  deviceIds: readonly string[],
  at: number,
): Set<string> {
  const ignored = new Set<string>();
  for (const tag of tags) {
    if (tag.type !== 'IGNORE' || tag.end == null) continue;
    if (tag.start > at || tag.end <= at) continue;
    if (tag.deviceId != null) {
      if (deviceIds.includes(tag.deviceId)) ignored.add(tag.deviceId);
    } else if (tag.locationId == null || tag.locationId === locationId) {
      return new Set(deviceIds);
    }
  }
  return ignored;
}
