#!/usr/bin/env swift
/**
 * Turns this Mac's microphone into a simulated Lärmmessgerät: it measures real
 * sound levels and publishes them once a second as the same protobuf
 * `NoiseRecording` the hardware monitors send, on the same broker and topic —
 * so `/crew/lautstaerke/<device>` shows a live device without one on the desk.
 *
 * `yarn noise:mic --device SIM-1` to run, `--help` for the options, and
 * `--selftest` to check the filters, the transform and the wire encoding
 * without touching the microphone or the network. Start with `--list-inputs`:
 * the system default is frequently an audio interface with nothing plugged
 * into it, which presents as a working microphone and delivers silence.
 *
 * No dependencies: AVFoundation captures, Accelerate weights and transforms,
 * and Network speaks MQTT 3.1.1 to broker.emqx.io by hand.
 *
 * It is a simulator, not an instrument. The level it reports is only as good as
 * `--calibration` (see `--help`), the built-in mic clips somewhere around
 * 105 dB, its response below ~50 Hz is a guess, and LCpeak is read at the
 * sample grid rather than interpolated, so it reads up to ~0.5 dB low.
 */

import AVFoundation
import Accelerate
import CoreAudio
import Darwin
import Foundation
import Network
import os

// MARK: - Wire contract
//
// Mirrors src/proto/noise.proto and src/components/lautstaerke/noise.ts. The
// levels cross as one byte each, and the UI decodes them with
// `decodeDb = (byte) => 20 + byte / 2` — so this is the inverse of that.

let BAND_FREQUENCIES: [Double] = [
  16, 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
  800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500,
  16000,
]
let BAND_COUNT = BAND_FREQUENCIES.count

// Absent is not zero: the UI renders a missing trailing-window field as "—" but
// a zero byte as 20 dB, so the 5m/30m fields stay off the wire until they mean
// something.
struct Recording {
  var seqNo: UInt32
  var bands: [UInt8]
  var laeq: Double
  var lceq: Double
  var lafmax: Double
  var lcfmax: Double
  var lcpeak: Double
  var intervalSeconds: UInt32
  var batteryMv: UInt32?
  var laeq5m: Double?
  var lceq5m: Double?
  var laeq30m: Double?
  var lceq30m: Double?
}

func dbByte(_ db: Double) -> UInt8 {
  // Silence gives -inf, which the UI is happiest reading as its floor.
  guard db.isFinite else { return 0 }
  return UInt8(clamping: Int(((db - 20) * 2).rounded()))
}

func appendVarint(_ value: UInt64, to out: inout Data) {
  var v = value
  repeat {
    var byte = UInt8(v & 0x7F)
    v >>= 7
    if v != 0 { byte |= 0x80 }
    out.append(byte)
  } while v != 0
}

func encode(_ r: Recording) -> Data {
  var out = Data()
  func varintField(_ tag: UInt8, _ value: UInt64) {
    out.append(tag)
    appendVarint(value, to: &out)
  }
  varintField(0x08, UInt64(r.seqNo))
  out.append(0x12)
  appendVarint(UInt64(r.bands.count), to: &out)
  out.append(contentsOf: r.bands)
  varintField(0x18, UInt64(dbByte(r.laeq)))
  varintField(0x20, UInt64(dbByte(r.lceq)))
  varintField(0x28, UInt64(dbByte(r.lafmax)))
  varintField(0x30, UInt64(dbByte(r.lcfmax)))
  varintField(0x38, UInt64(dbByte(r.lcpeak)))
  varintField(0x40, UInt64(r.intervalSeconds))
  if let mv = r.batteryMv { varintField(0x48, UInt64(mv)) }
  if let v = r.laeq5m { varintField(0x50, UInt64(dbByte(v))) }
  if let v = r.lceq5m { varintField(0x58, UInt64(dbByte(v))) }
  if let v = r.laeq30m { varintField(0x60, UInt64(dbByte(v))) }
  if let v = r.lceq30m { varintField(0x68, UInt64(dbByte(v))) }
  return out
}

// MARK: - Audio input devices
//
// The engine would happily use whatever macOS calls the default input, but that
// is often not the microphone you meant — an audio interface with nothing
// plugged into it, or a virtual device from a conferencing app, both look like
// a working microphone and deliver silence. So the device is listable and
// selectable, and the one in use is always named on startup.

enum AudioDevices {
  struct Device {
    let id: AudioDeviceID
    let name: String
    let inputChannels: Int
  }

  static func withInputs() -> [Device] {
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioHardwarePropertyDevices,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain)
    var size: UInt32 = 0
    let system = AudioObjectID(kAudioObjectSystemObject)
    guard AudioObjectGetPropertyDataSize(system, &address, 0, nil, &size) == noErr else { return [] }
    var ids = [AudioDeviceID](repeating: 0, count: Int(size) / MemoryLayout<AudioDeviceID>.size)
    guard AudioObjectGetPropertyData(system, &address, 0, nil, &size, &ids) == noErr else { return [] }
    return ids.compactMap { id in
      let channels = inputChannels(id)
      guard channels > 0 else { return nil }
      return Device(id: id, name: name(id) ?? "device \(id)", inputChannels: channels)
    }
  }

  static func defaultInput() -> AudioDeviceID? {
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioHardwarePropertyDefaultInputDevice,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain)
    var id = AudioDeviceID(0)
    var size = UInt32(MemoryLayout<AudioDeviceID>.size)
    let system = AudioObjectID(kAudioObjectSystemObject)
    guard AudioObjectGetPropertyData(system, &address, 0, nil, &size, &id) == noErr, id != 0
    else { return nil }
    return id
  }

  static func name(_ id: AudioDeviceID) -> String? {
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioObjectPropertyName,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain)
    // The property hands back a +1 reference, so it is ours to release.
    var name: Unmanaged<CFString>?
    var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    guard AudioObjectGetPropertyData(id, &address, 0, nil, &size, &name) == noErr,
      let value = name?.takeRetainedValue()
    else { return nil }
    return value as String
  }

  private static func inputChannels(_ id: AudioDeviceID) -> Int {
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioDevicePropertyStreamConfiguration,
      mScope: kAudioObjectPropertyScopeInput,
      mElement: kAudioObjectPropertyElementMain)
    var size: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(id, &address, 0, nil, &size) == noErr, size > 0
    else { return 0 }
    let raw = UnsafeMutableRawPointer.allocate(
      byteCount: Int(size), alignment: MemoryLayout<AudioBufferList>.alignment)
    defer { raw.deallocate() }
    guard AudioObjectGetPropertyData(id, &address, 0, nil, &size, raw) == noErr else { return 0 }
    let list = UnsafeMutableAudioBufferListPointer(raw.assumingMemoryBound(to: AudioBufferList.self))
    return list.reduce(0) { $0 + Int($1.mNumberChannels) }
  }
}

// MARK: - Configuration

struct Config {
  var device = "SIM-1"
  var input: String?
  var calibration = 100.0
  var host = "broker.emqx.io"
  var port: UInt16 = 1883
  var interval = 1
  var batteryMv: UInt32?
  var fftSize = 32768
  var warm = false
  var selftest = false

  var topic: String { "noise/\(device)/record" }
}

