import { fft, nextPow2 } from './fft.ts';

export type PeakMode =
  /** Lowest strong spectral peak — the drum's overall (fundamental) pitch. */
  | 'fundamental'
  /** Loudest spectral peak — the pitch you hear when tapping near a lug. */
  | 'dominant';

export type SpectralPeak = {
  frequency: number;
  magnitude: number;
};

export type PitchResult = {
  frequency: number;
  /** Peak height relative to the average spectrum level (higher = cleaner tone). */
  clarity: number;
  /** Strongest peaks, loudest first. */
  peaks: SpectralPeak[];
};

export type AnalyzeOptions = {
  minHz?: number;
  maxHz?: number;
  mode?: PeakMode;
  /** For 'fundamental': a peak counts as strong when ≥ this fraction of the loudest. */
  strongPeakRatio?: number;
  /** Minimum FFT size (zero padding gives finer interpolation). */
  minFftSize?: number;
};

const DEFAULTS: Required<AnalyzeOptions> = {
  minHz: 40,
  maxHz: 1000,
  mode: 'fundamental',
  strongPeakRatio: 0.5,
  minFftSize: 16384,
};

/**
 * Estimates the pitch of a single drum hit.
 *
 * Drums are inharmonic, so time-domain pitch trackers (autocorrelation/YIN)
 * that assume a harmonic series are unreliable. Instead we window the decay
 * of the hit, take a zero-padded FFT and pick a spectral peak, refined with
 * Gaussian (log-parabolic) interpolation.
 */
export function analyzeHit(
  samples: Float32Array,
  sampleRate: number,
  options: AnalyzeOptions = {},
): PitchResult | null {
  const opts = { ...DEFAULTS, ...options };
  const len = samples.length;
  if (len < 256 || sampleRate <= 0) return null;

  let mean = 0;
  for (let i = 0; i < len; i++) mean += samples[i];
  mean /= len;

  const n = Math.max(opts.minFftSize, nextPow2(len) * 2);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < len; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1)); // Hann
    re[i] = (samples[i] - mean) * w;
  }
  fft(re, im);

  const binHz = sampleRate / n;
  const lo = Math.max(1, Math.floor(opts.minHz / binHz));
  const hi = Math.min(n / 2 - 2, Math.ceil(opts.maxHz / binHz));
  if (hi - lo < 4) return null;

  const mag = new Float64Array(hi - lo + 3);
  let sum = 0;
  for (let k = lo - 1; k <= hi + 1; k++) {
    const m = Math.hypot(re[k], im[k]);
    mag[k - lo + 1] = m;
    if (k >= lo && k <= hi) sum += m;
  }
  const avg = sum / (hi - lo + 1);
  if (avg <= 0) return null;

  // Local maxima, must dominate ±3 bins to ignore window ripple.
  const peaks: SpectralPeak[] = [];
  const reach = 3;
  for (let k = lo; k <= hi; k++) {
    const idx = k - lo + 1;
    const m = mag[idx];
    let isPeak = m > avg;
    for (let d = 1; d <= reach && isPeak; d++) {
      const l = idx - d >= 0 ? mag[idx - d] : 0;
      const r = idx + d < mag.length ? mag[idx + d] : 0;
      if (l > m || r >= m) isPeak = false;
    }
    if (!isPeak) continue;
    peaks.push({ frequency: interpolate(mag, idx, k, binHz), magnitude: m });
  }
  if (peaks.length === 0) return null;

  peaks.sort((a, b) => b.magnitude - a.magnitude);
  const loudest = peaks[0];
  let chosen = loudest;
  if (opts.mode === 'fundamental') {
    const threshold = loudest.magnitude * opts.strongPeakRatio;
    for (const p of peaks) {
      if (p.magnitude >= threshold && p.frequency < chosen.frequency) chosen = p;
    }
  }

  return {
    frequency: chosen.frequency,
    clarity: chosen.magnitude / avg,
    peaks: peaks.slice(0, 5),
  };
}

function interpolate(mag: Float64Array, idx: number, bin: number, binHz: number): number {
  const a = Math.log(mag[idx - 1] + 1e-12);
  const b = Math.log(mag[idx] + 1e-12);
  const c = Math.log(mag[idx + 1] + 1e-12);
  const denom = a - 2 * b + c;
  const offset = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
  return (bin + Math.max(-0.5, Math.min(0.5, offset))) * binHz;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export type NoteInfo = {
  name: string;
  octave: number;
  /** e.g. "D#3" */
  label: string;
  /** Deviation from the nearest equal-tempered note, -50..+50. */
  cents: number;
  /** Frequency of that nearest note. */
  noteFrequency: number;
};

export function frequencyToNote(frequency: number, a4 = 440): NoteInfo {
  const midiFloat = 69 + 12 * Math.log2(frequency / a4);
  const midi = Math.round(midiFloat);
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return {
    name,
    octave,
    label: `${name}${octave}`,
    cents: Math.round((midiFloat - midi) * 100),
    noteFrequency: a4 * Math.pow(2, (midi - 69) / 12),
  };
}

/** Signed distance in cents from `reference` to `frequency`. */
export function centsBetween(frequency: number, reference: number): number {
  return 1200 * Math.log2(frequency / reference);
}
