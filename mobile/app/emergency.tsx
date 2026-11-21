import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AedStatusBadges } from '@/components/aed/AedStatusBadge';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AED } from '@/constants/aed-theme';
import { call112, openAppSettings, openWalkingDirections } from '@/lib/aed/actions';
import { formatDistance, formatWalk } from '@/lib/aed/geo';
import type { AedItem } from '@/lib/aed/types';
import { APPROXIMATE_ACCURACY_M, useNearestAed } from '@/lib/aed/useNearestAed';

/**
 * Simplified mobile GdzieAED view: 112, map of the nearest AEDs, walking directions in Google Maps.
 * Deep links: mobywatelaed://emergency (Siri "emergency"), mobywatelaed://emergency?go=1 (Siri "take me to the nearest AED").
 */
export default function EmergencyScreen() {
  const { go } = useLocalSearchParams<{ go?: string }>();
  const { status, coords, accuracyM, items, source, offlineDate, error, refresh } = useNearestAed(10);
  const approximate = accuracyM != null && accuracyM > APPROXIMATE_ACCURACY_M;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCpr, setShowCpr] = useState(false);
  const map = useRef<MapView>(null);
  const autoNavigated = useRef(false);

  const selected = useMemo(() => items.find((a) => a.id === selectedId) ?? items[0] ?? null, [items, selectedId]);
  const others = items.filter((a) => a.id !== selected?.id).slice(0, 4);

  // keep the user and the selected AED in view
  useEffect(() => {
    if (!coords || !selected) return;
    map.current?.fitToCoordinates([coords, { latitude: selected.latitude, longitude: selected.longitude }], {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }, [coords, selected]);

  // Siri "take me to the nearest AED": start navigation once, as soon as we know the nearest one
  useEffect(() => {
    if (go === '1' && !autoNavigated.current && items[0]) {
      autoNavigated.current = true;
      openWalkingDirections(items[0].latitude, items[0].longitude);
    }
  }, [go, items]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <IconSymbol name="bolt.heart.fill" size={26} color="#fff" />
          <Text style={styles.headerTitle} accessibilityRole="header">
            Nagły wypadek
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Zamknij" onPress={close} style={styles.close} hitSlop={8}>
            <IconSymbol name="xmark" size={22} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zadzwoń pod numer alarmowy 112"
          onPress={call112}
          style={({ pressed }) => [styles.call, pressed && { backgroundColor: AED.redDark }]}>
          <IconSymbol name="phone.fill" size={24} color="#fff" />
          <Text style={styles.callText}>Zadzwoń 112</Text>
        </Pressable>

        {approximate && (
          <View style={styles.warning} accessibilityRole="alert">
            <IconSymbol name="exclamationmark.triangle.fill" size={22} color={AED.red} />
            <View style={{ flex: 1, gap: 8, alignItems: 'flex-start' }}>
              <Text style={styles.warningText}>
                Lokalizacja jest przybliżona (±{formatDistance(accuracyM)}). Włącz „Dokładną lokalizację”, aby wskazać
                najbliższy AED.
              </Text>
              <SmallButton label="Otwórz ustawienia" onPress={openAppSettings} />
            </View>
          </View>
        )}

        <View style={styles.mapBox}>
          {coords ? (
            <MapView
              ref={map}
              style={StyleSheet.absoluteFill}
              initialRegion={{ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
              mapType="hybrid"
              showsUserLocation
              showsMyLocationButton={false}
              showsBuildings
              accessibilityLabel="Mapa najbliższych defibrylatorów">
              {items.map((a) => (
                <Marker
                  key={a.id}
                  coordinate={{ latitude: a.latitude, longitude: a.longitude }}
                  title={a.title}
                  description={formatDistance(a.distanceM)}
                  pinColor={a.id === selected?.id ? AED.red : AED.navy}
                  onPress={() => setSelectedId(a.id)}
                />
              ))}
            </MapView>
          ) : (
            <MapPlaceholder status={status} error={error} onRetry={refresh} />
          )}
        </View>

        {accuracyM != null && !approximate && (
          <Text style={styles.accuracy}>Dokładność Twojej pozycji: ±{formatDistance(accuracyM)}</Text>
        )}

        {selected && (
          <AedCard aed={selected} nearest={selected.id === items[0]?.id} />
        )}

        {status === 'loading' && !selected && <ActivityIndicator color={AED.red} style={{ marginVertical: 16 }} />}

        {others.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kolejne najbliższe</Text>
            {others.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={`${a.title}, ${formatDistance(a.distanceM)}. Pokaż na mapie`}
                onPress={() => setSelectedId(a.id)}
                style={({ pressed }) => [styles.otherRow, pressed && { backgroundColor: AED.background }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.otherTitle} numberOfLines={1}>
                    {a.title}
                  </Text>
                  {!!a.address && (
                    <Text style={styles.muted} numberOfLines={1}>
                      {a.address}
                    </Text>
                  )}
                </View>
                <Text style={styles.otherDistance}>{formatDistance(a.distanceM)}</Text>
                <IconSymbol name="chevron.right" size={18} color={AED.muted} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showCpr }}
            onPress={() => setShowCpr((v) => !v)}
            style={styles.cprToggle}>
            <Text style={styles.sectionTitle}>Co robić do czasu przyniesienia AED?</Text>
            <IconSymbol name={showCpr ? 'chevron.up' : 'chevron.down'} size={20} color={AED.navy} />
          </Pressable>
          {showCpr && (
            <View style={{ gap: 6 }}>
              <Text style={styles.cprStep}>1. Zadzwoń pod 112 i włącz tryb głośnomówiący.</Text>
              <Text style={styles.cprStep}>2. Poproś kogoś o przyniesienie najbliższego AED.</Text>
              <Text style={styles.cprStep}>
                3. Uciskaj mocno i szybko środek klatki piersiowej: 100–120 razy na minutę, na głębokość 5–6 cm.
              </Text>
              <Text style={styles.cprStep}>4. Włącz AED i wykonuj jego polecenia głosowe.</Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          {source === 'offline'
            ? `Tryb offline: dane z ${formatDate(offlineDate)}. `
            : 'Dane na żywo z GdzieAED. '}
          Źródła: zbiory dysponentów z dane.gov.pl oraz © współtwórcy OpenStreetMap (ODbL).
        </Text>
      </ScrollView>
    </View>
  );
}

function AedCard({ aed, nearest }: { aed: AedItem; nearest: boolean }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{nearest ? 'Najbliższy defibrylator' : 'Wybrany defibrylator'}</Text>
      <Text style={styles.cardTitle}>{aed.title}</Text>
      {!!aed.address && <Text style={styles.muted}>{aed.address}</Text>}
      {!!aed.placement && <Text style={styles.placement}>{aed.placement}</Text>}
      <View style={styles.distanceRow}>
        <IconSymbol name="figure.walk" size={18} color={AED.ink} />
        <Text style={styles.distance}>
          {formatDistance(aed.distanceM)} · {formatWalk(aed.walkMin)}
        </Text>
      </View>
      <AedStatusBadges aed={aed} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Prowadź do defibrylatora: ${aed.title}. Otwiera Google Maps`}
        onPress={() => openWalkingDirections(aed.latitude, aed.longitude)}
        style={({ pressed }) => [styles.navigate, pressed && { opacity: 0.85 }]}>
        <IconSymbol name="location.fill" size={20} color="#fff" />
        <Text style={styles.navigateText}>Prowadź do AED (Google Maps)</Text>
      </Pressable>
    </View>
  );
}

function MapPlaceholder({
  status,
  error,
  onRetry,
}: {
  status: string;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === 'denied') {
    return (
      <View style={styles.placeholder}>
        <IconSymbol name="exclamationmark.triangle.fill" size={28} color={AED.red} />
        <Text style={styles.placeholderText}>
          Brak dostępu do lokalizacji. Bez niej nie wskażemy najbliższego AED. Numer 112 działa zawsze.
        </Text>
        <SmallButton label="Otwórz ustawienia" onPress={openAppSettings} />
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>{error}</Text>
        <SmallButton label="Spróbuj ponownie" onPress={onRetry} />
      </View>
    );
  }
  return (
    <View style={styles.placeholder}>
      <ActivityIndicator color={AED.red} />
      <Text style={styles.placeholderText}>Ustalam Twoją lokalizację…</Text>
    </View>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.smallButton}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '–';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pl-PL');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AED.background },
  header: { backgroundColor: AED.red },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },
  close: { width: AED.touch, height: AED.touch, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },

  call: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: AED.red,
    borderRadius: AED.radius,
    minHeight: 56,
  },
  callText: { color: '#fff', fontSize: 20, fontWeight: '800' },

  mapBox: {
    height: 280,
    borderRadius: AED.radius,
    overflow: 'hidden',
    backgroundColor: '#E4E7EC',
    borderWidth: 1,
    borderColor: AED.line,
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  placeholderText: { color: AED.ink, fontSize: 15, textAlign: 'center' },
  warning: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: AED.radius,
    backgroundColor: AED.redTint,
    borderWidth: 1,
    borderColor: AED.red,
  },
  warningText: { color: AED.ink, fontSize: 14, lineHeight: 19 },
  accuracy: { color: AED.muted, fontSize: 12, marginTop: -6 },
  smallButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: AED.radius,
    borderWidth: 1.5,
    borderColor: AED.navy,
  },
  smallButtonText: { color: AED.navy, fontWeight: '700', fontSize: 15 },

  card: {
    backgroundColor: AED.surface,
    borderRadius: AED.radius,
    borderWidth: 1,
    borderColor: AED.line,
    borderLeftWidth: 4,
    borderLeftColor: AED.red,
    padding: 16,
    gap: 6,
  },
  eyebrow: { color: AED.red, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  cardTitle: { color: AED.ink, fontSize: 19, fontWeight: '800' },
  placement: { color: AED.ink, fontSize: 15 },
  muted: { color: AED.muted, fontSize: 14 },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  distance: { color: AED.ink, fontSize: 16, fontWeight: '700' },
  navigate: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: AED.radius,
    backgroundColor: AED.navy,
  },
  navigateText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  section: {
    backgroundColor: AED.surface,
    borderRadius: AED.radius,
    borderWidth: 1,
    borderColor: AED.line,
    padding: 16,
    gap: 4,
  },
  sectionTitle: { color: AED.ink, fontSize: 16, fontWeight: '800', flex: 1 },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: AED.touch,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AED.line,
  },
  otherTitle: { color: AED.ink, fontSize: 15, fontWeight: '600' },
  otherDistance: { color: AED.ink, fontSize: 15, fontWeight: '700' },
  cprToggle: { flexDirection: 'row', alignItems: 'center', minHeight: AED.touch - 8 },
  cprStep: { color: AED.ink, fontSize: 15, lineHeight: 21 },
  footer: { color: AED.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8 },
});