let usage = """
Publishes this Mac's microphone as a simulated noise monitor.

  yarn noise:mic --device SIM-1
  swift scripts/noise-mic.swift --device SIM-1
  swiftc -O scripts/noise-mic.swift -o /tmp/noise-mic   # for long runs

Options
  --device <id>       Device id; the topic becomes noise/<id>/record and the
                      live view is /crew/lautstaerke/<id>.       (SIM-1)
  --input <name>      Microphone to listen on, matched as a case-insensitive
                      substring. Defaults to the system input, which is worth
                      checking: an audio interface with nothing plugged in and
                      a conferencing app's virtual device both present as
                      working microphones and deliver silence.
  --list-inputs       Show the microphones this Mac has, then exit.
  --calibration <dB>  Offset added to every level: the microphone measures
                      dBFS, this turns it into dB SPL.           (100.0)
  --host <host>                                                  (broker.emqx.io)
  --port <port>                                                  (1883)
  --interval <s>      Seconds between records, 1 to 3. The UI calls a device
                      offline after 5 s and breaks the trace past 3.   (1)
  --battery <mV>      Report a battery voltage; omitted entirely if unset.
  --fft-size <n>      16384, 32768 or 65536. Larger resolves the bottom
                      bands better and lags a little more.       (32768)
  --warm              Fill the trailing 5 m / 30 m levels from whatever data
                      exists instead of waiting for the real windows.
  --selftest          Check the DSP and the wire format, then exit.
  --help

Calibration
  Run with --calibration 0 to read raw dBFS, play steady pink noise, hold a
  phone SPL meter next to the Mac's microphone, and use the difference:
  calibration = phone − script. Phone apps are worth ±3–5 dB, so treat the
  result as an anchor rather than a measurement.

  Afterwards, leave the input volume slider in System Settings › Sound alone —
  it is a real gain of up to ~40 dB and moving it invalidates the calibration.
  Voice Isolation and Wide Spectrum in Control Center also reshape the signal
  in ways this script cannot see; keep the microphone mode on Standard.
"""

func parseConfig() -> Config {
  var c = Config()
  var args = Array(CommandLine.arguments.dropFirst())

  func value(_ flag: String) -> String {
    guard !args.isEmpty else { fail("\(flag) needs a value") }
    return args.removeFirst()
  }

  while !args.isEmpty {
    let flag = args.removeFirst()
    switch flag {
    case "--help", "-h":
      print(usage)
      exit(0)
    case "--selftest":
      c.selftest = true
    case "--warm":
      c.warm = true
    case "--device":
      c.device = value(flag)
    case "--input":
      c.input = value(flag)
    case "--list-inputs":
      listInputs()
    case "--calibration":
      guard let v = Double(value(flag)) else { fail("--calibration needs a number") }
      c.calibration = v
    case "--host":
      c.host = value(flag)
    case "--port":
      guard let v = UInt16(value(flag)) else { fail("--port needs a port number") }
      c.port = v
    case "--interval":
      guard let v = Int(value(flag)) else {
        fail("--interval needs whole seconds — the field on the wire is an integer")
      }
      c.interval = v
    case "--battery":
      guard let v = UInt32(value(flag)) else { fail("--battery needs millivolts") }
      c.batteryMv = v
    case "--fft-size":
      guard let v = Int(value(flag)) else { fail("--fft-size needs a number") }
      c.fftSize = v
    default:
      fail("unknown option \(flag)\n\n\(usage)")
    }
  }

  if c.device.isEmpty || c.device.contains(where: { "/+#".contains($0) }) {
    fail("--device must be non-empty and free of / + #, it is a topic segment")
  }
  if c.interval < 1 || c.interval > 3 {
    fail("--interval must be 1 to 3 seconds: the UI marks a device offline after 5 s of silence and breaks its trace past 3")
  }
  if ![16384, 32768, 65536].contains(c.fftSize) {
    fail("--fft-size must be 16384, 32768 or 65536")
  }
  return c
}

func listInputs() -> Never {
  let devices = AudioDevices.withInputs()
  guard !devices.isEmpty else { fail("this Mac has no audio input devices") }
  let current = AudioDevices.defaultInput()
  print("Microphones, as --input matches them:")
  for device in devices {
    let marker = device.id == current ? " (system default)" : ""
    print("  \(device.name)  — \(device.inputChannels) channel(s)\(marker)")
  }
  exit(0)
}

func fail(_ message: String) -> Never {
  FileHandle.standardError.write(Data("noise-mic: \(message)\n".utf8))
  exit(1)
}

// MARK: - Complex arithmetic
//
// Only ever used to evaluate a transfer function at a handful of frequencies,
// which is not worth a dependency.

struct Cx {
  var re: Double
  var im: Double
  static let one = Cx(re: 1, im: 0)
  static func * (a: Cx, b: Cx) -> Cx {
    Cx(re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re)
  }
  static func + (a: Cx, b: Cx) -> Cx { Cx(re: a.re + b.re, im: a.im + b.im) }
  static func / (a: Cx, b: Cx) -> Cx {
    let d = b.re * b.re + b.im * b.im
    return Cx(re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d)
  }
  func scaled(_ k: Double) -> Cx { Cx(re: re * k, im: im * k) }
  var magnitude: Double { (re * re + im * im).squareRoot() }
}

// MARK: - Frequency weighting
//
// The A and C curves of IEC 61672-1, derived here rather than pasted in as
// coefficient tables: the analog poles are the specification, everything below
// follows from them, and --selftest checks the result against the tolerance
// table. That way a wrong sample rate cannot silently detune the filters.

struct Biquad {
  var b0: Double, b1: Double, b2: Double, a1: Double, a2: Double
}

enum Weighting {
  case a
  case c

  // Pole frequencies, Hz. f1 and f4 are double poles in both curves; f2 and f3
  // are the pair that pulls the A curve down through the midrange.
  static let f1 = 20.598997
  static let f2 = 107.65265
  static let f3 = 737.86223
  static let f4 = 12194.217

  /// |H(j2πf)| of the analog prototype, normalised to unity at 1 kHz.
  func analogMagnitude(_ f: Double) -> Double {
    func raw(_ f: Double) -> Double {
      let w = 2 * Double.pi * f
      let w1 = 2 * Double.pi * Weighting.f1, w2 = 2 * Double.pi * Weighting.f2
      let w3 = 2 * Double.pi * Weighting.f3, w4 = 2 * Double.pi * Weighting.f4
      // |jw + wn|^2 = w^2 + wn^2, and f1/f4 are double poles.
      let low = w * w + w1 * w1
      let high = w * w + w4 * w4
      switch self {
      case .a:
        let mid = ((w * w + w2 * w2) * (w * w + w3 * w3)).squareRoot()
        return (w * w * w * w) / (low * mid * high)
      case .c:
        return (w * w) / (low * high)
      }
    }
    return raw(f) / raw(1000)
  }

