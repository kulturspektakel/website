import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {toaster} from '../chakra-snippets/toaster';
import {errorMessage, errorToast} from './toast';
import {
  audioInputOptions,
  audioOutputOptions,
  bandBins,
  bandDb,
  createBandAccumulator,
  DEVICE_FFT_SIZE,
  DEVICE_SAMPLE_RATE,
  isMicCaptureSupported,
  isOutputSelectable,
  NOMINAL_SENSITIVITY_DB,
  refCorrectionBands,
  referenceMicFor,
  sensitivityFromSensFactor,
  settingsWarnings,
  type AudioInputOption,
  type AudioOutputOption,
  type BandAccumulator,
  type ReferenceMic,
} from './referenceMic';
import {useLatest} from './chartUtils';
import {PINK_NOISE_SECONDS, pinkNoiseLoop} from './pinkNoise';
import {
  CALIBRATION_SAMPLES,
  createCalibrationRun,
  type BandReading,
  type CalibrationResult,
  type CalibrationRun,
} from './bandCalibration';
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
// Owned by the device route rather than by the /crew/noise layout, unlike the
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
  /**
   * One second of both instruments, handed over by whatever is drawing them — which is
   * BandSpectrumChart, and can only be it: `drain()` above *empties* the microphone's
   * accumulator, so anything sampling on a second clock would take frames the chart never sees
   * and pair them with a monitor's record from another moment.
   *
   * Null on either side means that instrument reported nothing this second. `deviceLastSeen` is
   * the monitor's own timestamp, which is how a run tells a monitor that has gone quiet from one
   * whose next record simply has not arrived yet — its clock and ours are independent.
   *
   * Called every second whether or not anything is being measured: it is also what maintains
   * `calibration.ready`, i.e. whether there is anything to measure with.
   */
  observeSecond: (
    device: BandReading | null,
    reference: BandReading | null,
    deviceLastSeen: number | null,
  ) => void;
  /**
   * Measuring this monitor against the reference microphone: thirty seconds of both, and the
   * per-band difference between the two averages (see bandCalibration.ts).
   *
   * The run lives here because it needs the two things this hook owns — the microphone, and the
   * pink noise that gives both instruments something to agree about. Starting it plays the
   * noise; finishing or cancelling stops it.
   */
  calibration: CalibrationSlice;
  /**
   * The pink noise on its own, which is how you find out whether it is coming out of the right
   * speakers before spending thirty seconds on the assumption that it is (see pinkNoise.ts —
   * generated, full scale, looped).
   *
   * Refuses while a run is going rather than being hidden then: a run *is* the noise playing,
   * and switching it off halfway through would leave the average measuring a quiet room. The
   * panel disables the button for the same reason; this is the guard behind it.
   */
  noisePlaying: boolean;
  toggleNoise: () => Promise<void>;
  // Where the noise comes out, and everything it could come out of. Null is the system's own
  // choice, which is both the default and the way back from having named a device.
  outputs: AudioOutputOption[];
  output: string | null;
  // False in a browser with no way to route Web Audio (see isOutputSelectable), where the
  // above is fixed at null and the picker is not worth showing.
  outputSelectable: boolean;
  selectOutput: (deviceId: string | null) => Promise<void>;
};

// Nothing, running, or holding a finished reading. No 'settling' among them: settling is the
// first three seconds of a run and not a state of its own — see SETTLE_SAMPLES, and the progress
// bar, which says so out of `seconds`.
export type CalibrationPhase = 'idle' | 'running' | 'done';

export type CalibrationSlice = {
  phase: CalibrationPhase;
  // Usable seconds counted so far, settle seconds included: what the progress bar is a fraction
  // of, out of CALIBRATION_SECONDS.
  seconds: number;
  // Whether a run could be started at all — a microphone picked, and *both* instruments
  // delivering as of the last second. Not merely "a microphone is open": a run that cannot be
  // fed cancels itself two seconds in, which is a worse way to find out.
  ready: boolean;
  // The last completed run's finding, kept until another is started or the input changes. Null
  // in every other case.
  result: CalibrationResult | null;
  start: () => Promise<void>;
  cancel: () => void;
};

