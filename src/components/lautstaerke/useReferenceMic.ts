import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {toaster} from '../chakra-snippets/toaster';
import {errorMessage, errorToast} from './toast';
import {
  audioInputOptions,
  bandBins,
  bandDb,
  createBandAccumulator,
  DEVICE_FFT_SIZE,
  DEVICE_SAMPLE_RATE,
  isMicCaptureSupported,
  NOMINAL_SENSITIVITY_DB,
  refCorrectionBands,
  referenceMicFor,
  sensitivityFromSensFactor,
  settingsWarnings,
  type AudioInputOption,
  type BandAccumulator,
  type ReferenceMic,
} from './referenceMic';
import {useLatest} from './chartUtils';
import {
  CAL_STORAGE_KEY,
  emptyCalStore,
  parseUmikCal,
  readCalStore,
  rememberDevice,
  resolveCal,
  serialiseCalStore,
  storeCalFile,
  storedSerials,
  unpairDevice,
  type CalStore,
} from './referenceMicStore';

// Capturing one input off this computer and turning it into a band spectrum the device
// page can draw beside the monitor's own. The arithmetic all lives in referenceMic.ts —
// what is here is the browser: permission, the audio graph, and the several ways a
// microphone stops working while you are using it.
//
// Owned by the device route rather than by the /crew/lautstaerke layout, unlike the
// Bluetooth slice. The link to a monitor belongs to the layout because its records feed
// the shared ingest and leaving the section should not drop it; a microphone is the
// opposite on both counts — nothing else in the section reads it, and it *should* be
// released the moment you navigate away, because the browser's recording indicator stays
// lit until it is. Closing the panel that picked it releases it for the same reason.

// How often a frame is taken, which comes out at ~22 a second. The device runs its FFT
// every 2048 samples — 42.7 ms, a 50 % overlap of its 4096-point window — so this is the
// same cadence over the same window length.
//
// An interval rather than requestAnimationFrame, for two reasons that both cut the same
// way: rAF ties the number of frames per second to the display's refresh rate, and it
// stops entirely in a background tab, where this degrades to one throttled frame instead
// of none. Neither biases the average — it is a mean over linear power, so a frame skipped
// costs variance and not accuracy — but "no frames at all" has to travel up as null, and
// a tab nobody is looking at is exactly when that is hardest to notice.
const FRAME_MS = 45;

export type ReferenceMicSlice = {
  // Whether this browser can capture at all. False until the first effect runs, so that
  // the server and the first client paint agree (see useBleDevice, same reason).
  supported: boolean;
  // The picked input, or null for none — which is the default, and the teardown path.
  selected: AudioInputOption | null;
  // Every input worth offering. Refreshed on demand rather than on a timer, because only an
  // open panel cares — and the names are only there at all once grant() has run, which is
  // why the panel is never opened before it has.
  options: AudioInputOption[];
  starting: boolean;
  // The entry in REFERENCE_MICS the selected input matched, if any.
  mic: ReferenceMic | null;
  // The serial of the calibration file in use, and every serial there is a file for. Null
  // when the selected input has no file to go with it — either none has been dropped, or
  // several have and this input has not been paired with one yet.
  calSerial: string | null;
  serials: string[];
  /** Take a dropped file into storage and use it for the current input. */
  importCal: (text: string) => void;
  /** Use a stored file for the current input, remembering the pairing. */
  useCal: (serial: string | null) => void;
  // dB SPL at full scale, worked out from the calibration file. Nothing sets this by hand:
  // there is no number here a person knows better than the file does.
  sensitivityDb: number;
  // Whether that is a real figure rather than the nominal stand-in — which is to say whether
  // both halves are present, a microphone whose convention we know and its own file. False
  // means the curve's shape is worth something and its dB values are not.
  calibrated: boolean;
  // What the audio graph actually got, which is not always what was asked for.
  sampleRate: number | null;
  warning: string | null;
  select: (option: AudioInputOption | null) => Promise<void>;
  refresh: () => Promise<void>;
  /**
   * Whether the panel that picks all this is showing — and the whole of the feature's
   * lifetime, which is why it lives here and not as a `useState` in whichever component
   * happens to render the panel.
   *
   * `open()` asks for the microphone before showing anything, so the prompt belongs to the
   * press that wanted it and the panel never appears unable to list a single input. `close()`
   * hands the input back. Together they are the invariant — closed implies nothing held open,
   * and so no recording indicator lit behind a page nobody is looking at — and having them
   * here means a second way to close the panel cannot forget half of it.
   */
  panelOpen: boolean;
  open: () => Promise<void>;
  close: () => void;
  /**
   * The band levels since the last call, in dB SPL, or null if no frame arrived. Called
   * once a second by the chart, whose tick is therefore what bounds the average — the same
   * clock the monitor's own bars are drawn on, so the two are always the same second.
   */
  drain: () => (number | null)[] | null;
};