  /// The biquad cascade, gain-normalised so the response at 1 kHz is exactly
  /// unity — which is what makes the analog gain constant unnecessary.
  ///
  /// Prewarping is off by default, and --selftest is where that is argued: it
  /// would place each pole exactly and halve the error at 16 kHz, but it costs
  /// +0.3 dB at 4 kHz and +0.7 dB at 8 kHz, where plain bilinear is inside
  /// 0.04 dB. The top band is where A-weighting is already 6.6 dB down and
  /// where IEC 61672-1 class 1 allows +3.5/−17 dB, so the trade runs the other
  /// way. It is also what scipy and MATLAB do, so the coefficients can be
  /// diffed against a published reference.
  func sections(sampleRate fs: Double, prewarp: Bool = false) -> [Biquad] {
    let c = 2 * fs
    // Bilinear image of a real analog pole at -2πf.
    func pole(_ f: Double) -> Double {
      let w = 2 * Double.pi * f
      let wp = prewarp ? c * tan(w / (2 * fs)) : w
      return (c - wp) / (c + wp)
    }
    let p1 = pole(Weighting.f1), p4 = pole(Weighting.f4)

    // The bilinear transform gives the digital filter as many zeros as poles:
    // the analog zeros at s = 0 map to z = +1, and the remainder land at
    // z = -1. Forgetting the latter collapses the top octave, so they are the
    // [1, 2, 1] numerator below rather than another [1, -2, 1].
    var sections: [Biquad]
    switch self {
    case .a:
      let p2 = pole(Weighting.f2), p3 = pole(Weighting.f3)
      sections = [
        Biquad(b0: 1, b1: -2, b2: 1, a1: -2 * p1, a2: p1 * p1),
        Biquad(b0: 1, b1: -2, b2: 1, a1: -(p2 + p3), a2: p2 * p3),
        Biquad(b0: 1, b1: 2, b2: 1, a1: -2 * p4, a2: p4 * p4),
      ]
    case .c:
      sections = [
        Biquad(b0: 1, b1: -2, b2: 1, a1: -2 * p1, a2: p1 * p1),
        Biquad(b0: 1, b1: 2, b2: 1, a1: -2 * p4, a2: p4 * p4),
      ]
    }

    let gain = 1 / Weighting.response(sections, frequency: 1000, sampleRate: fs).magnitude
    sections[0].b0 *= gain
    sections[0].b1 *= gain
    sections[0].b2 *= gain
    return sections
  }

  static func response(_ sections: [Biquad], frequency: Double, sampleRate: Double) -> Cx {
    let w = -2 * Double.pi * frequency / sampleRate
    let z1 = Cx(re: cos(w), im: sin(w))
    let z2 = z1 * z1
    var acc = Cx.one
    for s in sections {
      let num = Cx(re: s.b0, im: 0) + z1.scaled(s.b1) + z2.scaled(s.b2)
      let den = Cx.one + z1.scaled(s.a1) + z2.scaled(s.a2)
      acc = acc * (num / den)
    }
    return acc
  }
}

/// A cascade running through vDSP, holding its own delay line so the filter
/// state survives across audio callbacks — resetting it every buffer would put
/// a click at each boundary and a dip in every reported second.
final class BiquadChain {
  private let setup: vDSP_biquad_SetupD
  private let delay: UnsafeMutablePointer<Double>

  init(_ sections: [Biquad]) {
    var coefficients: [Double] = []
    for s in sections { coefficients += [s.b0, s.b1, s.b2, s.a1, s.a2] }
    guard let setup = vDSP_biquad_CreateSetupD(coefficients, vDSP_Length(sections.count)) else {
      fail("could not create a biquad setup")
    }
    self.setup = setup
    delay = .allocate(capacity: 2 * sections.count + 2)
    delay.initialize(repeating: 0, count: 2 * sections.count + 2)
  }

  deinit {
    vDSP_biquad_DestroySetupD(setup)
    delay.deallocate()
  }

  func run(_ input: UnsafePointer<Double>, _ output: UnsafeMutablePointer<Double>, _ count: Int) {
    vDSP_biquadD(setup, delay, input, 1, output, 1, vDSP_Length(count))
  }
}

/// The exponential detector behind LAFmax / LCFmax: Fast is a 125 ms time
/// constant on the squared signal, which is a one-pole filter in biquad
/// clothing.
func fastDetector(sampleRate: Double) -> BiquadChain {
  let alpha = 1 - exp(-1 / (sampleRate * 0.125))
  return BiquadChain([Biquad(b0: alpha, b1: 0, b2: 0, a1: -(1 - alpha), a2: 0)])
}

// MARK: - Third-octave spectrum
//
// The 31 bands come from an overlapped FFT rather than a filter bank. The frame
// is longer than the reporting interval — at 32768 points and 48 kHz it spans
// 0.68 s — because the alternative is a main lobe wider than the bands it is
// meant to separate. Frames are therefore drawn from a rolling ring, and the
// spectrum lags about a third of a second, which is invisible at 1 Hz.

final class Spectrum {
  let size: Int
  let hop: Int
  private let half: Int
  private let setup: vDSP_DFT_SetupD
  private let ring: UnsafeMutablePointer<Double>
  private let window: UnsafeMutablePointer<Double>
  private let inRe, inIm, outRe, outIm, magnitudes: UnsafeMutablePointer<Double>
  private let scale: Double
  private let bandBins: [(lo: Int, hi: Int)]
  private var writeIndex = 0
  private var filled = 0
  private var sinceHop = 0

  /// Band power summed since the last drain, and how many frames went into it.
  private(set) var pendingPower = [Double](repeating: 0, count: BAND_COUNT)
  private(set) var pendingFrames = 0

  init(size: Int, sampleRate: Double) {
    self.size = size
    hop = size / 4
    half = size / 2
    guard let setup = vDSP_DFT_zrop_CreateSetupD(nil, vDSP_Length(size), .FORWARD) else {
      fail("could not create a DFT setup for \(size) points")
    }
    self.setup = setup

    ring = .allocate(capacity: size)
    ring.initialize(repeating: 0, count: size)
    window = .allocate(capacity: size)
    for i in 0..<size {
      window[i] = 0.5 * (1 - cos(2 * Double.pi * Double(i) / Double(size)))
    }
    inRe = .allocate(capacity: half)
    inIm = .allocate(capacity: half)
    outRe = .allocate(capacity: half)
    outIm = .allocate(capacity: half)
    magnitudes = .allocate(capacity: half)

    // vDSP's real forward transform returns twice the mathematical result, so
    // |X[k]|² is (re² + im²)/4; the single-sided sum that recovers the mean
    // square is 2|X[k]|²/n²; and dividing by the window's mean square puts back
    // the power the window took out. Together these make the band powers sum
    // to the mean square of the input, which is what --selftest asserts.
    var windowPower = 0.0
    for i in 0..<size { windowPower += window[i] * window[i] }
    windowPower /= Double(size)
    scale = 1 / (2 * Double(size) * Double(size) * windowPower)

    let points = size, top = half
    bandBins = BAND_FREQUENCIES.map { centre in
      let lower = centre * pow(2, -1.0 / 6), upper = centre * pow(2, 1.0 / 6)
      var lo = max(1, Int(ceil(lower * Double(points) / sampleRate)))
      var hi = min(top - 1, Int(floor(upper * Double(points) / sampleRate)))
      if hi < lo {
        // Narrower than a bin, or above Nyquist: fall back to the single bin
        // nearest the centre so no band is ever empty.
        let nearest = min(top - 1, max(1, Int((centre * Double(points) / sampleRate).rounded())))
        lo = nearest
        hi = nearest
      }
      return (lo, hi)
    }
  }

  deinit {
    vDSP_DFT_DestroySetupD(setup)
    ring.deallocate()
    window.deallocate()
    inRe.deallocate()
    inIm.deallocate()
    outRe.deallocate()
    outIm.deallocate()
    magnitudes.deallocate()
  }

