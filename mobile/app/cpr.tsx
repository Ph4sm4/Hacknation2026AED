import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MorphPressable } from '@/components/aed/MorphPressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AED, TYPE } from '@/constants/aed-theme';
import { call112 } from '@/lib/aed/actions';

/** ERC 2021: 100–120 compressions per minute; 110 sits in the middle of the range. */
const BPM = 110;
const INTERVAL_MS = 60_000 / BPM;
const CYCLE = 30;
const KEEP_AWAKE_TAG = 'cpr-metronome';

/**
 * CPR metronome: tick + haptic + pulsing circle at 110/min, 30-compression counter, elapsed time.
 * Starts immediately (opened in an emergency, also from Siri / the Action Button: mobywatelaed://cpr).
 */
export default function CprScreen() {
  const [running, setRunning] = useState(true);
  const [sound, setSound] = useState(true);
  const [count, setCount] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [pulse] = useState(() => new Animated.Value(1));
  const player = useAudioPlayer(require('@/assets/sounds/cpr-tick.wav'));
  const countRef = useRef(0);
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  // drift-free beat loop: each timeout aims at the absolute time of the next beat
  useEffect(() => {
    if (!running) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    let next = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const beat = () => {
      const n = (countRef.current % CYCLE) + 1;
      countRef.current = n;
      setCount(n);
      if (n === CYCLE) setCycles((x) => x + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
      if (soundRef.current) {
        player.seekTo(0);
        player.play();
      }
      pulse.setValue(1.12);
      Animated.timing(pulse, { toValue: 1, duration: INTERVAL_MS * 0.8, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      next += INTERVAL_MS;
      timer = setTimeout(beat, Math.max(0, next - Date.now()));
    };
    beat();
    const clock = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(clock);
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [running, player, pulse]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>GdzieAED · RKO</Text>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Uciskaj w rytmie
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Zamknij" onPress={close} style={styles.close} hitSlop={8}>
            <IconSymbol name="xmark" size={22} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={styles.body}>
        <Text style={styles.instruction}>Uciskaj mocno i szybko środek klatki piersiowej, na głębokość 5–6 cm, w rytm sygnału.</Text>

        <Animated.View
          style={[styles.circle, { transform: [{ scale: pulse }] }, !running && { backgroundColor: AED.muted }]}
          accessible
          accessibilityLabel={running ? `Uciśnięcie ${count} z ${CYCLE}` : 'Metronom wstrzymany'}
          accessibilityLiveRegion="none">
          <Text style={styles.count}>{running ? count || '–' : '❚❚'}</Text>
          <Text style={styles.countSub}>{running ? `z ${CYCLE}` : 'pauza'}</Text>
        </Animated.View>

        <Text style={styles.cycleHint}>
          {count >= 27 && running
            ? 'Po 30 uciśnięciach: 2 wdechy, jeśli potrafisz. Jeśli nie – uciskaj dalej bez przerwy.'
            : `${BPM} uciśnięć na minutę · cykle: ${cycles} · czas: ${mmss}`}
        </Text>

        <View style={styles.row}>
          <MorphPressable
            accessibilityRole="button"
            accessibilityLabel={running ? 'Wstrzymaj metronom' : 'Wznów metronom'}
            onPress={() => setRunning((r) => !r)}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
            <Text style={styles.secondaryText}>{running ? 'Pauza' : 'Wznów'}</Text>
          </MorphPressable>
          <MorphPressable
            accessibilityRole="switch"
            accessibilityState={{ checked: sound }}
            accessibilityLabel="Dźwięk metronomu"
            onPress={() => setSound((s) => !s)}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
            <Text style={styles.secondaryText}>{sound ? 'Dźwięk: wł.' : 'Dźwięk: wył.'}</Text>
          </MorphPressable>
        </View>

        <MorphPressable
          accessibilityRole="button"
          accessibilityLabel="Zadzwoń pod numer alarmowy 112"
          onPress={call112}
          style={({ pressed }) => [styles.call, pressed && { backgroundColor: AED.redDark }]}>
          <IconSymbol name="phone.fill" size={22} color="#fff" />
          <Text style={styles.callText}>Zadzwoń 112</Text>
        </MorphPressable>
        <Text style={styles.footnote}>
          Gdy ktoś przyniesie AED: włącz go i wykonuj polecenia głosowe urządzenia. Rytm wg wytycznych ERC (100–120/min).
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { backgroundColor: AED.red },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 },
  headerLabel: { ...TYPE.label, color: '#fff', opacity: 0.8 },
  headerTitle: { ...TYPE.display, color: '#fff', marginTop: 4 },
  close: { width: AED.touch, height: AED.touch, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  body: { flex: 1, paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center', justifyContent: 'space-evenly' },
  instruction: { color: AED.ink, fontSize: 17, lineHeight: 23, textAlign: 'center', fontWeight: '600', letterSpacing: -0.2 },
  circle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: AED.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { color: '#fff', fontSize: 120, fontWeight: '700', letterSpacing: -6, fontVariant: ['tabular-nums'], lineHeight: 124 },
  countSub: { ...TYPE.label, color: '#fff', opacity: 0.85, marginTop: -4 },
  cycleHint: { color: AED.ink, fontSize: 15, textAlign: 'center', minHeight: 42, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  secondary: {
    flex: 1,
    minHeight: AED.touch + 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: AED.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  secondaryText: { color: AED.ink, fontSize: 16, fontWeight: '600' },
  call: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: AED.red,
  },
  callText: { color: '#fff', fontSize: 24, fontWeight: '700', letterSpacing: -0.8 },
  footnote: { color: AED.muted, fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
