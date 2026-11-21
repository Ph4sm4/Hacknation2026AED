import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { MorphPressable } from '@/components/aed/MorphPressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AED, TYPE } from '@/constants/aed-theme';

/** Big red entry point to the emergency AED screen (home screen) – GdzieAED Swiss style. */
export function EmergencyEntryButton() {
  return (
    <MorphPressable
      radius={18}
      pressedRadius={42}
      accessibilityRole="button"
      accessibilityLabel="Nagły wypadek. Znajdź najbliższy defibrylator AED"
      accessibilityHint="Otwiera mapę najbliższych defibrylatorów i przycisk połączenia z numerem 112"
      onPress={() => router.push('/emergency')}
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: AED.ink }]}>
      <View style={styles.icon}>
        <IconSymbol name="bolt.heart.fill" size={28} color={AED.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>GdzieAED</Text>
        <Text style={styles.title}>Nagły wypadek?</Text>
        <Text style={styles.subtitle}>Najbliższy defibrylator AED i 112</Text>
      </View>
      <Text style={styles.arrow} accessible={false}>
        →
      </Text>
    </MorphPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: AED.red,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 84,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...TYPE.label, color: '#fff', opacity: 0.8 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.7, marginTop: 2 },
  subtitle: { color: '#fff', fontSize: 14, fontWeight: '500', marginTop: 1 },
  arrow: { color: '#fff', fontSize: 28, fontWeight: '300' },
});
