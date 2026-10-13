import logger from "./logger.js";

// Real-time frequency data for the mini player's visualizer, read off the very
// media elements the main window is already playing through.
//
// Two hard constraints shape this file:
//  1. createMediaElementSource() can only ever be called ONCE per element — a
//     second call throws and, worse, leaves the element muted. Hence the cache.
//  2. Once an element is routed into the graph, its audio reaches the speakers
//     only through analyser -> destination. Any early return that skips that
//     connection silences playback, so setup is all-or-nothing.
// 1024 gives 512 bins — enough resolution that 72 log-spaced bands each cover
// a real range instead of several bands sharing one bin down in the bass.
const FFT_SIZE = 1024;

// Bands published over IPC. The canvas resamples to whatever bar count it is
// configured for, so this is a transport resolution, not a visual one: high
// enough to feed 64–80 bars without sending all 512 raw bins 30×/second.
const BAND_COUNT = 72;

// Musical content lives between roughly these two; above ~16 kHz there is
// almost no energy in compressed audio, and sampling it would leave the right
// edge of the visualiser permanently flat.
const MIN_HZ = 30;
const MAX_HZ = 16000;

// Sound energy falls off steeply with frequency, so linear band gains would
// make the treble half look dead next to the bass. This lifts the high bands
// back into view — enough to keep them alive, not so much that bass stops
// dominating (which it should: it's what people feel as "the beat").
const TREBLE_TILT = 1.5;

let audioContext = null;
const analysersByElement = new WeakMap();
let failed = false;

// Bin index boundaries for BAND_COUNT logarithmically spaced bands. Log spacing
// is what makes the bars track how hearing works: an octave occupies the same
// width whether it's 60→120 Hz or 6→12 kHz. Linear spacing would cram every
// octave below 1 kHz — where nearly all musical energy sits — into the first
// couple of bars.
function bandEdges(binCount, sampleRate) {
  const hzPerBin = sampleRate / 2 / binCount;
  const firstBin = Math.max(1, Math.floor(MIN_HZ / hzPerBin));
  const lastBin = Math.min(binCount - 1, Math.ceil(MAX_HZ / hzPerBin));
  const ratio = lastBin / firstBin;

  const edges = new Array(BAND_COUNT + 1);
  for (let i = 0; i <= BAND_COUNT; i += 1) {
    edges[i] = Math.round(firstBin * ratio ** (i / BAND_COUNT));
  }
  // Every band must own at least one bin, otherwise the low bands (where the
  // log curve is densest) collapse onto each other and move in lockstep.
  for (let i = 1; i <= BAND_COUNT; i += 1) {
    if (edges[i] <= edges[i - 1]) edges[i] = edges[i - 1] + 1;
  }
  return edges;
}

function ensureContext() {
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

// Returns the analyser for an element, wiring it into the audio graph on first
// use. Returns null once anything has failed, which is the signal for callers
// to stop asking and let the visualizer fall back to its idle state.
function ensureAnalyser(element) {
  if (failed || !element) return null;
  const cached = analysersByElement.get(element);
  if (cached) return cached;
  try {
    const ctx = ensureContext();
    const source = ctx.createMediaElementSource(element);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    // Deliberately light: the canvas applies its own asymmetric attack/decay,
    // and smoothing hard in both places makes the bars feel laggy rather than
    // smooth. This is just enough to take the strobe off the raw FFT.
    analyser.smoothingTimeConstant = 0.65;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    const entry = {
      analyser,
      data: new Uint8Array(analyser.frequencyBinCount),
      // Band edges depend on the context's sample rate, so they're computed
      // once here rather than on every frame.
      edges: bandEdges(analyser.frequencyBinCount, ctx.sampleRate),
      // Reused across frames: this runs 30×/second and allocating a fresh
      // array each time is pure garbage-collector pressure.
      bands: new Array(BAND_COUNT),
    };
    analysersByElement.set(element, entry);
    return entry;
  } catch (e) {
    failed = true;
    logger.error("Não foi possível ligar o analisador de áudio. O visualizador ficará em repouso", {
      message: e.message,
    });
    return null;
  }
}

// The browser suspends a context created before any user gesture; playback is
// itself the gesture, so resuming here is enough.
export function resumeAnalyser() {
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
}

export function attachAnalyser(element) {
  return Boolean(ensureAnalyser(element));
}

// BAND_COUNT values in 0..1, or null when analysis isn't available.
//
// Each band is the *peak* of its bins rather than the mean: averaging over a
// wide high-frequency band buries a real transient (a hi-hat spanning two bins
// out of forty) under the silence around it, which is what makes averaged
// visualisers look dead above the mids.
export function readSpectrum(element) {
  const entry = ensureAnalyser(element);
  if (!entry) return null;
  const { analyser, data, edges, bands } = entry;
  analyser.getByteFrequencyData(data);

  for (let i = 0; i < BAND_COUNT; i += 1) {
    const start = edges[i];
    const end = Math.min(edges[i + 1], data.length);

    let peak = 0;
    for (let bin = start; bin < end; bin += 1) {
      if (data[bin] > peak) peak = data[bin];
    }

    const gain = 1 + TREBLE_TILT * (i / (BAND_COUNT - 1));
    // A gentle gamma lifts quiet passages into visible range without letting
    // loud ones clip flat against the ceiling.
    bands[i] = Math.min(1, ((peak / 255) * gain) ** 0.8);
  }
  // Copied because the caller sends this over IPC while the next frame is
  // already overwriting the reused buffer.
  return bands.slice();
}