  func push(_ samples: UnsafePointer<Double>, count: Int) {
    for i in 0..<count {
      ring[writeIndex] = samples[i]
      writeIndex = (writeIndex + 1) % size
      if filled < size { filled += 1 }
      sinceHop += 1
      if sinceHop >= hop && filled == size {
        sinceHop = 0
        analyse()
      }
    }
  }

  func drain() -> (power: [Double], frames: Int) {
    let result = (pendingPower, pendingFrames)
    for i in 0..<BAND_COUNT { pendingPower[i] = 0 }
    pendingFrames = 0
    return result
  }

  private func analyse() {
    // The oldest sample of a full ring sits at the write cursor. The real
    // transform wants the signal split even/odd, so window and split in one
    // pass — there is no intermediate buffer and no pointer reinterpretation.
    for k in 0..<half {
      let even = (writeIndex + 2 * k) % size
      let odd = (writeIndex + 2 * k + 1) % size
      inRe[k] = ring[even] * window[2 * k]
      inIm[k] = ring[odd] * window[2 * k + 1]
    }
    vDSP_DFT_ExecuteD(setup, inRe, inIm, outRe, outIm)

    var split = DSPDoubleSplitComplex(realp: outRe, imagp: outIm)
    vDSP_zvmagsD(&split, 1, magnitudes, 1, vDSP_Length(half))
    var s = scale
    vDSP_vsmulD(magnitudes, 1, &s, magnitudes, 1, vDSP_Length(half))
    // Bin 0 packs DC and Nyquist together and is meaningless here; every band
    // starts above it.

    for (i, bins) in bandBins.enumerated() {
      var sum = 0.0
      vDSP_sveD(magnitudes + bins.lo, 1, &sum, vDSP_Length(bins.hi - bins.lo + 1))
      pendingPower[i] += sum
    }
    pendingFrames += 1
  }
}

// MARK: - Accumulators shared between the audio thread and the publisher

struct Accumulator {
  var sumSquaresA = 0.0
  var sumSquaresC = 0.0
  var maxFastA = 0.0
  var maxFastC = 0.0
  var maxAbsC = 0.0
  var samples = 0
  var frames = 0
  var bandPower = [Double](repeating: 0, count: BAND_COUNT)

  mutating func reset() {
    sumSquaresA = 0
    sumSquaresC = 0
    maxFastA = 0
    maxFastC = 0
    maxAbsC = 0
    samples = 0
    frames = 0
    for i in 0..<BAND_COUNT { bandPower[i] = 0 }
  }
}

/// Everything the audio callback touches — filter state, the sample ring, the
/// transform scratch — belongs to the callback alone and needs no lock. Only
/// the summary below crosses a thread boundary, and it does so under an unfair
/// lock held for a few microseconds, which donates priority and so cannot
/// invert against the audio thread.
final class Analyzer: @unchecked Sendable {
  let sampleRate: Double
  private let chainA: BiquadChain
  private let chainC: BiquadChain
  private let detectorA: BiquadChain
  private let detectorC: BiquadChain
  private let spectrum: Spectrum
  private let capacity: Int
  private let mono, weighted, squared, scratch: UnsafeMutablePointer<Double>
  let shared = OSAllocatedUnfairLock(initialState: Accumulator())

  init(sampleRate: Double, fftSize: Int) {
    self.sampleRate = sampleRate
    chainA = BiquadChain(Weighting.a.sections(sampleRate: sampleRate))
    chainC = BiquadChain(Weighting.c.sections(sampleRate: sampleRate))
    detectorA = fastDetector(sampleRate: sampleRate)
    detectorC = fastDetector(sampleRate: sampleRate)
    spectrum = Spectrum(size: fftSize, sampleRate: sampleRate)
    capacity = 16384
    mono = .allocate(capacity: capacity)
    weighted = .allocate(capacity: capacity)
    squared = .allocate(capacity: capacity)
    scratch = .allocate(capacity: capacity)
  }

  deinit {
    mono.deallocate()
    weighted.deallocate()
    squared.deallocate()
    scratch.deallocate()
  }

  func process(_ buffer: AVAudioPCMBuffer) {
    guard let channels = buffer.floatChannelData else { return }
    let frames = Int(buffer.frameLength)
    let channelCount = Int(buffer.format.channelCount)
    let interleaved = buffer.format.isInterleaved

    var offset = 0
    while offset < frames {
      let n = min(capacity, frames - offset)
      // Down-mix to mono. Aggregate devices really do show up with more than
      // one channel, and an interleaved tap format is legal even if unusual.
      if interleaved {
        let base = channels[0] + offset * channelCount
        vDSP_vspdp(base, vDSP_Stride(channelCount), mono, 1, vDSP_Length(n))
        for c in 1..<channelCount {
          vDSP_vspdp(base + c, vDSP_Stride(channelCount), scratch, 1, vDSP_Length(n))
          vDSP_vaddD(mono, 1, scratch, 1, mono, 1, vDSP_Length(n))
        }
      } else {
        vDSP_vspdp(channels[0] + offset, 1, mono, 1, vDSP_Length(n))
        for c in 1..<channelCount {
          vDSP_vspdp(channels[c] + offset, 1, scratch, 1, vDSP_Length(n))
          vDSP_vaddD(mono, 1, scratch, 1, mono, 1, vDSP_Length(n))
        }
      }
      if channelCount > 1 {
        var k = 1 / Double(channelCount)
        vDSP_vsmulD(mono, 1, &k, mono, 1, vDSP_Length(n))
      }
      processMono(count: n)
      offset += n
    }
  }

  private func processMono(count n: Int) {
    var sumA = 0.0, sumC = 0.0, peakFastA = 0.0, peakFastC = 0.0, peakC = 0.0

    chainA.run(mono, weighted, n)
    vDSP_svesqD(weighted, 1, &sumA, vDSP_Length(n))
    vDSP_vsqD(weighted, 1, squared, 1, vDSP_Length(n))
    detectorA.run(squared, scratch, n)
    vDSP_maxvD(scratch, 1, &peakFastA, vDSP_Length(n))

    chainC.run(mono, weighted, n)
    vDSP_svesqD(weighted, 1, &sumC, vDSP_Length(n))
    vDSP_maxmgvD(weighted, 1, &peakC, vDSP_Length(n))
    vDSP_vsqD(weighted, 1, squared, 1, vDSP_Length(n))
    detectorC.run(squared, scratch, n)
    vDSP_maxvD(scratch, 1, &peakFastC, vDSP_Length(n))

    // The bands are unweighted, so they see the raw signal.
    spectrum.push(mono, count: n)
    let bands = spectrum.drain()

    let (energyA, energyC) = (sumA, sumC)
    let (fastA, fastC, absC) = (peakFastA, peakFastC, peakC)
    shared.withLock { acc in
      acc.sumSquaresA += energyA
      acc.sumSquaresC += energyC
      acc.maxFastA = max(acc.maxFastA, fastA)
      acc.maxFastC = max(acc.maxFastC, fastC)
      acc.maxAbsC = max(acc.maxAbsC, absC)
      acc.samples += n
      acc.frames += bands.frames
      if bands.frames > 0 {
        for i in 0..<BAND_COUNT { acc.bandPower[i] += bands.power[i] }
      }
    }
  }
}

// MARK: - MQTT 3.1.1
//
// Hand-rolled because the whole client is a CONNECT, a PUBLISH and a ping: five
// packet shapes, none of which needs a packet identifier at QoS 0.

