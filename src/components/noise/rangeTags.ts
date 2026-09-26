import type {DeviceWindows, NoiseProject} from './projectView';

export type NoiseRangeTag = NoiseProject['tags'][number];

// How strongly a reading crew set aside is drawn — its line through the ignored stretch on
// the chart, and its badge on the card — so the two fade by the same amount and read as one
// statement: still there, not being counted.
export const IGNORED_OPACITY = 0.3;

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
  const scoped = tags.filter(
    (tag) =>
      tag.type === 'IGNORE' &&
      (tag.deviceId != null ||
        tag.locationId == null ||
        tag.locationId === locationId),
  );
  return new Set(deviceIds.filter((id) => ignoredAt(scoped, id, at)));
}

/**
 * Whether one monitor's reading at an instant (epoch ms) is set aside by any of `tags` —
 * which are already the ones reaching this place (see locationTags). A tag with no device
 * covers every monitor; a device tag only its own. `null` asks for a reading that is every
 * monitor's at once, like a chart's envelope, which only the former cover. Only ranges
 * count, `[start, end)` like every window on the page: a marker sets nothing aside.
 *
 * The one test the map's pins, a chart's faded lines and red wash, and both tooltips make.
 */
export function ignoredAt(
  tags: readonly {start: number; end: number | null; deviceId: string | null}[],
  deviceId: string | null,
  at: number,
): boolean {
  return tags.some(
    (tag) =>
      tag.end != null &&
      tag.start <= at &&
      at < tag.end &&
      (tag.deviceId == null || tag.deviceId === deviceId),
  );
}
