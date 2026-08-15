import {type CalCurve} from './referenceMic';

// The calibration files someone has dropped into the reference-microphone panel, kept in
// this browser. React-free and storage-free — every function here takes and returns a
// plain value, so the whole of it is testable and the hook is the only part that touches
// localStorage.
//
// Kept here rather than in the repo because a calibration file belongs to one physical
// capsule, not to the project: a file committed alongside the code is a file that will
// still be there, silently wrong, the day somebody measures with a different microphone.
//
// "A calibration file" means a miniDSP one, and the names below are more general than the
// contents: filing depends on the `SERNO:` header, so this module is where a second vendor's
// format would have to be understood. Hence the parser lives here, with the filing, rather
// than in referenceMic.ts, which only ever does arithmetic over a curve it is handed.

type UmikCalFile = {
  serial: string | null;
  // The header's per-unit trim, in dB — what the level is derived from, against the model's
  // own reference level (see ReferenceMic.calReferenceDb, which also records why that
  // reference is 100 dB and how to check it).
  sensFactorDb: number | null;
  cal: CalCurve;
};

/**
 * A miniDSP calibration file, as shipped: one header line naming the unit, then a
 * frequency and a deviation per line, tab-separated and ascending by frequency.
 *
 * Parsed on use rather than stored as an array, so that what is kept is the file itself and
 * a reader can diff it against the one that came with the microphone. Lines that are not two
 * numbers are skipped rather than fatal — the header is one of them, and a third phase column
 * appears in some of these files.
 */
export function parseUmikCal(text: string): UmikCalFile {
  const serial = /SERNO:\s*(\S+)/.exec(text)?.[1] ?? null;
  const sens = /Sens\s*Factor\s*=\s*(-?\.?\d*\.?\d+)\s*dB/i.exec(text)?.[1];
  const cal: Array<readonly [number, number]> = [];
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/[\s,]+/);
    if (parts.length < 2) continue;
    const hz = Number(parts[0]);
    const db = Number(parts[1]);
    if (!Number.isFinite(hz) || !Number.isFinite(db) || hz <= 0) continue;
    cal.push([hz, db]);
  }
  // Ascending, because interpolateCal walks the curve in order and a file that arrived out
  // of order would silently interpolate against the wrong pair.
  cal.sort((a, b) => a[0] - b[0]);
  return {
    serial,
    sensFactorDb: sens == null ? null : Number(sens),
    cal,
  };
}

export const CAL_STORAGE_KEY = 'lautstaerke.referenceMicCal';

// Below this a file is not a response curve, whatever else it might be. A real one carries
// hundreds of points; this only has to be high enough that a stray text file dropped on the
// panel is refused with a reason rather than stored as a two-point microphone.
const MIN_CAL_POINTS = 32;

export type CalStore = {
  // The dropped file, verbatim, under the serial number read out of its own header. Stored
  // as text and re-parsed on use, not as a parsed curve: the file is the artefact somebody
  // can compare against the one miniDSP sent, and a later fix to the parser then applies to
  // files already here.
  files: Record<string, string>;
  /**
   * Which serial an input was last used with, under the browser's id for that input.
   *
   * This is the only way choosing can ever be automatic, and it is worth being plain about
   * why. Nothing about a connected UMIK-1 discloses its serial: the browser offers a label
   * ("Umik-1  Gain: 18dB") and an id that is a per-origin hash, and even at the USB level
   * the unit reports its serial as "00002". The serial exists in one place only — inside
   * the file. So the pairing is learned the first time it is used and remembered here.
   *
   * The id is stable for as long as the microphone permission grant is, which is what makes
   * remembering it worth anything; when it changes, the pairing is simply learned again.
   */
  devices: Record<string, string>;
};

export const emptyCalStore = (): CalStore => ({files: {}, devices: {}});

/**
 * What was in storage, or an empty store.
 *
 * Never throws and never propagates a shape it does not recognise. What is in localStorage
 * under our key was written by an older version of this code, or by hand, or by nothing at
 * all — and a calibration panel that cannot open because of it would be worse than one that
 * has forgotten a file.
 */