final class MQTTClient: @unchecked Sendable {
  enum State: String {
    case connecting, connected, reconnecting
  }

  private let host: String
  private let port: UInt16
  private let queue = DispatchQueue(label: "noise-mic.mqtt")
  private let clientId: String
  private var connection: NWConnection?
  private var buffer = Data()
  private var acknowledged = false
  private var attempt = 0
  private var pingTimer: DispatchSourceTimer?
  private var awaitingPong = false
  private var generation = 0

  /// Read from the publisher thread purely for the status line.
  let state = OSAllocatedUnfairLock(initialState: State.connecting)
  var onLog: ((String) -> Void)?

  init(host: String, port: UInt16) {
    self.host = host
    self.port = port
    var suffix = ""
    for _ in 0..<8 { suffix += String(format: "%x", Int.random(in: 0..<16)) }
    // Short and unique: brokers may reject ids over 23 characters, and a
    // duplicate would kick the other instance off this public broker.
    clientId = "nm-" + suffix
  }

  func start() {
    queue.async { self.open() }
  }

  func publish(topic: String, payload: Data) {
    queue.async {
      guard self.acknowledged, let connection = self.connection else { return }
      var packet = Data([0x30])
      let topicBytes = Array(topic.utf8)
      var body = Data()
      body.append(UInt8(topicBytes.count >> 8))
      body.append(UInt8(topicBytes.count & 0xFF))
      body.append(contentsOf: topicBytes)
      body.append(payload)
      packet.append(self.remainingLength(body.count))
      packet.append(body)
      connection.send(content: packet, completion: .idempotent)
    }
  }

  func shutdown(completion: @escaping () -> Void) {
    queue.async {
      if let connection = self.connection, self.acknowledged {
        connection.send(
          content: Data([0xE0, 0x00]),
          completion: .contentProcessed { _ in
            connection.cancel()
            completion()
          })
      } else {
        self.connection?.cancel()
        completion()
      }
    }
  }

  // MARK: Connection lifecycle

  private func open() {
    generation += 1
    let generation = self.generation
    acknowledged = false
    buffer.removeAll(keepingCapacity: true)
    awaitingPong = false

    let parameters = NWParameters.tcp
    if let tcp = parameters.defaultProtocolStack.transportProtocol as? NWProtocolTCP.Options {
      tcp.noDelay = true
      tcp.connectionTimeout = 10
    }
    let connection = NWConnection(
      host: NWEndpoint.Host(host),
      port: NWEndpoint.Port(rawValue: port)!,
      using: parameters)
    self.connection = connection

    connection.stateUpdateHandler = { [weak self] state in
      guard let self, generation == self.generation else { return }
      switch state {
      case .ready:
        self.sendConnect()
        self.receive()
      case .failed(let error):
        self.onLog?("connection failed: \(error.localizedDescription)")
        self.retry()
      case .cancelled:
        break
      default:
        break
      }
    }
    connection.start(queue: queue)

    // A broker that accepts the TCP connection but never answers CONNECT would
    // otherwise leave us publishing into a socket nobody reads.
    queue.asyncAfter(deadline: .now() + 10) { [weak self] in
      guard let self, generation == self.generation, !self.acknowledged else { return }
      self.onLog?("no CONNACK within 10s")
      self.retry()
    }
  }

  private func retry() {
    guard let connection else { return }
    connection.cancel()
    self.connection = nil
    pingTimer?.cancel()
    pingTimer = nil
    generation += 1

    attempt = min(attempt + 1, 5)
    let base = Double(1 << attempt)
    let delay = min(30, base) * Double.random(in: 0.8...1.2)
    state.withLock { $0 = .reconnecting }
    queue.asyncAfter(deadline: .now() + delay) { [weak self] in self?.open() }
  }

  private func sendConnect() {
    var body = Data([0x00, 0x04])
    body.append(contentsOf: Array("MQTT".utf8))
    body.append(0x04)  // protocol level: 3.1.1
    body.append(0x02)  // clean session, no will, no credentials
    body.append(contentsOf: [0x00, 0x3C])  // keep alive: 60s
    let id = Array(clientId.utf8)
    body.append(UInt8(id.count >> 8))
    body.append(UInt8(id.count & 0xFF))
    body.append(contentsOf: id)

    var packet = Data([0x10])
    packet.append(remainingLength(body.count))
    packet.append(body)
    connection?.send(content: packet, completion: .idempotent)
  }

  private func receive() {
    // Posted continuously even though we never subscribe: without an
    // outstanding read, NWConnection never notices the peer going away.
    connection?.receive(minimumIncompleteLength: 1, maximumLength: 8192) {
      [weak self] data, _, isComplete, error in
      guard let self else { return }
      if let data, !data.isEmpty {
        self.buffer.append(data)
        self.drain()
      }
      if isComplete || error != nil {
        self.onLog?(error.map { "read error: \($0.localizedDescription)" } ?? "broker closed the connection")
        self.retry()
        return
      }
      self.receive()
    }
  }

  private func drain() {
    while true {
      guard buffer.count >= 2 else { return }
      // Remaining Length is a varint of up to four bytes.
      var length = 0
      var multiplier = 1
      var index = 1
      while true {
        guard index < buffer.count, index <= 4 else { return }
        let byte = buffer[buffer.startIndex + index]
        length += Int(byte & 0x7F) * multiplier
        multiplier *= 128
        index += 1
        if byte & 0x80 == 0 { break }
      }
      let total = index + length
      guard buffer.count >= total else { return }
      let packet = buffer.subdata(in: buffer.startIndex..<(buffer.startIndex + total))
      buffer.removeFirst(total)
      handle(packet, headerLength: index)
    }
  }

  private func handle(_ packet: Data, headerLength: Int) {
    switch packet[packet.startIndex] & 0xF0 {
    case 0x20:  // CONNACK
      let code = packet.count > headerLength + 1 ? packet[packet.startIndex + headerLength + 1] : 0xFF
      guard code == 0 else {
        onLog?("broker refused the connection: \(MQTTClient.reason(code))")
        retry()
        return
      }
      acknowledged = true
      attempt = 0
      state.withLock { $0 = .connected }
      startPings()
    case 0xD0:  // PINGRESP
      awaitingPong = false
    default:
      break
    }
  }

  private func startPings() {
    pingTimer?.cancel()
    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now() + 30, repeating: 30)
    timer.setEventHandler { [weak self] in
      guard let self else { return }
      if self.awaitingPong {
        self.onLog?("broker missed a ping")
        self.retry()
        return
      }
      self.awaitingPong = true
      self.connection?.send(content: Data([0xC0, 0x00]), completion: .idempotent)
    }
    timer.resume()
    pingTimer = timer
  }

  private func remainingLength(_ value: Int) -> Data {
    var out = Data()
    var length = value
    repeat {
      var digit = UInt8(length % 128)
      length /= 128
      if length > 0 { digit |= 0x80 }
      out.append(digit)
    } while length > 0
    return out
  }

  private static func reason(_ code: UInt8) -> String {
    switch code {
    case 1: return "unacceptable protocol version"
    case 2: return "identifier rejected"
    case 3: return "server unavailable"
    case 4: return "bad username or password"
    case 5: return "not authorised"
    default: return "code \(code)"
    }
  }
}

// MARK: - Console
//
// One queue owns stdout so a reconnect message cannot land in the middle of the
// status line.