/**
 * `AudioContext.setSinkId`, which TypeScript's DOM library does not have yet — 6.0's
 * lib.dom.d.ts carries the HTMLMediaElement one only. Narrowed to the one call this file
 * makes rather than declared globally, so nothing else can start assuming it is there.
 */
type RoutableContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export function useReferenceMic(): ReferenceMicSlice {
  const [supported, setSupported] = useState(false);
  const [selected, setSelected] = useState<AudioInputOption | null>(null);
  const [options, setOptions] = useState<AudioInputOption[]>([]);
  // Where the noise goes. Both filled by the same refresh() as the inputs, off the same
  // enumerateDevices call — a device list is a device list.
  const [outputs, setOutputs] = useState<AudioOutputOption[]>([]);
  const [output, setOutput] = useState<string | null>(null);
  const [outputSelectable, setOutputSelectable] = useState(false);
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
  // In an effect and not in render, like `supported` above: it reads a prototype the server
  // has never heard of, and the first client paint has to match what the server sent.
  useEffect(() => setOutputSelectable(isOutputSelectable()), []);

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
  // Read when a context is opened or noise is started, both of which happen well after the
  // render that chose the output.
  const outputRef = useLatest(output);
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
      errorToast('Calibration could not be saved')(e);
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

  // --- Pink noise out ---------------------------------------------------------------------

  // The loop, and the node playing it. The buffer is kept once made — eight seconds of
  // Float32 is a megabyte and a half and a few milliseconds of filtering, and pressing play
  // twice should not pay for either twice — while the node cannot be: a source node that has
  // been stopped is spent, and start() may only be called on it once.
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const [noisePlaying, setNoisePlaying] = useState(false);

  const stopNoise = useCallback(() => {
    const node = noiseNodeRef.current;
    noiseNodeRef.current = null;
    if (node != null) {
      try {
        node.stop();
      } catch {}
      // Disconnected as well as stopped, because the node is the graph's reference to a
      // megabyte-and-a-half buffer, and a stopped node still attached to the destination
      // keeps the whole of it reachable.
      try {
        node.disconnect();
      } catch {}
    }
    setNoisePlaying(false);
  }, []);

  /**
   * Point a context's output at the chosen device, or back at the system's.
   *
   * The empty string is the specification's "whatever the system is using", and the only way
   * back to it once a device has been named — so `null` becomes `''` rather than becoming a
   * call that is skipped.
   *
   * Applied to the context and not to a node, because that is where the routing lives: one
   * sink for everything the page plays, which is the whole of what this feature plays.
   */
  const applySink = useCallback(
    async (ctx: AudioContext, deviceId: string | null) => {
      const setSinkId = (ctx as RoutableContext).setSinkId;
      if (setSinkId == null) return;
      await setSinkId.call(ctx, deviceId ?? '');
    },
    [],
  );

  const selectOutput = useCallback(
    async (deviceId: string | null) => {
      setOutput(deviceId);
      const ctx = ctxRef.current;
      // No context yet means nothing is playing and nothing has to move; the choice is read
      // back out of outputRef when one is opened.
      if (ctx == null) return;
      try {
        // Live, so a switch while the noise is playing moves the noise rather than waiting for
        // it to be stopped and started again.
        await applySink(ctx, deviceId);
      } catch (e) {
        errorToast('Output could not be switched')(e);
      }
    },
    [applySink],
  );

  // Whether it is now playing, rather than nothing: the caller is a calibration run, and a run
  // that began without its signal would spend thirty seconds measuring a quiet room.
  const startNoise = useCallback(async (): Promise<boolean> => {
    if (noiseNodeRef.current != null) return true;
    try {
      const ctx = ctxRef.current ?? openContext();
      ctxRef.current = ctx;
      // A click is the one moment a browser will let a context start, which is the whole
      // reason this is async — see the same line in select().
      if (ctx.state !== 'running') await ctx.resume();

      // The chosen output, in case this context was opened before there was one — or was
      // opened by select(), which has no reason to care where sound comes out. Its own
      // try/catch: a device that cannot be routed to is worth saying, and still a better
      // outcome played on the system's output than not played at all.
      try {
        await applySink(ctx, outputRef.current);
      } catch (e) {
        errorToast('Output could not be selected')(e);
      }

      // At the context's own rate, so the browser has no resampling to do on the way out —
      // and rebuilt if that rate has somehow changed under us, since a buffer's rate is
      // fixed at creation.
      let buffer = noiseBufferRef.current;
      if (buffer == null || buffer.sampleRate !== ctx.sampleRate) {
        const length = Math.round(ctx.sampleRate * PINK_NOISE_SECONDS);
        buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        buffer.copyToChannel(pinkNoiseLoop(length), 0);
        noiseBufferRef.current = buffer;
      }

      const node = ctx.createBufferSource();
      node.buffer = buffer;
      // Seamlessly, which is what the crossfade in pinkNoiseLoop is for: this restarts the
      // buffer every eight seconds for as long as it plays.
      node.loop = true;
      // Straight at the destination with no gain node in between. "Maximum" here means
      // nothing attenuating it — the samples are already normalised to full scale — and the
      // one volume left is the system's, which no browser can read or set.
      node.connect(ctx.destination);
      node.start();
      noiseNodeRef.current = node;
      setNoisePlaying(true);
      return true;
    } catch (e) {
      stopNoise();
      errorToast('Pink noise could not be played')(e);
      return false;
    }
  }, [stopNoise, applySink]);

  // --- Measuring the monitor against the microphone ----------------------------------------

  // The run itself lives in a ref rather than in state: it is fed once a second from a callback
  // that must not be rebuilt (see observeSecond), and nothing renders it — what renders is the
  // three numbers below.
  const runRef = useRef<CalibrationRun | null>(null);
  // The monitor's timestamp on the last second that was counted, so a tick landing between two
  // of its records does not count the previous one twice. Both clocks are ~1 Hz and neither is
  // ours, so this happens most runs.
  const countedAtRef = useRef<number | null>(null);
  const [calPhase, setCalPhase] = useState<CalibrationPhase>('idle');
  const [calSeconds, setCalSeconds] = useState(0);
  const [calReady, setCalReady] = useState(false);
  const [calResult, setCalResult] = useState<CalibrationResult | null>(null);
  // Read by observeSecond, which is called from a chart effect and so must not have the phase as
  // a dependency — a new identity every phase change would tear that effect down mid-run.
  const calPhaseRef = useRef<CalibrationPhase>('idle');
  const setPhase = useCallback((next: CalibrationPhase) => {
    calPhaseRef.current = next;
    setCalPhase(next);
  }, []);

  // Everything a run leaves behind, in one place — the accumulator, the counter, and the noise
  // it was playing. `reason` is what to say about it: absent when the reader stopped it (they
  // know), a sentence when it stopped itself.
  const endRun = useCallback(
    (reason?: string) => {
      runRef.current = null;
      countedAtRef.current = null;
      setCalSeconds(0);
      setPhase('idle');
      stopNoise();
      if (reason != null) {
        toaster.create({
          type: 'info',
          title: 'Calibration stopped',
          description: reason,
        });
      }
    },
    [setPhase, stopNoise],
  );

  const cancelCalibration = useCallback(() => {
    if (calPhaseRef.current !== 'running') return;
    endRun();
  }, [endRun]);

  // A finished reading as well as a run in progress: a difference measured through one
  // microphone says nothing about another, and the panel labels it with neither. Called when the
  // input changes, which includes the panel closing.
  const resetCalibration = useCallback(() => {
    if (calPhaseRef.current === 'running') endRun();
    setCalResult(null);
    setPhase('idle');
  }, [endRun, setPhase]);

  const startCalibration = useCallback(async () => {
    if (calPhaseRef.current === 'running') return;
    // The noise first, and only then the run: everything a run measures is the room with this
    // signal in it, and a run whose signal failed to start would be thirty seconds of finding
    // that out. Its first seconds are discarded anyway (SETTLE_SAMPLES), which is what covers
    // the moment between this resolving and the noise actually being audible.
    if (!(await startNoise())) return;
    setCalResult(null);
    setCalSeconds(0);
    countedAtRef.current = null;
    runRef.current = createCalibrationRun();
    setPhase('running');
  }, [startNoise, setPhase]);

  const observeSecond = useCallback(
    (
      device: BandReading | null,
      reference: BandReading | null,
      deviceLastSeen: number | null,
    ) => {
      // Asked every second whether or not anything is running, because this is also the answer
      // to "could a run be started" — and React bails out of a setState that changes nothing, so
      // the steady state costs no renders.
      setCalReady(
        selectedRef.current != null && device != null && reference != null,
      );

      const run = runRef.current;
      if (run == null || calPhaseRef.current !== 'running') return;

      // Not receiving is the end of the run, not a gap in it. A calibration is a claim about
      // thirty *consecutive* seconds of one signal in one room; stitching it around a silence
      // would be a different measurement wearing the same label.
      if (reference == null) {
        endRun('The reference microphone stopped delivering.');
        return;
      }
      if (device == null) {
        endRun('The monitor stopped reporting.');
        return;
      }
      // The monitor's records and this clock are independent, so some ticks fall between two of
      // them. Skipped rather than counted — the level would be the previous record's, weighed
      // twice — and skipped rather than cancelled, since the monitor is plainly still there.
      if (deviceLastSeen != null && deviceLastSeen === countedAtRef.current) {
        return;
      }
      countedAtRef.current = deviceLastSeen;

      run.add(device, reference);
      setCalSeconds(run.seconds());
      if (run.samples() >= CALIBRATION_SAMPLES) {
        setCalResult(run.result());
        runRef.current = null;
        countedAtRef.current = null;
        setPhase('done');
        // The signal has done its job. Left playing, it would be a full-scale noise nobody
        // asked for any more, with the reader's attention on a chart.
        stopNoise();
      }
    },
    [endRun, setPhase, stopNoise],
  );

  const toggleNoise = useCallback(async () => {
    // A run owns the noise for as long as it lasts — stopping it here would leave thirty seconds
    // of average being taken of a quiet room, and starting it changes nothing.
    if (calPhaseRef.current === 'running') return;
    if (noiseNodeRef.current != null) {
      stopNoise();
      return;
    }
    await startNoise();
  }, [startNoise, stopNoise]);

  const refresh = useCallback(async () => {
    if (navigator.mediaDevices?.enumerateDevices == null) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const next = audioInputOptions(devices, selectedRef.current);
      // Keeping the previous array when the list has not actually changed is what makes
      // this callable from an effect: a new array every time would be a new slice, a new
      // context, and a re-render that asks again — which is a loop, not a refresh.
      setOptions((prev) => (sameOptions(prev, next) ? prev : next));

      const nextOutputs = audioOutputOptions(devices);
      setOutputs((prev) =>
        sameOptions(prev, nextOutputs) ? prev : nextOutputs,
      );
      // An output that has gone away — a disconnected interface, a closed lid — drops the
      // choice back to the system's. Unlike a missing *input*, which is kept in the list so
      // the picker still shows what it is set to, this one cannot be kept: the sink is the
      // browser's now, so a picker still naming the old device would be describing something
      // that stopped being true.
      const chosen = outputRef.current;
      if (chosen != null && !nextOutputs.some((o) => o.deviceId === chosen)) {
        setOutput(null);
      }
    } catch (e) {
      errorToast('Audio devices could not be read')(e);
    }
  }, []);

  const select = useCallback(
    async (option: AudioInputOption | null) => {
      releaseInput();
      // Before anything else: a run in progress is measuring through the input being replaced,
      // and a finished one was measured through it. Neither survives the change.
      resetCalibration();
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
    [releaseInput, clearSelection, persistCals, resetCalibration],
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
          title: 'Not a calibration file',
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
        title: `Calibration ${result.serial}`,
        description: `${result.points} measurement points taken`,
      });
      // Which file applies decides what the microphone's levels *are* (see sensitivityDb and
      // the per-band correction), so a run in progress would end up averaging seconds read on
      // two different scales, and a finished one was read on the old. Neither is salvageable,
      // and both look exactly like a working measurement.
      resetCalibration();
    },
    [persistCals, resetCalibration],
  );

  // Picking one by hand, for the case resolveCal will not guess: several files stored and an
  // input it has not seen. Null is a choice too, and recorded as one — recording it in the
  // store is the whole of the change, since that is where calSerial reads from.
  const useCal = useCallback(
    (serial: string | null) => {
      const deviceId = selectedRef.current?.deviceId;
      // Nothing to pair it with, and so nowhere to put the answer. The panel does not render
      // the control at all without an input, so this is a guard and not a path.
      if (deviceId == null) return;
      persistCals(
        serial == null
          ? unpairDevice(calsRef.current, deviceId)
          : rememberDevice(calsRef.current, deviceId, serial),
      );
      // As in importCal: this changes what the microphone's dB values mean, and so what any
      // measurement through it is worth.
      resetCalibration();
    },
    [persistCals, resetCalibration],
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
    // Which drops the run and the noise with it (see select): this panel is the only place any
    // of the three can be switched off, so leaving the room being blasted behind a closed panel
    // is a state with no control attached to it.
    void select(null);
    stopNoise();
  }, [select, stopNoise]);

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
  // stops moving — and the noise simply stops, which is why playing counts here as much as
  // capturing does.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (ctx == null || (selected == null && !noisePlaying)) return;
    const onChange = () => {
      if (ctx.state !== 'running') {
        void ctx.resume().catch(() => {});
      }
    };
    ctx.addEventListener('statechange', onChange);
    return () => ctx.removeEventListener('statechange', onChange);
  }, [selected, noisePlaying]);

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

  // Navigating away. Closing the context is also what stops any noise still playing — a
  // stopNoise() here would only be setting state on a hook that is going away.
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
      observeSecond,
      calibration: {
        phase: calPhase,
        seconds: calSeconds,
        ready: calReady,
        result: calResult,
        start: startCalibration,
        cancel: cancelCalibration,
      },
      noisePlaying,
      toggleNoise,
      outputs,
      output,
      outputSelectable,
      selectOutput,
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
      observeSecond,
      calPhase,
      calSeconds,
      calReady,
      calResult,
      startCalibration,
      cancelCalibration,
      noisePlaying,
      toggleNoise,
      outputs,
      output,
      outputSelectable,
      selectOutput,
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
      `Recording at ${(sampleRate / 1000).toLocaleString('de-DE')} kHz instead of ${
        DEVICE_SAMPLE_RATE / 1000
      } kHz — the low bands do not sit on the same frequencies as on the device`,
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
      title: 'Microphone access denied',
      description: 'Allow it in the browser settings for this page and reload.',
    });
    return;
  }
  if (name === 'NotFoundError') {
    toaster.create({type: 'error', title: 'No microphone found'});
    return;
  }
  if (name === 'OverconstrainedError' || name === 'NotReadableError') {
    toaster.create({
      type: 'error',
      title: 'Microphone unavailable',
      description: errorMessage(e),
    });
    return;
  }
  errorToast('Microphone could not be opened')(e);
}
