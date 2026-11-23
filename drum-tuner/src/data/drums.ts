export type DrumPreset = {
  id: string;
  name: string;
  /** Commonly used fundamental range in Hz (reference only — tune to taste). */
  range: [number, number];
};

export const DRUMS: DrumPreset[] = [
  { id: 'kick22', name: '킥 22"', range: [45, 70] },
  { id: 'kick20', name: '킥 20"', range: [50, 75] },
  { id: 'snare14', name: '스네어 14"', range: [170, 330] },
  { id: 'tom10', name: '탐 10"', range: [150, 250] },
  { id: 'tom12', name: '탐 12"', range: [120, 200] },
  { id: 'tom13', name: '탐 13"', range: [105, 180] },
  { id: 'floor14', name: '플로어 14"', range: [85, 140] },
  { id: 'floor16', name: '플로어 16"', range: [70, 120] },
];

/** Frequency window the analyser searches for a given drum's fundamental. */
export function analysisRange(drum: DrumPreset): { minHz: number; maxHz: number } {
  return {
    minHz: Math.max(30, Math.round(drum.range[0] * 0.6)),
    maxHz: Math.round(drum.range[1] * 1.6),
  };
}

export function defaultTarget(drum: DrumPreset): number {
  return Math.round((drum.range[0] + drum.range[1]) / 2);
}

/** Lug tapping produces higher pitches than the fundamental. */
export const LUG_RANGE = { minHz: 80, maxHz: 1500 };

export const LUG_COUNTS = [4, 5, 6, 8, 10];