final class Console: @unchecked Sendable {
  private let queue = DispatchQueue(label: "noise-mic.console")
  private let interactive = isatty(1) == 1
  private var dirty = false

  func status(_ line: String) {
    queue.async {
      if self.interactive {
        print("\r\u{1B}[2K" + line, terminator: "")
        fflush(stdout)
        self.dirty = true
      } else {
        print(line)
      }
    }
  }

  func log(_ line: String) {
    queue.async {
      if self.interactive && self.dirty {
        print("\r\u{1B}[2K", terminator: "")
        self.dirty = false
      }
      print("noise-mic: " + line)
      fflush(stdout)
    }
  }

  func finish() {
    queue.sync {
      if self.interactive && self.dirty { print("") }
      fflush(stdout)
    }
  }
}

// MARK: - Monitor

final class Monitor: @unchecked Sendable {
  private let config: Config
  private let console: Console
  private let mqtt: MQTTClient
  private let engine = AVAudioEngine()
  private let queue = DispatchQueue(label: "noise-mic.publish")
  private var analyzer: Analyzer?
  private var timer: DispatchSourceTimer?
  private var sequence: UInt32 = 0
  private var intervals = 0
  private var quietIntervals = 0
  private var warnedAboutQuiet = false
  // Per-interval mean squares, newest last, for the trailing windows.
  private var historyA: [Double] = []
  private var historyC: [Double] = []
  private var tapInstalled = false

  init(config: Config, console: Console) {
    self.config = config
    self.console = console
    mqtt = MQTTClient(host: config.host, port: config.port)
    mqtt.onLog = { [weak console] in console?.log($0) }
  }

  func start() throws {
    try installTap()
    mqtt.start()

    NotificationCenter.default.addObserver(
      forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil
    ) { [weak self] _ in
      // Plugging in AirPods swaps the default input and invalidates the tap.
      // Without this the script keeps running and silently stops hearing.
      self?.queue.async { self?.reconfigure() }
    }

    let timer = DispatchSource.makeTimerSource(queue: queue)
    timer.schedule(deadline: .now() + .seconds(config.interval), repeating: .seconds(config.interval))
    timer.setEventHandler { [weak self] in self?.tick() }
    timer.resume()
    self.timer = timer

    console.log("publishing \(config.topic) to \(config.host):\(config.port) every \(config.interval)s")
  }

  private func installTap() throws {
    let input = engine.inputNode

    // Pointing the engine at a specific device has to happen before the format
    // is read, since the format belongs to the device.
    var chosen = config.input.flatMap { requested in
      AudioDevices.withInputs().first { $0.name.localizedCaseInsensitiveContains(requested) }
    }
    if let requested = config.input, chosen == nil {
      let names = AudioDevices.withInputs().map(\.name).joined(separator: ", ")
      throw NSError(
        domain: "noise-mic", code: 2,
        userInfo: [
          NSLocalizedDescriptionKey:
            "no microphone matching \"\(requested)\". Available: \(names.isEmpty ? "none" : names)"
        ])
    }
    if let device = chosen, let unit = input.audioUnit {
      var id = device.id
      let status = AudioUnitSetProperty(
        unit, kAudioOutputUnitProperty_CurrentDevice, kAudioUnitScope_Global, 0, &id,
        UInt32(MemoryLayout<AudioDeviceID>.size))
      guard status == noErr else {
        throw NSError(
          domain: "noise-mic", code: 3,
          userInfo: [NSLocalizedDescriptionKey: "could not select \(device.name) (status \(status))"])
      }
    }
    if chosen == nil, let id = AudioDevices.defaultInput() {
      chosen = AudioDevices.withInputs().first { $0.id == id }
    }

    let format = input.outputFormat(forBus: 0)
    guard format.sampleRate > 0 else {
      throw NSError(
        domain: "noise-mic", code: 1,
        userInfo: [
          NSLocalizedDescriptionKey:
            "no audio input available — check that a microphone is connected and that your terminal has microphone access"
        ])
    }
    let analyzer = Analyzer(sampleRate: format.sampleRate, fftSize: config.fftSize)
    self.analyzer = analyzer
    // Never touch mainMixerNode: reading it wires the input to the speakers.
    input.installTap(onBus: 0, bufferSize: 4096, format: format) { buffer, _ in
      analyzer.process(buffer)
    }
    tapInstalled = true
    engine.prepare()
    try engine.start()
    console.log(
      "listening on \(chosen?.name ?? "the system input") at \(Int(format.sampleRate)) Hz, \(config.fftSize)-point transform"
    )
  }

  private func reconfigure() {
    guard tapInstalled else { return }
    engine.stop()
    engine.inputNode.removeTap(onBus: 0)
    tapInstalled = false
    do {
      try installTap()
      console.log("audio configuration changed, tap reinstalled")
    } catch {
      console.log("audio configuration changed and could not be recovered: \(error.localizedDescription)")
    }
  }

  private func tick() {
    guard let analyzer else { return }
    let snapshot = analyzer.shared.withLock { acc -> Accumulator in
      let copy = acc
      acc.reset()
      return copy
    }

    guard snapshot.samples > 0 else {
      noteQuiet("no audio is arriving from the input")
      return
    }
    let meanSquareA = snapshot.sumSquaresA / Double(snapshot.samples)
    let meanSquareC = snapshot.sumSquaresC / Double(snapshot.samples)

    historyA.append(meanSquareA)
    historyC.append(meanSquareC)
    let longest = 1800 / config.interval
    if historyA.count > longest {
      historyA.removeFirst(historyA.count - longest)
      historyC.removeFirst(historyC.count - longest)
    }

    intervals += 1
    // The Fast detectors and the transform ring start empty, so the first
    // couple of seconds read low. Better to say nothing than to draw a dip.
    guard intervals > 2 else { return }

    let cal = config.calibration
    func level(_ power: Double) -> Double { 10 * log10(power) + cal }

    // Anything at or under the floor of the encoding reaches the UI as a flat
    // 20 dB, which is indistinguishable from a script that is not working. It
    // is still worth publishing — a real monitor in a silent room reports its
    // floor too — but it is worth saying so once.
    if dbByte(level(meanSquareA)) == 0 {
      noteQuiet(
        String(
          format: "the input is at %.0f dBFS, so every level is pinned to the 20 dB floor",
          10 * log10(meanSquareA)))
    } else {
      quietIntervals = 0
      warnedAboutQuiet = false
    }

    var bands = [UInt8](repeating: 0, count: BAND_COUNT)
    if snapshot.frames > 0 {
      for i in 0..<BAND_COUNT {
        bands[i] = dbByte(level(snapshot.bandPower[i] / Double(snapshot.frames)))
      }
    }

    sequence &+= 1
    let record = Recording(
      seqNo: sequence,
      bands: bands,
      laeq: level(meanSquareA),
      lceq: level(meanSquareC),
      lafmax: level(snapshot.maxFastA),
      lcfmax: level(snapshot.maxFastC),
      lcpeak: 20 * log10(snapshot.maxAbsC) + cal,
      intervalSeconds: UInt32(config.interval),
      batteryMv: config.batteryMv,
      laeq5m: trailing(historyA, seconds: 300).map(level),
      lceq5m: trailing(historyC, seconds: 300).map(level),
      laeq30m: trailing(historyA, seconds: 1800).map(level),
      lceq30m: trailing(historyC, seconds: 1800).map(level))

    mqtt.publish(topic: config.topic, payload: encode(record))

    let state = mqtt.state.withLock { $0.rawValue }
    console.status(
      String(
        format: "[%@] #%d  LAeq %.1f  LCeq %.1f  LAFmax %.1f  LCpeak %.1f dB",
        state, sequence, record.laeq, record.lceq, record.lafmax, record.lcpeak))
  }