export function readCalStore(raw: string | null): CalStore {
  if (raw == null) return emptyCalStore();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object') return emptyCalStore();
    const {files, devices} = parsed as Partial<CalStore>;
    return {
      files: stringRecord(files),
      devices: stringRecord(devices),
    };
  } catch {
    return emptyCalStore();
  }
}

const stringRecord = (value: unknown): Record<string, string> => {
  if (value == null || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string' && k !== '') out[k] = v;
  }
  return out;
};

export const serialiseCalStore = (store: CalStore): string =>
  JSON.stringify(store);

export type CalImport =
  | {ok: true; store: CalStore; serial: string; points: number}
  | {ok: false; reason: string};

/**
 * Take a dropped file into the store, under the serial it names itself by.
 *
 * The serial is required rather than defaulted, and that is the whole reason this can
 * refuse: a file with no `SERNO:` header cannot be filed against a microphone, and filing
 * it under a made-up key would produce a curve that silently follows whichever capsule
 * happened to be plugged in next.
 *
 * Replacing an existing file for the same serial is allowed and is not worth confirming —
 * miniDSP reissues these, and the newer one for a given unit is the one that was wanted.
 */
export function storeCalFile(store: CalStore, text: string): CalImport {
  const parsed = parseUmikCal(text);
  if (parsed.serial == null) {
    return {
      ok: false,
      reason: 'Keine Seriennummer in der Datei (Zeile „SERNO:“ fehlt).',
    };
  }
  if (parsed.cal.length < MIN_CAL_POINTS) {
    return {
      ok: false,
      reason: `Nur ${parsed.cal.length} Messpunkte gefunden — das sieht nicht nach einer Kalibrierungsdatei aus.`,
    };
  }
  return {
    ok: true,
    serial: parsed.serial,
    points: parsed.cal.length,
    store: {
      ...store,
      files: {...store.files, [parsed.serial]: text},
    },
  };
}

export const rememberDevice = (
  store: CalStore,
  deviceId: string,
  serial: string,
): CalStore => ({
  ...store,
  devices: {...store.devices, [deviceId]: serial},
});

// "This input, deliberately without a calibration." A recorded choice and not the absence
// of one, which is why it needs a value of its own: deleting the pairing instead would let
// the single-file rule below pick the file straight back up, and the choice would read as
// having been ignored.
const NO_CAL = '';

export const unpairDevice = (store: CalStore, deviceId: string): CalStore =>
  rememberDevice(store, deviceId, NO_CAL);

/**
 * Which stored calibration to use for one input, if it can be settled without asking.
 *
 * Three ways it can be, in order. An earlier choice for this input wins, including an
 * earlier choice of *none*. Failing that, a single stored file is taken as the one meant —
 * with one microphone and one file there is nothing to choose between, and making somebody
 * choose anyway would be a dialogue with one option in it.
 *
 * Null when several files are stored and this input has not been seen before, which is the
 * one case that genuinely needs a person: any guess there is a curve from the wrong capsule.
 *
 * Returns the serial and not the curve. Parsing is what reading a curve costs, and the caller
 * needs the file's header as well as its curve, so it parses once itself (see the hook's
 * `calibration` memo) rather than having a throwaway parse done here.
 */
export function resolveCal(store: CalStore, deviceId: string): string | null {
  const paired = store.devices[deviceId];
  if (paired === NO_CAL) return null;
  // The file has to still be there. Nothing in here deletes one, but what is under our
  // storage key was written by an older version of this code or edited by hand, and a
  // pairing naming a file that is not there must fall through rather than resolve to it.
  if (paired != null && store.files[paired] != null) return paired;
  const serials = Object.keys(store.files);
  return serials.length === 1 ? serials[0]! : null;
}

export const storedSerials = (store: CalStore): string[] =>
  Object.keys(store.files).sort();
