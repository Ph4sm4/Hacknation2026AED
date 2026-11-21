import { StyleSheet, Text, View } from 'react-native';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { AED } from '@/constants/aed-theme';
import type { AedItem } from '@/lib/aed/types';

/** Metadata: small icon + plain text, no dots or boxes – same design as the web app. */
type Meta = { label: string; color: string; icon: IconSymbolName; strong: boolean };

export function statusBadges(aed: AedItem): Meta[] {
  const out: Meta[] = [];
  if (aed.is24h) out.push({ label: 'Całodobowo 24/7', color: AED.green, icon: 'clock', strong: true });
  else if (aed.openNow === true) out.push({ label: 'Dostępny teraz', color: AED.green, icon: 'clock', strong: true });
  else if (aed.openNow === false) out.push({ label: 'Teraz niedostępny', color: AED.ink, icon: 'clock', strong: true });
  else out.push({ label: aed.hours ? `Godziny: ${aed.hours}` : 'Godziny nieznane', color: AED.muted, icon: 'clock', strong: false });

  if (aed.access === 'prywatny') out.push({ label: 'Prywatny', color: AED.muted, icon: 'lock', strong: false });
  else if (aed.access === 'ograniczony') out.push({ label: 'Dostęp ograniczony', color: AED.muted, icon: 'key', strong: false });
  else if (aed.access === 'publiczny') out.push({ label: 'Publiczny', color: AED.muted, icon: 'person.2', strong: false });
  return out;
}

export function AedStatusBadges({ aed }: { aed: AedItem }) {
  return (
    <View style={styles.row}>
      {statusBadges(aed).map((m) => (
        <View key={m.label} style={styles.item}>
          <IconSymbol name={m.icon} size={14} color={m.color} />
          <Text style={[styles.text, { color: m.color }, m.strong && styles.strong]} numberOfLines={1}>
            {m.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  text: { fontSize: 14, fontWeight: '400' },
  strong: { fontWeight: '600' },
});