  /// Mean power over the trailing window, or nil while it is still filling —
  /// the UI shows "—" for an absent field, which is honest, and 20 dB for a
  /// zero one, which is not.
  private func trailing(_ history: [Double], seconds: Int) -> Double? {
    let wanted = seconds / config.interval
    guard !history.isEmpty else { return nil }
    guard history.count >= wanted || config.warm else { return nil }
    let slice = history.suffix(wanted)
    return slice.reduce(0, +) / Double(slice.count)
  }

  private func noteQuiet(_ detail: String) {
    quietIntervals += 1
    guard quietIntervals == 5, !warnedAboutQuiet else { return }
    warnedAboutQuiet = true
    console.log(
      """
      \(detail). If that is unexpected: your terminal may not have microphone \
      access (System Settings › Privacy & Security › Microphone), the input \
      volume may be down (System Settings › Sound › Input), or --calibration \
      may be too low for this microphone.
      """)
  }

  func stop(completion: @escaping () -> Void) {
    timer?.cancel()
    if tapInstalled {
      engine.stop()
      engine.inputNode.removeTap(onBus: 0)
      tapInstalled = false
    }
    mqtt.shutdown(completion: completion)
  }
}

// MARK: - Self test

func runSelfTest(_ config: Config) -> Never {
  var failures = 0
  func check(_ name: String, _ passed: Bool, _ detail: String = "") {
    print("  \(passed ? "ok  " : "FAIL") \(name)\(detail.isEmpty ? "" : "  — \(detail)")")
    if !passed { failures += 1 }
  }

  let fs = 48000.0

  print("\nAnalog prototype against IEC 61672-1 table 3 (±0.15 dB)")
  let toleranceA: [(Double, Double)] = [
    (31.5, -39.4), (63, -26.2), (125, -16.1), (250, -8.6), (500, -3.2),
    (1000, 0.0), (2000, 1.2), (4000, 1.0), (8000, -1.1), (16000, -6.6),
  ]
  let toleranceC: [(Double, Double)] = [
    (31.5, -3.0), (63, -0.8), (125, -0.2), (1000, 0.0), (4000, -0.8),
    (8000, -3.0), (16000, -8.5),
  ]
  for (f, expected) in toleranceA {
    let got = 20 * log10(Weighting.a.analogMagnitude(f))
    check("A at \(f) Hz", abs(got - expected) < 0.15, String(format: "%.2f vs %.1f dB", got, expected))
  }
  for (f, expected) in toleranceC {
    let got = 20 * log10(Weighting.c.analogMagnitude(f))
    check("C at \(f) Hz", abs(got - expected) < 0.15, String(format: "%.2f vs %.1f dB", got, expected))
  }

  // The bilinear transform compresses the frequency axis and puts a zero at
  // Nyquist, so a 48 kHz design cannot follow the analog curve into the top
  // bands however the poles are placed — 16 kHz is two thirds of the way to
  // Nyquist. That deviation is reported rather than asserted; the tolerance at
  // 16 kHz in IEC 61672-1 class 1 is +3.5/−17 dB, which it sits inside. What is
  // worth asserting is the part of the range that carries the level. Both
  // mappings are printed because the choice between them lives on that trade.
  print("\nDigital cascade against the analog prototype at 48 kHz")
  for weighting in [Weighting.a, Weighting.c] {
    let name = weighting == .a ? "A" : "C"
    for prewarp in [false, true] {
      var worstBelow4k = 0.0
      var worstBelow4kAt = 0.0
      var worstOverall = 0.0
      var worstOverallAt = 0.0
      let sections = weighting.sections(sampleRate: fs, prewarp: prewarp)
      for f in BAND_FREQUENCIES {
        let digital = 20 * log10(Weighting.response(sections, frequency: f, sampleRate: fs).magnitude)
        let analog = 20 * log10(weighting.analogMagnitude(f))
        let deviation = abs(digital - analog)
        if deviation > worstOverall {
          worstOverall = deviation
          worstOverallAt = f
        }
        if f <= 4000, deviation > worstBelow4k {
          worstBelow4k = deviation
          worstBelow4kAt = f
        }
      }
      print(
        String(
          format: "  %@, prewarp %@  worst %.3f dB at %.0f Hz, and %.3f dB at %.0f Hz up to 4 kHz",
          name, prewarp ? "on " : "off", worstOverall, worstOverallAt, worstBelow4k, worstBelow4kAt))
      if !prewarp {
        // Assert the default mapping, and only over the bands that carry the
        // weighted level; see the note above.
        check(
          "\(name) cascade tracks the prototype to 4 kHz", worstBelow4k < 0.1,
          String(format: "%.3f dB", worstBelow4k))
        let deviations = BAND_FREQUENCIES.map { f -> (Double, Double) in
          let digital = 20 * log10(Weighting.response(sections, frequency: f, sampleRate: fs).magnitude)
          return (f, digital - 20 * log10(weighting.analogMagnitude(f)))
        }.filter { abs($0.1) > 0.02 }
        if !deviations.isEmpty {
          print(
            "       past 0.02 dB at  "
              + deviations.map { String(format: "%.0f Hz %+.2f", $0.0, $0.1) }.joined(separator: ",  "))
        }
      }
    }
    let atOneKilohertz = Weighting.response(
      weighting.sections(sampleRate: fs), frequency: 1000, sampleRate: fs
    ).magnitude
    check("\(name) is unity at 1 kHz", abs(atOneKilohertz - 1) < 1e-12)
  }

  print("\nvDSP cascade against a scalar reference")
  do {
    let sections = Weighting.a.sections(sampleRate: fs)
    let n = 48000
    var input = [Double](repeating: 0, count: n)
    var generator = SystemRandomNumberGenerator()
    for i in 0..<n { input[i] = Double.random(in: -1...1, using: &generator) }

    var viaVDSP = [Double](repeating: 0, count: n)
    let chain = BiquadChain(sections)
    input.withUnsafeBufferPointer { src in
      viaVDSP.withUnsafeMutableBufferPointer { dst in
        chain.run(src.baseAddress!, dst.baseAddress!, n)
      }
    }

    // Transposed direct form II, one section at a time — the arrangement vDSP
    // documents, so a swapped sign or a reordered coefficient shows up here.
    var reference = input
    for s in sections {
      var z1 = 0.0, z2 = 0.0
      for i in 0..<n {
        let x = reference[i]
        let y = s.b0 * x + z1
        z1 = s.b1 * x - s.a1 * y + z2
        z2 = s.b2 * x - s.a2 * y
        reference[i] = y
      }
    }
    var worst = 0.0
    for i in 0..<n { worst = max(worst, abs(viaVDSP[i] - reference[i])) }
    check("vDSP matches the reference", worst < 1e-9, String(format: "%.2e", worst))
  }

  print("\nTransform scaling and packing")
  do {
    let size = config.fftSize
    let spectrum = Spectrum(size: size, sampleRate: fs)
    let amplitude = 0.25
    let n = size * 4
    var tone = [Double](repeating: 0, count: n)
    for i in 0..<n {
      tone[i] = amplitude * sin(2 * Double.pi * 1000 * Double(i) / fs)
    }
    tone.withUnsafeBufferPointer { spectrum.push($0.baseAddress!, count: n) }
    let drained = spectrum.drain()
    check("frames were produced", drained.frames > 0, "\(drained.frames)")
    let perFrame = drained.power.map { $0 / Double(max(1, drained.frames)) }
    let total = perFrame.reduce(0, +)
    let expected = amplitude * amplitude / 2
    check(
      "band sum recovers the tone's mean square",
      abs(10 * log10(total / expected)) < 0.1,
      String(format: "%.4f vs %.4f", total, expected))
    let oneKilohertz = BAND_FREQUENCIES.firstIndex(of: 1000)!
    check(
      "the 1 kHz band holds it",
      perFrame[oneKilohertz] / total > 0.99,
      String(format: "%.4f", perFrame[oneKilohertz] / total))
    var leakage = 0.0
    for (i, p) in perFrame.enumerated() where i != oneKilohertz {
      leakage = max(leakage, p)
    }
    check(
      "every other band is 40 dB down",
      10 * log10(leakage / total) < -40,
      String(format: "%.1f dB", 10 * log10(leakage / total)))
  }
  do {
    let spectrum = Spectrum(size: config.fftSize, sampleRate: fs)
    let n = config.fftSize * 4
    var noise = [Double](repeating: 0, count: n)
    var generator = SystemRandomNumberGenerator()
    for i in 0..<n { noise[i] = Double.random(in: -0.5...0.5, using: &generator) }
    noise.withUnsafeBufferPointer { spectrum.push($0.baseAddress!, count: n) }
    let drained = spectrum.drain()
    let total = drained.power.reduce(0, +) / Double(max(1, drained.frames))
    // The bands stop at 16 kHz's upper edge, so compare against the same span
    // of the signal rather than the whole of it.
    let covered = 16000 * pow(2, 1.0 / 6) / (fs / 2)
    let meanSquare = noise.reduce(0) { $0 + $1 * $1 } / Double(n) * covered
    check(
      "band sum recovers broadband power",
      abs(10 * log10(total / meanSquare)) < 0.2,
      String(format: "%.2f dB", 10 * log10(total / meanSquare)))
  }

  print("\nLevel chain")
  do {
    let amplitude = 0.25
    let n = 48000 * 2
    var tone = [Double](repeating: 0, count: n)
    for i in 0..<n { tone[i] = amplitude * sin(2 * Double.pi * 1000 * Double(i) / fs) }
    var weighted = [Double](repeating: 0, count: n)
    let chain = BiquadChain(Weighting.a.sections(sampleRate: fs))
    tone.withUnsafeBufferPointer { src in
      weighted.withUnsafeMutableBufferPointer { dst in
        chain.run(src.baseAddress!, dst.baseAddress!, n)
      }
    }
    // Skip the first half so the filter's transient is behind us.
    let settled = weighted[(n / 2)...]
    let meanSquare = settled.reduce(0) { $0 + $1 * $1 } / Double(settled.count)
    let laeq = 10 * log10(meanSquare) + config.calibration
    let expected = 20 * log10(amplitude / 2.0.squareRoot()) + config.calibration
    check(
      "LAeq of a 1 kHz tone", abs(laeq - expected) < 0.05,
      String(format: "%.3f vs %.3f dB", laeq, expected))
    let peak = settled.map(abs).max()!
    let lcpeak = 20 * log10(peak) + config.calibration
    let expectedPeak = 20 * log10(amplitude) + config.calibration
    check(
      "LCpeak of the same tone", abs(lcpeak - expectedPeak) < 0.1,
      String(format: "%.3f vs %.3f dB", lcpeak, expectedPeak))
  }

  print("\nWire format")
  do {
    check("20 dB encodes to 0", dbByte(20) == 0)
    check("147.5 dB encodes to 255", dbByte(147.5) == 255)
    check("90 dB encodes to 140", dbByte(90) == 140)
    check("300 dB clamps to 255", dbByte(300) == 255)
    check("-inf encodes to 0", dbByte(-.infinity) == 0)

    var bands = [UInt8](repeating: 0, count: BAND_COUNT)
    for i in 0..<BAND_COUNT { bands[i] = UInt8(100 + i) }
    let record = Recording(
      seqNo: 1234, bands: bands, laeq: 60, lceq: 62, lafmax: 70, lcfmax: 68,
      lcpeak: 80, intervalSeconds: 1, batteryMv: 3900, laeq5m: 58, lceq5m: 61,
      laeq30m: nil, lceq30m: nil)
    let bytes = encode(record)
    // The tag and its length, as a pair — a bare 0x1f would also match a band
    // value, and a bare 0x60 matches whatever LCFmax happens to encode to.
    let bandsHeader = bytes.indices.contains { i in
      i + 1 < bytes.endIndex && bytes[i] == 0x12 && bytes[i + 1] == 0x1F
    }
    check("the bands field is tagged as 31 bytes", bandsHeader)

    var withThirtyMinutes = record
    withThirtyMinutes.laeq30m = 56
    withThirtyMinutes.lceq30m = 59
    check(
      "the 30 m fields stay off the wire until they exist",
      encode(withThirtyMinutes).count == bytes.count + 4,
      "\(bytes.count) then \(encode(withThirtyMinutes).count) bytes")
    print("  hex  " + bytes.map { String(format: "%02x", $0) }.joined())
    print("""

      Decode that with the repo's own generated code to close the loop:
        npx tsx -e "import {NoiseRecording} from './src/proto/noise'; \
      console.log(NoiseRecording.decode(Buffer.from(process.argv[1],'hex')))" \
      \(bytes.map { String(format: "%02x", $0) }.joined())
      """)
  }

  print("\n\(failures == 0 ? "All checks passed." : "\(failures) check(s) failed.")")
  exit(failures == 0 ? 0 : 1)
}

