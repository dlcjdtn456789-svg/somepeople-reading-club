/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHit, frequencyToNote, centsBetween } from './pitch.ts';
import { HitDetector, type CapturedHit } from './HitDetector.ts';

const SR = 48000;

/** Deterministic pseudo-random noise so tests are stable. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff - 0.5;
  };
}

/**
 * Synthetic drum hit: decaying membrane modes with the circular-membrane
 * ratios (1, 1.59, 2.14, 2.30) plus a noisy stick transient.
 */
function drumHit(f0: number, seconds: number, opts: { modeGains?: number[]; noise?: number; seed?: number } = {}) {
  const ratios = [1, 1.59, 2.14, 2.3];
  const gains = opts.modeGains ?? [1, 0.6, 0.4, 0.3];
  const rand = rng(opts.seed ?? 1);
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    ratios.forEach((r, k) => {
      v += gains[k] * Math.exp(-t * (6 + 4 * k)) * Math.sin(2 * Math.PI * f0 * r * t + k);
    });
    v += Math.exp(-t * 80) * rand() * 1.5; // stick attack
    v += rand() * (opts.noise ?? 0.01); // room noise
    out[i] = v * 0.3;
  }
  return out;
}

test('fundamental mode finds the drum fundamental within 1 Hz', () => {
  for (const f0 of [55, 98.3, 146, 220.5, 330]) {
    const hit = drumHit(f0, 0.3, { seed: Math.round(f0) });
    const res = analyzeHit(hit.subarray(960), SR, { mode: 'fundamental' });
    assert.ok(res, `no result for ${f0}`);
    assert.ok(Math.abs(res.frequency - f0) < 1, `expected ${f0}, got ${res.frequency.toFixed(2)}`);
  }
});

test('fundamental mode ignores a louder overtone only when fundamental is strong', () => {
  // Fundamental at 60% of the loudest overtone → still chosen.
  const hit = drumHit(120, 0.3, { modeGains: [0.6, 1, 0.3, 0.2] });
  const res = analyzeHit(hit, SR, { mode: 'fundamental' });
  assert.ok(res);
  assert.ok(Math.abs(res.frequency - 120) < 1, `got ${res.frequency}`);
});

test('dominant mode returns the loudest peak (lug tapping)', () => {
  const hit = drumHit(120, 0.3, { modeGains: [0.3, 1, 0.2, 0.1] });
  const res = analyzeHit(hit, SR, { mode: 'dominant' });
  assert.ok(res);
  assert.ok(Math.abs(res.frequency - 120 * 1.59) < 1.5, `got ${res.frequency}`);
});

test('respects the min/max frequency range', () => {
  const hit = drumHit(120, 0.3, { modeGains: [1, 0.8, 0.1, 0.1] });
  const res = analyzeHit(hit, SR, { mode: 'dominant', minHz: 150, maxHz: 400 });
  assert.ok(res);
  assert.ok(Math.abs(res.frequency - 120 * 1.59) < 1.5, `got ${res.frequency}`);
});

test('pure noise has low clarity', () => {
  const rand = rng(7);
  const noise = Float32Array.from({ length: 14400 }, () => rand() * 0.2);
  const res = analyzeHit(noise, SR);
  assert.ok(!res || res.clarity < 6, `clarity ${res?.clarity}`);
  const tone = analyzeHit(drumHit(200, 0.3), SR);
  assert.ok(tone && tone.clarity > 10, `tone clarity ${tone?.clarity}`);
});

test('frequencyToNote', () => {
  assert.deepEqual(
    { label: frequencyToNote(440).label, cents: frequencyToNote(440).cents },
    { label: 'A4', cents: 0 },
  );
  assert.equal(frequencyToNote(261.63).label, 'C4');
  assert.equal(frequencyToNote(82.41).label, 'E2');
  const sharp = frequencyToNote(440 * Math.pow(2, 20 / 1200));
  assert.equal(sharp.label, 'A4');
  assert.equal(sharp.cents, 20);
  assert.ok(Math.abs(centsBetween(880, 440) - 1200) < 1e-9);
});

test('HitDetector captures each hit once and ignores the decay', () => {
  const quiet = (sec: number, seed: number) => {
    const rand = rng(seed);
    return Float32Array.from({ length: Math.round(sec * SR) }, () => rand() * 0.002);
  };
  const parts = [quiet(0.5, 1), drumHit(150, 1.2, { seed: 2 }), quiet(0.3, 3), drumHit(180, 1.2, { seed: 4 }), quiet(0.4, 5)];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const stream = new Float32Array(total);
  let off = 0;
  for (const p of parts) {
    stream.set(p, off);
    off += p.length;
  }

  const hits: CapturedHit[] = [];
  const det = new HitDetector((h) => hits.push(h));
  // Feed in irregular native-sized chunks.
  for (let i = 0; i < stream.length; ) {
    const size = 1024 + ((i / 7) % 900 | 0);
    det.push(stream.subarray(i, i + size), SR);
    i += size;
  }

  assert.equal(hits.length, 2, `expected 2 hits, got ${hits.length}`);
  const freqs = hits.map((h) => analyzeHit(h.samples, h.sampleRate)!.frequency);
  assert.ok(Math.abs(freqs[0] - 150) < 1.5, `hit1 ${freqs[0]}`);
  assert.ok(Math.abs(freqs[1] - 180) < 1.5, `hit2 ${freqs[1]}`);
  assert.equal(hits[0].samples.length, Math.round(0.3 * SR));
});
