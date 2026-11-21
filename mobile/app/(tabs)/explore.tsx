import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { AED } from '@/constants/aed-theme';

type Service = {
  title: string;
  subtitle: string;
  icon: IconSymbolName;
  color: string;
  onPress?: () => void;
};

const SERVICES: Service[] = [
  {
    title: 'Defibrylatory AED w pobliżu',
    subtitle: 'Najbliższe AED, prowadzenie i 112',
    icon: 'bolt.heart.fill',
    color: AED.red,
    onPress: () => router.push('/emergency'),
  },
  {
    title: 'Jak użyć AED',
    subtitle: 'Instrukcja w 5 krokach z rysunkami',
    icon: 'book.fill',
    color: AED.red,
    onPress: () => router.push('/aed-guide'),
  },
  {
    title: 'Metronom RKO',
    subtitle: 'Rytm uciśnięć klatki piersiowej, 110/min',
    icon: 'heart.fill',
    color: AED.red,
    onPress: () => router.push('/cpr'),
  },
  {
    title: 'Tryb ratownika',
    subtitle: 'Alarmy „potrzebny AED” w promieniu 1 km',
    icon: 'figure.walk',
    color: AED.red,
    onPress: () => router.push('/responder'),
  },
  {
    title: 'AED pod Przyciskiem czynności',
    subtitle: 'Jedno naciśnięcie otwiera najbliższe AED',
    icon: 'bolt.heart.fill',
    color: AED.navy,
    onPress: () =>
      Alert.alert(
        'Przycisk czynności (iPhone 15 Pro i nowsze)',
        '1. Otwórz Ustawienia → Przycisk czynności.\n' +
          '2. Przesuń do opcji „Skrót” i stuknij „Wybierz skrót”.\n' +
          '3. W sekcji mObywatelAED wybierz „Nearest AED” (mapa AED) albo „CPR metronome”.\n\n' +
          'Przytrzymanie przycisku otworzy od razu wybraną funkcję, także z zablokowanego telefonu.',
        [{ text: 'Rozumiem' }],
      ),
  },
  { title: 'Zastrzeż PESEL', subtitle: 'Wkrótce', icon: 'building.columns.fill', color: '#0052A5' },
  { title: 'Pojazdy', subtitle: 'Wkrótce', icon: 'car.fill', color: '#0052A5' },
];

export default function ServicesScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Usługi
        </Text>
        <View style={styles.list}>
          {SERVICES.map((s, i) => (
            <Pressable
              key={s.title}
              accessibilityRole="button"
              accessibilityState={{ disabled: !s.onPress }}
              accessibilityLabel={`${s.title}. ${s.subtitle}`}
              disabled={!s.onPress}
              onPress={s.onPress}
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: '#EEF1F8' }]}>
              <View style={[styles.icon, { backgroundColor: `${s.color}14` }]}>
                <IconSymbol name={s.icon} size={24} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, !s.onPress && { color: '#667085' }]}>{s.title}</Text>
                <Text style={styles.rowSubtitle}>{s.subtitle}</Text>
              </View>
              {s.onPress && <IconSymbol name="chevron.right" size={18} color="#667085" />}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgb(245, 246, 252)' },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 40, fontWeight: 'bold', color: '#101828' },
  list: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 64 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D0D5DD' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#101828' },
  rowSubtitle: { fontSize: 13, color: '#667085', marginTop: 2 },
});
