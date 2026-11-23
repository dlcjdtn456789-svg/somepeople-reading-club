import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../components/Text.tsx';
import { centsBetween } from '../audio/pitch.ts';
import { LUG_COUNTS } from '../data/drums.ts';
import { colors, deviationColor } from '../theme.ts';

type Props = {
  values: (number | null)[];
  current: number;
  onSelectLug: (index: number) => void;
  onChangeCount: (count: number) => void;
  onReset: () => void;
};

const TOLERANCE_CENTS = 20;
const LUG_SIZE = 58;

export function LugScreen({ values, current, onSelectLug, onChangeCount, onReset }: Props) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 32, 340);
  const radius = size / 2 - LUG_SIZE / 2 - 4;

  const filled = values.filter((v): v is number => v !== null);
  const avg = filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : null;
  const spread = filled.length > 1 ? Math.max(...filled) - Math.min(...filled) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.counts}>
        {LUG_COUNTS.map((c) => (
          <Pressable
            key={c}
            onPress={() => onChangeCount(c)}
            style={[styles.countChip, values.length === c && styles.countChipActive]}
          >
            <Text style={[styles.countText, values.length === c && styles.countTextActive]}>{c}개</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.drum, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={styles.center}>
          <Text style={styles.avgLabel}>평균</Text>
          <Text style={styles.avg}>{avg ? `${avg.toFixed(1)} Hz` : '—'}</Text>
          <Text style={styles.spread}>{spread !== null ? `편차 ${spread.toFixed(1)} Hz` : ' '}</Text>
        </View>
        {values.map((v, i) => {
          const angle = -Math.PI / 2 + (i * 2 * Math.PI) / values.length;
          const left = size / 2 + radius * Math.cos(angle) - LUG_SIZE / 2;
          const top = size / 2 + radius * Math.sin(angle) - LUG_SIZE / 2;
          const cents = v !== null && avg ? centsBetween(v, avg) : 0;
          const color = v !== null && filled.length > 1 ? deviationColor(cents, TOLERANCE_CENTS) : colors.text;
          const active = i === current;
          return (
            <Pressable
              key={i}
              onPress={() => onSelectLug(i)}
              style={[
                styles.lug,
                { left, top, borderColor: active ? colors.accent : colors.border },
                active && styles.lugActive,
              ]}
            >
              <Text style={styles.lugIndex}>{i + 1}</Text>
              <Text style={[styles.lugHz, { color }]}>{v !== null ? v.toFixed(0) : '·'}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <Legend color={colors.low} label="낮음 · 조이기" />
        <Legend color={colors.good} label="고름" />
        <Legend color={colors.high} label="높음 · 풀기" />
      </View>

      <View style={styles.card}>
        <Text style={styles.howTitle}>
          {current + 1}번 러그 앞을 치세요
        </Text>
        <Text style={styles.how}>
          반대쪽 헤드를 손으로 눌러 울림을 막고, 러그에서 2~3cm 안쪽을 스틱으로 가볍게 칩니다. 측정되면 다음 러그로
          넘어가요. 러그를 눌러 다시 잴 수도 있어요.
        </Text>
        <Pressable onPress={onReset} style={({ pressed }) => [styles.reset, pressed && { opacity: 0.6 }]}>
          <Text style={styles.resetText}>처음부터 다시</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, alignItems: 'center' },
  counts: { flexDirection: 'row', gap: 8 },
  countChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  countText: { color: colors.text, fontSize: 14 },
  countTextActive: { color: '#1a1200', fontWeight: '700' },
  drum: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border },
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  avgLabel: { color: colors.textDim, fontSize: 13 },
  avg: { color: colors.text, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  spread: { color: colors.textDim, fontSize: 13 },
  lug: {
    position: 'absolute',
    width: LUG_SIZE,
    height: LUG_SIZE,
    borderRadius: LUG_SIZE / 2,
    borderWidth: 2,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lugActive: { backgroundColor: '#3a2f1a' },
  lugIndex: { color: colors.textDim, fontSize: 10 },
  lugHz: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textDim, fontSize: 12 },
  card: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8 },
  howTitle: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  how: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  reset: { marginTop: 4, alignSelf: 'flex-start' },
  resetText: { color: colors.text, fontSize: 14, textDecorationLine: 'underline' },
});
