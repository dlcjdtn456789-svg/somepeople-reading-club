export type HitDetectorOptions = {
  /** Absolute RMS level a hit must exceed (0..1 float PCM). */
  minLevel?: number;
  /** A hit must be this many times louder than the running noise floor. */
  noiseRatio?: number;
  /** A hit must be this many times louder than the previous block (sharp attack). */
  attackRatio?: number;
  /** Skip the stick-attack transient before analysing. */
  skipMs?: number;
  /** Length of decay to analyse. */
  windowMs?: number;
  /** Ignore new onsets for this long after a hit was analysed. */
  cooldownMs?: number;
  /** Block size for level measurement. */
  blockSize?: number;
};

export type CapturedHit = {
  samples: Float32Array;
  sampleRate: number;
  /** Peak block RMS of the captured hit. */
  level: number;
};

type State = 'idle' | 'capturing' | 'cooldown';

const DEFAULTS: Required<HitDetectorOptions> = {
  minLevel: 0.01,
  noiseRatio: 5,
  attackRatio: 2.5,
  skipMs: 20,
  windowMs: 300,
  cooldownMs: 250,
  blockSize: 256,
};

/**
 * Streams mono PCM in, emits one captured window per drum hit.
 * Onsets are detected on block RMS: above an absolute floor, above the
 * adaptive noise floor, and a sharp rise over the previous block (so the
 * decaying ring of the previous hit does not re-trigger).
 */
export class HitDetector {
  private opts: Required<HitDetectorOptions>;
  private onHit: (hit: CapturedHit) => void;
  private sampleRate = 0;
  private state: State = 'idle';
  private noise = -1;
  private prevRms = 0;
  private capture = new Float32Array(0);
  private captured = 0;
  private skip = 0;
  private cooldownLeft = 0;
  private peakLevel = 0;
  private lastLevel = 0;

  constructor(onHit: (hit: CapturedHit) => void, options: HitDetectorOptions = {}) {
    this.onHit = onHit;
    this.opts = { ...DEFAULTS, ...options };
  }

  /** Latest block RMS, useful for a level meter. */
  get level(): number {
    return this.lastLevel;
  }

  setOptions(options: HitDetectorOptions): void {
    this.opts = { ...this.opts, ...options };
    this.reset();
  }

  reset(): void {
    this.state = 'idle';
    this.noise = -1;
    this.prevRms = 0;
    this.captured = 0;
    this.cooldownLeft = 0;
    this.peakLevel = 0;
    if (this.sampleRate > 0) this.allocate(this.sampleRate);
  }

  push(chunk: Float32Array, sampleRate: number): void {
    if (sampleRate !== this.sampleRate) {
      this.sampleRate = sampleRate;
      this.reset();
    }
    const { blockSize } = this.opts;
    for (let start = 0; start < chunk.length; start += blockSize) {
      const block = chunk.subarray(start, Math.min(start + blockSize, chunk.length));
      this.processBlock(block);
    }
  }

  private allocate(sampleRate: number): void {
    this.skip = Math.round((this.opts.skipMs / 1000) * sampleRate);
    const total = this.skip + Math.round((this.opts.windowMs / 1000) * sampleRate);
    if (this.capture.length !== total) this.capture = new Float32Array(total);
  }

  private processBlock(block: Float32Array): void {
    let sq = 0;
    for (let i = 0; i < block.length; i++) sq += block[i] * block[i];
    const rms = Math.sqrt(sq / block.length);
    this.lastLevel = rms;

    if (this.state === 'capturing') {
      this.append(block, rms);
      this.prevRms = rms;
      return;
    }

    if (this.state === 'cooldown') {
      this.cooldownLeft -= block.length;
      if (this.cooldownLeft <= 0) this.state = 'idle';
      this.prevRms = rms;
      return;
    }

    if (this.noise < 0) this.noise = rms;
    const threshold = Math.max(this.opts.minLevel, this.noise * this.opts.noiseRatio);
    const sharp = rms > this.prevRms * this.opts.attackRatio;
    if (rms > threshold && sharp) {
      this.state = 'capturing';
      this.captured = 0;
      this.peakLevel = 0;
      this.append(block, rms);
    } else if (rms < threshold) {
      // Adapt the noise floor slowly, only from non-hit blocks.
      this.noise = this.noise * 0.95 + rms * 0.05;
    }
    this.prevRms = rms;
  }

  private append(block: Float32Array, rms: number): void {
    if (rms > this.peakLevel) this.peakLevel = rms;
    const room = this.capture.length - this.captured;
    const take = Math.min(room, block.length);
    this.capture.set(block.subarray(0, take), this.captured);
    this.captured += take;
    if (this.captured < this.capture.length) return;

    const samples = this.capture.slice(this.skip);
    this.state = 'cooldown';
    this.cooldownLeft = Math.round((this.opts.cooldownMs / 1000) * this.sampleRate);
    this.onHit({ samples, sampleRate: this.sampleRate, level: this.peakLevel });
  }
}
