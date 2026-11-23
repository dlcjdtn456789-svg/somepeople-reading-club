import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DrumHit } from '../audio/useDrumMic.ts';
import { centsBetween, frequencyToNote } from '../audio/pitch.ts';
import type { DrumPreset } from '../data/drums.ts';
import { colors, deviationColor } from '../theme.ts';

type Props = {
  drum: DrumPreset;
  target: number;
  onTargetChange: (hz: number) => void;
  hits: DrumHit[];
};

const TOLERANCE_CENTS = 10;
const GAUGE_CENTS = 100;

export function TunerScreen({ drum, target, onTargetChange, hits }: Props) {
  const last = hits[0];
  const note = last ? frequencyToNote(last.frequency) : null;
  const cents = last ? centsBetween(last.frequency, target) : 0;
  const color = last ? deviationColor(cents, TOLERANCE_CENTS) : colors.textDim;
  const pos = Math.max(-1, Math.min(1, cents / GAUGE_CENTS));

  return (
    <View style={styles.wrap}>
      <View style={styles.readout}>
        <Text style={[styles.hz, { color }]}>{last ? last.frequency.toFixed(1) : '—'}</Text>
        <Text style={styles.hzUnit}>Hz</Text>
      </View>
      <Text style={styles.note}>
        {note ? `${note.label}  ${note.cents >= 0 ? '+' : ''}${note.cents}¢` : '드럼을 한 번 쳐 보세요'}
      </Text>

      <View style={styles.gauge}>
        <View style={styles.gaugeCenter} />
        <View style={[styles.gaugeZone, { width: `${(TOLERANCE_CENTS / GAUGE_CENTS) * 100}%` }]} />
        {last && <View style={[styles.gaugeNeedle, { left: `${50 + pos * 50}%`, backgroundColor: color }]} />}
      </View>
      <View style={styles.gaugeLabels}>
        <Text style={styles.gaugeLabel}>낮음 · 조이기</Text>
        <Text style={styles.gaugeLabel}>높음 · 풀기</Text>
      </View>

      <Text style={[styles.advice, { color }]}>{last ? advice(last.frequency, target, cents) : ' '}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>목표 음정</Text>
        <View style={styles.targetRow}>
          <Stepper label="−5" onPress={() => onTargetChange(Math.max(20, target - 5))} />
          <Stepper label="−1" onPress={() => onTargetChange(Math.max(20, target - 1))} />
          <View style={styles.targetValue}>
            <Text style={styles.targetHz}>{target} Hz</Text>
            <Text style={styles.targetNote}>{frequencyToNote(target).label}</Text>
          </View>
          <Stepper label="+1" onPress={() => onTargetChange(target + 1)} />
          <Stepper label="+5" onPress={() => onTargetChange(target + 5)} />
        </View>
        <Pressable
          disabled={!last}
          onPress={() => last && onTargetChange(Math.round(last.frequency))}
          style={({ pressed }) => [styles.useBtn, !last && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.useBtnText}>방금 친 소리를 목표로</Text>
        </Pressable>
        <Text style={styles.hint}>
          {drum.name} 참고 범위: {drum.range[0]}–{drum.range[1]} Hz
        </Text>
      </View>

      {hits.length > 1 && (
        <View style={styles.history}>
          {hits.slice(0, 8).map((h) => (
            <Text
              key={h.at}
              style={[styles.historyItem, { color: deviationColor(centsBetween(h.frequency, target), TOLERANCE_CENTS) }]}
            >
              {h.frequency.toFixed(1)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function advice(freq: number, target: number, cents: number): string {
  const diff = Math.abs(freq - target).toFixed(1);
  if (Math.abs(cents) <= TOLERANCE_CENTS) return '정확해요 👍';
  return cents < 0 ? `목표보다 ${diff} Hz 낮아요 · 조이세요` : `목표보다 ${diff} Hz 높아요 · 푸세요`;
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.stepper, pressed && styles.pressed]}>
      <Text style={styles.stepperText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  readout: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: 8 },
  hz: { fontSize: 80, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hzUnit: { color: colors.textDim, fontSize: 22, marginLeft: 6, marginBottom: 16 },
  note: { color: colors.text, fontSize: 20, textAlign: 'center' },
  gauge: {
    height: 28,
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeZone: { position: 'absolute', height: '100%', backgroundColor: 'rgba(61,220,132,0.18)' },
  gaugeCenter: { position: 'absolute', width: 2, height: '100%', backgroundColor: colors.border },
  gaugeNeedle: { position: 'absolute', width: 6, marginLeft: -3, height: '100%', borderRadius: 3 },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  gaugeLabel: { color: colors.textDim, fontSize: 12 },
  advice: { fontSize: 18, fontWeight: '600', textAlign: 'center', minHeight: 26 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { color: colors.textDim, fontSize: 13 },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  targetValue: { flex: 1, alignItems: 'center' },
  targetHz: { color: colors.text, fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  targetNote: { color: colors.textDim, fontSize: 13 },
  stepper: {
    width: 48,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  useBtn: { backgroundColor: colors.surfaceHigh, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  useBtnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  history: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  historyItem: { fontSize: 14, fontVariant: ['tabular-nums'] },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
