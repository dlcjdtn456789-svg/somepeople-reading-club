export const colors = {
  bg: '#0f1115',
  surface: '#191c23',
  surfaceHigh: '#232731',
  border: '#2e3340',
  text: '#f2f4f8',
  textDim: '#9aa1b1',
  accent: '#ffb547',
  good: '#3ddc84',
  low: '#5aa9ff',
  high: '#ff7a59',
};

/** Colour for a deviation in cents: in tune, flat (tighten) or sharp (loosen). */
export function deviationColor(cents: number, tolerance: number): string {
  if (Math.abs(cents) <= tolerance) return colors.good;
  return cents < 0 ? colors.low : colors.high;
}
