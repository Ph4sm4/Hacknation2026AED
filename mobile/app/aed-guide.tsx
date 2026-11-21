import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { MorphPressable } from '@/components/aed/MorphPressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AED, TYPE } from '@/constants/aed-theme';
import { call112 } from '@/lib/aed/actions';
import { GUIDE_INTRO, GUIDE_NOTE, GUIDE_STEPS } from '@/lib/aed/guide';

/** How to use an AED – 5 steps with pictograms (same content as the web page /jak-uzyc-aed). */
export default function AedGuideScreen() {
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>Instrukcja</Text>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Jak użyć AED
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Zamknij" onPress={close} style={styles.close} hitSlop={8}>
            <IconSymbol name="xmark" size={22} color={AED.ink} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <IconSymbol name="phone.fill" size={16} color={AED.red} />
          <Text style={styles.introText}>{GUIDE_INTRO}</Text>
        </View>

        {GUIDE_STEPS.map((s, i) => (
          <View key={s.title} style={styles.step} accessible accessibilityLabel={`Krok ${i + 1}. ${s.title}. ${s.text}`}>
            <View style={styles.picture}>
              <SvgXml xml={s.svg} width={84} height={84} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepLabel}>Krok {i + 1}</Text>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepText}>{s.text}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.note}>{GUIDE_NOTE}</Text>

        <View style={styles.actions}>
          <MorphPressable
            accessibilityRole="button"
            accessibilityLabel="Zadzwoń pod numer alarmowy 112"
            onPress={call112}
            style={({ pressed }) => [styles.call, pressed && { backgroundColor: AED.redDark }]}>
            <IconSymbol name="phone.fill" size={20} color="#fff" />
            <Text style={styles.callText}>112</Text>
          </MorphPressable>
          <MorphPressable
            accessibilityRole="button"
            accessibilityLabel="Metronom RKO"
            onPress={() => router.push('/cpr')}
            style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.85 }]}>
            <IconSymbol name="heart.fill" size={18} color={AED.ink} />
            <Text style={styles.secondaryText}>Metronom RKO</Text>
          </MorphPressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AED.surface },
  header: { backgroundColor: AED.surface },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  headerLabel: { ...TYPE.label, color: AED.red },
  headerTitle: { ...TYPE.title, color: AED.ink, marginTop: 4 },
  close: { width: AED.touch, height: AED.touch, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 8, paddingBottom: 48 },

  intro: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: AED.radius, backgroundColor: AED.redTint, marginBottom: 4 },
  introText: { flex: 1, color: AED.ink, fontSize: 15, lineHeight: 21, fontWeight: '500' },

  step: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: AED.radius, backgroundColor: AED.background },
  picture: { width: 96, height: 96, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepLabel: { ...TYPE.label, fontSize: 10, color: AED.red },
  stepTitle: { color: AED.ink, fontSize: 17, fontWeight: '600', letterSpacing: -0.3, marginTop: 2 },
  stepText: { color: AED.muted, fontSize: 14, lineHeight: 19, marginTop: 3 },

  note: { color: AED.muted, fontSize: 14, lineHeight: 19, marginTop: 6, paddingHorizontal: 4 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  call: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: AED.red,
  },
  callText: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: -0.6 },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: AED.ink,
    backgroundColor: '#fff',
  },
  secondaryText: { color: AED.ink, fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
});
