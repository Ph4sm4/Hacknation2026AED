import { StyleSheet, Text, View } from 'react-native';

import { AED } from '@/constants/aed-theme';
import type { AedItem } from '@/lib/aed/types';

type Badge = { label: string; fg: string; bg: string };

export function statusBadges(aed: AedItem): Badge[] {
  const out: Badge[] = [];
  if (aed.is24h) out.push({ label: '24/7', fg: AED.green, bg: AED.greenTint });
  else if (aed.openNow === true) out.push({ label: 'Dostępny teraz', fg: AED.green, bg: AED.greenTint });
  else if (aed.openNow === false) out.push({ label: 'Teraz niedostępny', fg: '#fff', bg: AED.ink });
  else out.push({ label: aed.hours ? `Godziny: ${aed.hours}` : 'Godziny nieznane', fg: AED.muted, bg: AED.background });

  if (aed.access === 'prywatny') out.push({ label: 'Prywatny', fg: AED.muted, bg: AED.background });
  else if (aed.access === 'ograniczony') out.push({ label: 'Dostęp ograniczony', fg: AED.navy, bg: AED.navyTint });
  else if (aed.access === 'publiczny') out.push({ label: 'Publiczny', fg: AED.navy, bg: AED.navyTint });
  return out;
}

export function AedStatusBadges({ aed }: { aed: AedItem }) {
  return (
    <View style={styles.row}>
      {statusBadges(aed).map((b) => (
        <View key={b.label} style={[styles.badge, { backgroundColor: b.bg }]}>
          <Text style={[styles.text, { color: b.fg }]} numberOfLines={1}>
            {b.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 2, paddingHorizontal: 7, paddingVertical: 4, maxWidth: '100%' },
  text: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
});
