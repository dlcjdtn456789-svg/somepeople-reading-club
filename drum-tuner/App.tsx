import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { FONT_FILES, Text } from './src/components/Text.tsx';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useDrumMic, type DrumHit } from './src/audio/useDrumMic.ts';
import { analysisRange, defaultTarget, DRUMS, LUG_RANGE } from './src/data/drums.ts';
import { LugScreen } from './src/screens/LugScreen.tsx';
import { TunerScreen } from './src/screens/TunerScreen.tsx';
import { colors } from './src/theme.ts';

type Tab = 'tuner' | 'lugs';

export default function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // Wait for Pretendard; if loading fails, fall back to the system font.
  if (!fontsLoaded && !fontError) return <View style={styles.root} />;

  return (
    <SafeAreaProvider>
      <DrumTuner />
    </SafeAreaProvider>
  );
}

function DrumTuner() {
  const [tab, setTab] = useState<Tab>('tuner');
  const [drumId, setDrumId] = useState(DRUMS[2].id);
  const drum = DRUMS.find((d) => d.id === drumId) ?? DRUMS[0];
  const [targets, setTargets] = useState<Record<string, number>>({});
  const target = targets[drum.id] ?? defaultTarget(drum);

  const [hits, setHits] = useState<DrumHit[]>([]);
  const [lugs, setLugs] = useState<(number | null)[]>(Array(8).fill(null));
  const [currentLug, setCurrentLug] = useState(0);

  const onHit = useCallback(
    (hit: DrumHit) => {
      if (tab === 'tuner') {
        setHits((h) => [hit, ...h].slice(0, 20));
        return;
      }
      setLugs((prev) => {
        const next = [...prev];
        next[currentLug] = hit.frequency;
        return next;
      });
      setCurrentLug((i) => (i + 1) % lugs.length);
    },
    [tab, currentLug, lugs.length],
  );

  const range = tab === 'tuner' ? analysisRange(drum) : LUG_RANGE;
  const mic = useDrumMic({
    mode: tab === 'tuner' ? 'fundamental' : 'dominant',
    minHz: range.minHz,
    maxHz: range.maxHz,
    onHit,
  });
  const listening = mic.status === 'listening';

  const selectDrum = (id: string) => {
    setDrumId(id);
    setHits([]);
  };
  const resetLugs = (count = lugs.length) => {
    setLugs(Array(count).fill(null));
    setCurrentLug(0);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>드럼 튜너</Text>
        <View style={styles.tabs}>
          <TabButton label="튜너" active={tab === 'tuner'} onPress={() => setTab('tuner')} />
          <TabButton label="러그 튜닝" active={tab === 'lugs'} onPress={() => setTab('lugs')} />
        </View>
      </View>

      {tab === 'tuner' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.drumsScroll}
          contentContainerStyle={styles.drums}
        >
          {DRUMS.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => selectDrum(d.id)}
              style={[styles.drumChip, d.id === drum.id && styles.drumChipActive]}
            >
              <Text style={[styles.drumChipText, d.id === drum.id && styles.drumChipTextActive]}>{d.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'tuner' ? (
          <TunerScreen
            drum={drum}
            target={target}
            onTargetChange={(hz) => setTargets((t) => ({ ...t, [drum.id]: hz }))}
            hits={hits}
          />
        ) : (
          <LugScreen
            values={lugs}
            current={currentLug}
            onSelectLug={setCurrentLug}
            onChangeCount={(c) => resetLugs(c)}
            onReset={() => resetLugs()}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        {mic.status === 'denied' && (
          <Text style={styles.error}>마이크 권한이 필요해요. 설정 앱에서 마이크 접근을 허용해 주세요.</Text>
        )}
        {mic.status === 'error' && <Text style={styles.error}>마이크를 시작하지 못했어요: {mic.error}</Text>}
        <View style={styles.meter}>
          <View style={[styles.meterFill, { width: `${Math.min(100, Math.sqrt(mic.level) * 220)}%` }]} />
        </View>
        <Pressable
          onPress={listening ? mic.stop : mic.start}
          style={({ pressed }) => [styles.micBtn, listening && styles.micBtnOn, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.micBtnText, listening && styles.micBtnTextOn]}>
            {listening ? '듣는 중 · 탭하여 멈추기' : mic.status === 'starting' ? '준비 중…' : '마이크 켜기'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surfaceHigh },
  tabText: { color: colors.textDim, fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  drumsScroll: { flexGrow: 0, flexShrink: 0 },
  drums: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  drumChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  drumChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  drumChipText: { color: colors.text, fontSize: 14 },
  drumChipTextActive: { color: '#1a1200', fontWeight: '700' },
  content: { padding: 16, paddingBottom: 32 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28, gap: 10, borderTopWidth: 1, borderTopColor: colors.border },
  error: { color: colors.high, fontSize: 13, textAlign: 'center' },
  meter: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: colors.accent },
  micBtn: { backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  micBtnOn: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.accent },
  micBtnText: { color: '#1a1200', fontSize: 17, fontWeight: '700' },
  micBtnTextOn: { color: colors.accent },
});