export function useReferenceMic(): ReferenceMicSlice {
  const [supported, setSupported] = useState(false);
  const [selected, setSelected] = useState<AudioInputOption | null>(null);
  const [options, setOptions] = useState<AudioInputOption[]>([]);
  const [starting, setStarting] = useState(false);
  const [sampleRate, setSampleRate] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  // Calibration files live in this browser, not in the repo: a response curve belongs to one
  // physical capsule. Empty until the effect below reads storage, because this hook renders
  // on the server too.
  const [cals, setCals] = useState<CalStore>(emptyCalStore);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    try {
      setCals(readCalStore(localStorage.getItem(CAL_STORAGE_KEY)));
    } catch {
      // Private-mode Safari throws on localStorage. A panel with no remembered files is a
      // working panel; one that threw on mount is not.
    }
  }, []);

  useEffect(() => setSupported(isMicCaptureSupported()), []);

  // One context for the page. Chrome caps how many a document may have open at once, so a
  // new one per pick would run the page out of them after a handful of tries; only the
  // three nodes below are rebuilt on a change.
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Held for the whole session, not because anything reads them again, but because a
  // source node with no reference left to it has been collected — and then goes silent —
  // in more than one browser.
  const nodesRef = useRef<AudioNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const framesRef = useRef<BandAccumulator | null>(null);
  // One buffer for the life of the input, refilled in place ~22 times a second. Allocating
  // it per frame would be 8 KB of immediate garbage every 45 ms — 178 KB/s on a page that is
  // also decoding records and redrawing two charts.
  const spectrumRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  // Bumped by every teardown, so a getUserMedia that resolves after one — StrictMode
  // mounts every effect twice in development, and the second mount's cleanup runs while
  // the first mount's request is still in flight — knows to stop its own tracks rather
  // than install a microphone nobody asked for and nothing will switch off.
  const generationRef = useRef(0);

  const mic = useMemo(
    () => referenceMicFor(selected?.label) ?? null,
    [selected],
  );
  // Everything the calibration file contributes, from one parse: its header sets the level
  // and its curve the per-band correction. Keyed on the file's text rather than on the store,
  // so remembering a pairing — which touches only `devices` — does not re-read 615 lines. The
  // curve itself is not kept: it is 615 pairs, the 31 corrections are what anything downstream
  // wants, and this way it can be collected as soon as it has been interpolated.
  // Read out of the store rather than held beside it. Every path that changes which file
  // applies — picking an input, dropping a file, choosing one by hand — records the pairing
  // in `devices`, and resolveCal is what reads it back; a second copy in state would be four
  // writers keeping a cache honest about something it is a copy of.
  const calSerial =
    selected == null ? null : resolveCal(cals, selected.deviceId);
  const calText = calSerial == null ? null : (cals.files[calSerial] ?? null);
  const calibration = useMemo(() => {
    const parsed = calText == null ? null : parseUmikCal(calText);
    return {
      sensFactorDb: parsed?.sensFactorDb ?? null,
      // Always a full set, zeroes and all, so bandDb needs no per-index fallback.
      correction: refCorrectionBands(parsed?.cal ?? []),
    };
  }, [calText]);
  const {correction} = calibration;

  // The sensitivity the file implies, which is the whole point of knowing a model's Sens
  // Factor convention: with a recognised microphone and its own file, the level calibrates
  // itself and there is nothing to ask. Null when either half is missing, and the nominal
  // then stands in — only so the curve lands somewhere visible, never as a claim.
  const derivedSensitivityDb =
    mic == null || calibration.sensFactorDb == null
      ? null
      : sensitivityFromSensFactor(calibration.sensFactorDb, mic.calReferenceDb);
  const sensitivityDb = derivedSensitivityDb ?? NOMINAL_SENSITIVITY_DB;
  // Read by the drain below, which runs on the chart's clock rather than in a render, so a
  // newly dropped calibration takes effect from the next tick on.
  const scaleRef = useLatest({sensitivityDb, correction});

  // Read by refresh and by the devicechange handler, both of which outlive any one render.
  const selectedRef = useLatest(selected);
  // Not merely an identity optimisation, which is why this one is written by hand: select()
  // reads it *after* an await, and persistCals writes it synchronously below, so two imports
  // landing in one tick do not lose the first.
  const calsRef = useRef(cals);
  calsRef.current = cals;

  // State and storage together, because a stored file that is not in state has not been
  // taken and one in state that is not stored will not survive the panel closing.
  const persistCals = useCallback((next: CalStore) => {
    setCals(next);
    calsRef.current = next;
    try {
      localStorage.setItem(CAL_STORAGE_KEY, serialiseCalStore(next));
    } catch (e) {
      // Out of quota, or a browser that refuses storage. The file still applies for this
      // session, so this is a warning about the future rather than a failure now.
      errorToast('Kalibrierung konnte nicht gespeichert werden')(e);
    }
  }, []);

  // Everything that stops being true when there is no input, in one place: three paths used
  // to spell this out and had already diverged — the unplug handler left `warning` behind, so
  // a sample-rate complaint outlived the microphone it was about.
  const clearSelection = useCallback(() => {
    setSelected(null);
    setSampleRate(null);
    setWarning(null);
  }, []);

  const releaseInput = useCallback(() => {
    generationRef.current++;
    for (const node of nodesRef.current) {
      try {
        node.disconnect();
      } catch {}
    }
    nodesRef.current = [];
    analyserRef.current = null;
    framesRef.current = null;
    spectrumRef.current = null;
    // The tracks, not just the graph: the tab's recording indicator follows the track and
    // not the AudioContext, so a page that only disconnected would look like it is still
    // listening — on a crew tool, indistinguishable from a bug.
    for (const track of streamRef.current?.getTracks() ?? []) {
      try {
        track.stop();
      } catch {}
    }
    streamRef.current = null;
  }, []);

  const refresh = useCallback(async () => {
    if (navigator.mediaDevices?.enumerateDevices == null) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const next = audioInputOptions(devices, selectedRef.current);
      // Keeping the previous array when the list has not actually changed is what makes
      // this callable from an effect: a new array every time would be a new slice, a new
      // context, and a re-render that asks again — which is a loop, not a refresh.
      setOptions((prev) => (sameOptions(prev, next) ? prev : next));
    } catch (e) {
      errorToast('Audiogeräte konnten nicht gelesen werden')(e);
    }
  }, []);

  const select = useCallback(
    async (option: AudioInputOption | null) => {
      releaseInput();
      if (option == null) {
        clearSelection();
        return;
      }
      setWarning(null);
      const generation = generationRef.current;
      setStarting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: {exact: option.deviceId},
            // The three that would make the comparison meaningless rather than merely
            // offset. Asking is not the same as getting, which is why the settings come
            // back out below.
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            // Deliberately no channelCount: it would ask the browser for the very
            // downmix the splitter below exists to avoid.
          },
        });
        // Another pick, or an unmount, happened while the prompt was up. Give the
        // microphone back rather than leaving it running behind a stale selection.
        if (generation !== generationRef.current) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;

        const ctx = ctxRef.current ?? openContext();
        ctxRef.current = ctx;
        // A context created outside a gesture — or reused after the browser suspended it —
        // reports every bin as −Infinity and says nothing about why.
        if (ctx.state !== 'running') await ctx.resume();

        const source = ctx.createMediaStreamSource(stream);
        // An AnalyserNode downmixes its input to mono as though it were a pair of
        // speakers, whatever its own channel settings say — so a two-in interface with
        // the microphone on the first channel alone would read 6 dB low. Splitting and
        // taking output 0 is the only way past that. A mono input is up-mixed discretely,
        // so output 0 is the signal either way, and channels beyond the second are out of
        // scope: a reference microphone is plugged into the first one.
        const splitter = ctx.createChannelSplitter(2);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = DEVICE_FFT_SIZE;
        // Our own average is taken over power, one second at a time. Web Audio's smoothing
        // is an exponential one over magnitudes, which is neither.
        analyser.smoothingTimeConstant = 0;
        source.connect(splitter);
        splitter.connect(analyser, 0);
        nodesRef.current = [source, splitter, analyser];

        framesRef.current = createBandAccumulator(
          bandBins(ctx.sampleRate, analyser.fftSize),
        );
        spectrumRef.current = new Float32Array(
          new ArrayBuffer(
            analyser.frequencyBinCount * Float32Array.BYTES_PER_ELEMENT,
          ),
        );
        analyserRef.current = analyser;

        // Which stored calibration this input gets, written down so that the next connect
        // needs no answer — the serial cannot be read off the microphone (see
        // CalStore.devices), so being asked once is the price of ever being asked once.
        // Writing it is also what *selects* it: calSerial reads back out of the store.
        const resolved = resolveCal(calsRef.current, option.deviceId);
        // Only when it is news. The common case is a pairing written last time, and rewriting
        // it would serialise every stored file to localStorage and hand the page a new store
        // — which re-parses the calibration and re-renders everything below — to say what it
        // already said.
        if (
          resolved != null &&
          calsRef.current.devices[option.deviceId] !== resolved
        ) {
          persistCals(
            rememberDevice(calsRef.current, option.deviceId, resolved),
          );
        }

        setSelected(option);
        setSampleRate(ctx.sampleRate);
        setWarning(
          describeWarnings(
            ctx.sampleRate,
            stream.getAudioTracks()[0]?.getSettings() ?? {},
          ),
        );

        // The stream can end without anything failing: the microphone was unplugged, or
        // the operating system took it away.
        const track = stream.getAudioTracks()[0];
        track?.addEventListener('ended', () => {
          if (generation !== generationRef.current) return;
          releaseInput();
          clearSelection();
          toaster.create({
            type: 'info',
            title: 'Referenzmikrofon getrennt',
            description: option.label,
          });
        });
      } catch (e) {
        releaseInput();
        clearSelection();
        reportCaptureError(e);
      } finally {
        setStarting(false);
      }
    },
    [releaseInput, clearSelection, persistCals],
  );

  /**
   * Take a dropped calibration file, and use it for whatever is selected.
   *
   * Filed under the serial in its own header, which is the only place that serial exists —
   * so this is also the moment the current input gets paired with it.
   */
  const importCal = useCallback(
    (text: string) => {
      const result = storeCalFile(calsRef.current, text);
      if (!result.ok) {
        toaster.create({
          type: 'error',
          title: 'Keine Kalibrierungsdatei',
          description: result.reason,
        });
        return;
      }
      // Paired as well as stored, which is what puts it in use — see calSerial. The panel
      // only offers this once an input is picked, so there is always something to pair with.
      const deviceId = selectedRef.current?.deviceId;
      persistCals(
        deviceId == null
          ? result.store
          : rememberDevice(result.store, deviceId, result.serial),
      );
      toaster.create({
        type: 'success',
        title: `Kalibrierung ${result.serial}`,
        description: `${result.points} Messpunkte übernommen`,
      });
    },
    [persistCals],
  );

  // Picking one by hand, for the case resolveCal will not guess: several files stored and an
  // input it has not seen. Null is a choice too, and recorded as one — recording it in the
  // store is the whole of the change, since that is where calSerial reads from.
  const useCal = useCallback(
    (serial: string | null) => {
      const deviceId = selectedRef.current?.deviceId;
      // Nothing to pair it with, and so nowhere to put the answer. The panel disables the
      // control in that state rather than leaving a click that does nothing.
      if (deviceId == null) return;
      persistCals(
        serial == null
          ? unpairDevice(calsRef.current, deviceId)
          : rememberDevice(calsRef.current, deviceId, serial),
      );
    },
    [persistCals],
  );

  /**
   * Ask for the names, and only when the answer is that we already have them.
   *
   * enumerateDevices() needs no permission, but until this document has captured once it
   * reports every input with a blank name — so the list cannot be built without a capture,
   * and a capture is what raises the prompt. Where the grant is already stored, priming it
   * costs a moment with the microphone open and raises nothing; where it is not, this is
   * the click the reader pressed to allow it. Either way it happens here and nowhere else,
   * so opening the page prompts for nothing.
   */
  const grant = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      for (const track of stream.getTracks()) track.stop();
      await refresh();
      return true;
    } catch (e) {
      reportCaptureError(e);
      return false;
    }
  }, [refresh]);

  /**
   * Show the panel, once there is something to show in it.
   *
   * enumerateDevices() reports every input with a blank name until this document has captured
   * once, so the names have to be earned before the list is worth rendering — and earning
   * them is what may raise the prompt. Nothing else in the feature calls getUserMedia
   * speculatively, so opening the page prompts for nothing.
   */
  const open = useCallback(async () => {
    if (await grant()) setPanelOpen(true);
  }, [grant]);

  const close = useCallback(() => {
    setPanelOpen(false);
    void select(null);
  }, [select]);

  // Frames, for as long as something is selected. Reading the analyser through a ref
  // rather than a dependency keeps a re-render from restarting the interval mid-second.
  useEffect(() => {
    if (selected == null) return;
    const id = setInterval(() => {
      const analyser = analyserRef.current;
      const frames = framesRef.current;
      // Nothing to read from a context the browser has parked — and it would answer with
      // −Infinity across the board rather than an error.
      if (!analyser || !frames || ctxRef.current?.state !== 'running') return;
      const spectrum = spectrumRef.current;
      if (!spectrum) return;
      analyser.getFloatFrequencyData(spectrum);
      frames.accumulate(spectrum);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [selected]);

  // Safari parks the context on a phone call or a screen lock, in a state that is not in
  // the specification's list, and says nothing further. Without this the line simply
  // stops moving.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (ctx == null || selected == null) return;
    const onChange = () => {
      if (ctx.state !== 'running') {
        void ctx.resume().catch(() => {});
      }
    };
    ctx.addEventListener('statechange', onChange);
    return () => ctx.removeEventListener('statechange', onChange);
  }, [selected]);

  // A microphone appearing or going away changes the list, and may take the selected one
  // with it — the ended listener above catches the stream dying, this catches the entry
  // disappearing.
  useEffect(() => {
    const media = navigator.mediaDevices;
    if (media?.addEventListener == null) return;
    const onChange = () => void refresh();
    media.addEventListener('devicechange', onChange);
    return () => media.removeEventListener('devicechange', onChange);
  }, [refresh]);

  useEffect(
    () => () => {
      releaseInput();
      const ctx = ctxRef.current;
      ctxRef.current = null;
      if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
    },
    [releaseInput],
  );

  const drain = useCallback((): (number | null)[] | null => {
    const mean = framesRef.current?.drain();
    return mean == null ? null : bandDb(mean, scaleRef.current);
  }, []);

  return useMemo(
    () => ({
      supported,
      selected,
      options,
      starting,
      mic,
      calSerial,
      serials: storedSerials(cals),
      importCal,
      useCal,
      sensitivityDb,
      calibrated: derivedSensitivityDb != null,
      sampleRate,
      warning,
      select,
      refresh,
      grant,
      panelOpen,
      open,
      close,
      drain,
    }),
    [
      supported,
      selected,
      options,
      starting,
      mic,
      cals,
      calSerial,
      importCal,
      useCal,
      derivedSensitivityDb,
      sampleRate,
      warning,
      select,
      refresh,
      grant,
      panelOpen,
      open,
      close,
      drain,
    ],
  );
}

