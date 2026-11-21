import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { MorphPressable } from '@/components/aed/MorphPressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AED } from '@/constants/aed-theme';
import { GUIDE_STEPS } from '@/lib/aed/guide';

/** Entry card to the "How to use an AED" screen: three step thumbnails + title (same as the web map panel). */
export function AedGuideEntry() {
  return (
    <MorphPressable
      radius={AED.radius}
      pressedRadius={40}
      accessibilityRole="button"
      accessibilityLabel="Jak użyć AED? Instrukcja w 5 krokach z rysunkami"
      onPress={() => router.push('/aed-guide')}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.thumbs} accessible={false}>
        {GUIDE_STEPS.slice(0, 3).map((s, i) => (
          <View key={s.title} style={[styles.thumb, i > 0 && { marginLeft: -12 }]}>
            <SvgXml xml={s.svg} width={34} height={34} />
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Jak użyć AED?</Text>
        <Text style={styles.subtitle}>5 kroków z rysunkami</Text>
      </View>
      <IconSymbol name="chevron.right" size={20} color={AED.red} />
    </MorphPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    padding: 10,
    paddingRight: 14,
    backgroundColor: AED.redTint,
  },
  thumbs: { flexDirection: 'row' },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AED.redTint,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: AED.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: AED.muted, fontSize: 14, marginTop: 1 },
});
