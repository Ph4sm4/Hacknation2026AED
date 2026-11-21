import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { AED } from '@/constants/aed-theme';

/** Big red entry point to the emergency AED screen (home screen). */
export function EmergencyEntryButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nagły wypadek. Znajdź najbliższy defibrylator AED"
      accessibilityHint="Otwiera mapę najbliższych defibrylatorów i przycisk połączenia z numerem 112"
      onPress={() => router.push('/emergency')}
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: AED.redDark }]}>
      <View style={styles.icon}>
        <IconSymbol name="bolt.heart.fill" size={30} color={AED.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Nagły wypadek?</Text>
        <Text style={styles.subtitle}>Znajdź najbliższy defibrylator AED</Text>
      </View>
      <IconSymbol name="chevron.right" size={22} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: AED.red,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 72,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subtitle: { color: '#fff', fontSize: 14, fontWeight: '500', marginTop: 2 },
});