const sameOptions = (
  a: readonly AudioInputOption[],
  b: readonly AudioInputOption[],
): boolean =>
  a.length === b.length &&
  a.every((o, i) => o.deviceId === b[i]!.deviceId && o.label === b[i]!.label);

/**
 * A context at the monitor's own sample rate if the browser will give us one.
 *
 * Worth asking for, because matching the rate matches the FFT bin grid, and the bin grid
 * is what decides which bands are the same measurement as the device's (see bandBins).
 * Not worth relying on: what a browser does with a stream recorded at another rate is
 * still undefined in the specification, Firefox refused outright until recently, and iOS
 * follows its hardware whatever it was asked. So the rate that comes back is the one the
 * bands are computed from, and a mismatch is something the panel says out loud.
 */
function openContext(): AudioContext {
  try {
    return new AudioContext({sampleRate: DEVICE_SAMPLE_RATE});
  } catch {
    return new AudioContext();
  }
}

const describeWarnings = (
  sampleRate: number,
  settings: MediaTrackSettings,
): string | null => {
  const notes = settingsWarnings(settings);
  if (sampleRate !== DEVICE_SAMPLE_RATE) {
    notes.push(
      `Aufnahme mit ${(sampleRate / 1000).toLocaleString('de-DE')} kHz statt ${
        DEVICE_SAMPLE_RATE / 1000
      } kHz — die tiefen Bänder liegen nicht auf denselben Frequenzen wie beim Gerät`,
    );
  }
  return notes.length === 0 ? null : notes.join(' · ');
};

// Every way a capture can fail that the reader can do something about, named. Anything
// else keeps the section's ordinary error toast.
function reportCaptureError(e: unknown): void {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    toaster.create({
      type: 'error',
      title: 'Mikrofonzugriff verweigert',
      description:
        'In den Browsereinstellungen für diese Seite erlauben und neu laden.',
    });
    return;
  }
  if (name === 'NotFoundError') {
    toaster.create({type: 'error', title: 'Kein Mikrofon gefunden'});
    return;
  }
  if (name === 'OverconstrainedError' || name === 'NotReadableError') {
    toaster.create({
      type: 'error',
      title: 'Mikrofon nicht verfügbar',
      description: errorMessage(e),
    });
    return;
  }
  errorToast('Mikrofon konnte nicht geöffnet werden')(e);
}