// MARK: - Entry point

let config = parseConfig()
if config.selftest { runSelfTest(config) }

let console = Console()
let monitor = Monitor(config: config, console: console)

switch AVCaptureDevice.authorizationStatus(for: .audio) {
case .denied, .restricted:
  fail(
    "microphone access is denied. Grant it to your terminal in System Settings › Privacy & Security › Microphone."
  )
case .notDetermined:
  // The prompt is attributed to whatever terminal launched us, since an
  // interpreted script has no bundle of its own.
  let semaphore = DispatchSemaphore(value: 0)
  AVCaptureDevice.requestAccess(for: .audio) { _ in semaphore.signal() }
  semaphore.wait()
  if AVCaptureDevice.authorizationStatus(for: .audio) != .authorized {
    fail("microphone access was not granted")
  }
default:
  break
}

do {
  try monitor.start()
} catch {
  fail(error.localizedDescription)
}

// A C signal handler cannot safely call back into Swift, so ignore the signal
// and let a dispatch source do the work on the main queue instead.
for sig in [SIGINT, SIGTERM] { signal(sig, SIG_IGN) }
var signalSources: [DispatchSourceSignal] = []
for sig in [SIGINT, SIGTERM] {
  let source = DispatchSource.makeSignalSource(signal: sig, queue: .main)
  source.setEventHandler {
    console.finish()
    monitor.stop { exit(0) }
    // In case the broker never acknowledges the disconnect.
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { exit(0) }
  }
  source.resume()
  signalSources.append(source)
}

dispatchMain()
