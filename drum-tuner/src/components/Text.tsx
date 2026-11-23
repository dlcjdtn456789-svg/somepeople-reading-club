import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';

/** Pretendard weights bundled in assets/fonts (subset: KS X 1001 Hangul + Latin). */
export const FONT_FILES = {
  'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.otf'),
  'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.otf'),
  'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.otf'),
  'Pretendard-ExtraBold': require('../../assets/fonts/Pretendard-ExtraBold.otf'),
};

type Family = keyof typeof FONT_FILES;

function familyFor(weight: TextStyle['fontWeight']): Family {
  const w = typeof weight === 'number' ? weight : weight === 'bold' ? 700 : Number(weight) || 400;
  if (w >= 800) return 'Pretendard-ExtraBold';
  if (w >= 700) return 'Pretendard-Bold';
  if (w >= 600) return 'Pretendard-SemiBold';
  return 'Pretendard-Regular';
}

/**
 * Drop-in replacement for React Native's Text that renders in Pretendard.
 * Custom fonts ship one file per weight, so `fontWeight` is mapped to the
 * matching family instead of letting the OS synthesise bold.
 */
export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const { fontWeight, fontFamily, ...rest } = flat;
  return <RNText {...props} style={[rest, { fontFamily: fontFamily ?? familyFor(fontWeight) }]} />;
}
