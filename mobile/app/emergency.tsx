import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AedStatusBadges } from '@/components/aed/AedStatusBadge';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AED, TYPE } from '@/constants/aed-theme';
import { call112, openAppSettings, openWalkingDirections } from '@/lib/aed/actions';
import { formatDistance, formatWalk } from '@/lib/aed/geo';
import type { AedItem } from '@/lib/aed/types';
import { APPROXIMATE_ACCURACY_M, useNearestAed } from '@/lib/aed/useNearestAed';
import { useWalkingRoutes } from '@/lib/aed/useWalkingRoutes';
import type { WalkingRoute } from '@/modules/aed-routing';

/**
 * Simplified mobile GdzieAED view: 112, map of the nearest AEDs, walking directions in Google Maps.
 * Deep links: mobywatelaed://emergency (Siri "emergency"), mobywatelaed://emergency?go=1 (Siri "take me to the nearest AED").
 */
export default function EmergencyScreen() {
  const { go } = useLocalSearchParams<{ go?: string }>();
  const { status, coords, accuracyM, items: byDistance, source, offlineDate, error, refresh } = useNearestAed(10);
  // re-ranked by real walking time (MapKit) when available
  const { routes, ranked: items } = useWalkingRoutes(coords, byDistance);
  const approximate = accuracyM != null && accuracyM > APPROXIMATE_ACCURACY_M;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCpr, setShowCpr] = useState(false);
  const map = useRef<MapView>(null);
  const autoNavigated = useRef(false);

  const selected = useMemo(() => items.find((a) => a.id === selectedId) ?? items[0] ?? null, [items, selectedId]);
  const others = items.filter((a) => a.id !== selected?.id).slice(0, 4);

  const route = selected ? routes[selected.id] : undefined;

  // keep the user, the selected AED and its walking route in view
  useEffect(() => {
    if (!coords || !selected) return;
    map.current?.fitToCoordinates(
      [coords, { latitude: selected.latitude, longitude: selected.longitude }, ...(route?.coordinates ?? [])],
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true },
    );
  }, [coords, selected, route]);

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
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>GdzieAED</Text>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Nagły wypadek
            </Text>
          </View>
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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Metronom RKO. Rytm uciśnięć klatki piersiowej"
          onPress={() => router.push('/cpr')}
          style={({ pressed }) => [styles.cprButton, pressed && { opacity: 0.85 }]}>
          <IconSymbol name="heart.fill" size={20} color={AED.ink} />
          <Text style={styles.cprButtonText}>Metronom RKO</Text>
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
              {route && <Polyline coordinates={route.coordinates} strokeColor="#FFD400" strokeWidth={5} lineDashPattern={[1]} />}
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
          <AedCard aed={selected} nearest={selected.id === items[0]?.id} route={route} />
        )}

        {status === 'loading' && !selected && <ActivityIndicator color={AED.red} style={{ marginVertical: 16 }} />}

        {others.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>Kolejne najbliższe</SectionLabel>
            {others.map((a, i) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={`${a.title}, ${formatDistance(a.distanceM)}. Pokaż na mapie`}
                onPress={() => setSelectedId(a.id)}
                style={({ pressed }) => [styles.otherRow, pressed && { backgroundColor: AED.background }]}>
                <Text style={styles.otherIndex}>{String(i + 2).padStart(2, '0')}</Text>
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
                <Text style={styles.otherDistance}>{formatDistance(routes[a.id]?.distance ?? a.distanceM)}</Text>
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
            <Text style={styles.sectionTitle}>Co robić, zanim dotrze AED?</Text>
            <IconSymbol name={showCpr ? 'chevron.up' : 'chevron.down'} size={20} color={AED.ink} />
          </Pressable>
          {showCpr && (
            <View style={{ gap: 12, marginTop: 8 }}>
              {[
                'Zadzwoń pod 112 i włącz tryb głośnomówiący.',
                'Poproś kogoś o przyniesienie najbliższego AED.',
                'Uciskaj mocno i szybko środek klatki piersiowej: 100–120 razy na minutę, na głębokość 5–6 cm.',
                'Włącz AED i wykonuj jego polecenia głosowe.',
              ].map((t, i) => (
                <View key={t} style={styles.cprStepRow}>
                  <Text style={styles.cprStepNum}>{String(i + 1).padStart(2, '0')}</Text>
                  <Text style={styles.cprStep}>{t}</Text>
                </View>
              ))}
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

function AedCard({ aed, nearest, route }: { aed: AedItem; nearest: boolean; route?: WalkingRoute }) {
  return (
    <View style={styles.card}>
      <SectionLabel>
        {nearest ? (route ? 'Najbliższy defibrylator pieszo' : 'Najbliższy defibrylator') : 'Wybrany defibrylator'}
      </SectionLabel>
      <View style={styles.distanceRow}>
        <Text style={styles.distanceFigure}>{formatDistance(route ? route.distance : aed.distanceM)}</Text>
        <Text style={styles.distanceWalk}>{formatWalk(route ? route.duration / 60 : aed.walkMin)}</Text>
      </View>
      <Text style={styles.cardTitle}>{aed.title}</Text>
      {!!aed.address && <Text style={styles.muted}>{aed.address}</Text>}
      {!!aed.placement && <Text style={styles.placement}>{aed.placement}</Text>}
      <Text style={styles.routeNote}>
        {route ? 'Trasa piesza z Apple Maps, zaznaczona na mapie.' : 'Odległość w linii prostej.'}
      </Text>
      <AedStatusBadges aed={aed} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Prowadź do defibrylatora: ${aed.title}. Otwiera Google Maps`}
        onPress={() => openWalkingDirections(aed.latitude, aed.longitude)}
        style={({ pressed }) => [styles.navigate, pressed && { opacity: 0.85 }]}>
        <IconSymbol name="figure.walk" size={20} color="#fff" />
        <Text style={styles.navigateText}>Prowadź do AED</Text>
        <Text style={styles.navigateSub}>Google Maps</Text>
      </Pressable>
    </View>
  );
}

/** Swiss label: red square + small caps. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <View style={styles.labelRow}>
      <View style={styles.labelSquare} />
      <Text style={styles.label}>{children}</Text>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 },
  headerLabel: { ...TYPE.label, color: '#fff', opacity: 0.8 },
  headerTitle: { ...TYPE.display, color: '#fff', marginTop: 4 },
  close: { width: AED.touch, height: AED.touch, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 12, paddingBottom: 48 },

  call: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: AED.red,
    borderRadius: AED.radius,
    minHeight: 64,
  },
  callText: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  cprButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: AED.radius,
    borderWidth: 1.5,
    borderColor: AED.ink,
    backgroundColor: '#fff',
  },
  cprButtonText: { color: AED.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },

  warning: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: AED.radius,
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    borderLeftColor: AED.red,
  },
  warningText: { color: AED.ink, fontSize: 14, lineHeight: 19 },
  accuracy: { ...TYPE.label, color: AED.muted, letterSpacing: 1, marginTop: -4 },

  mapBox: {
    height: 300,
    marginTop: 8,
    borderRadius: AED.radius,
    overflow: 'hidden',
    backgroundColor: '#E4E5E7',
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  placeholderText: { color: AED.ink, fontSize: 15, textAlign: 'center' },
  smallButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: AED.radius,
    borderWidth: 1.5,
    borderColor: AED.ink,
  },
  smallButtonText: { color: AED.ink, fontWeight: '800', fontSize: 15 },

  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelSquare: { width: 8, height: 8, backgroundColor: AED.red },
  label: { ...TYPE.label, color: AED.red },

  card: {
    backgroundColor: AED.surface,
    borderTopWidth: 4,
    borderTopColor: AED.red,
    padding: 18,
    gap: 6,
    marginTop: 4,
  },
  distanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  distanceFigure: { ...TYPE.figure, color: AED.ink },
  distanceWalk: { color: AED.ink, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  routeNote: { color: AED.muted, fontSize: 12, marginBottom: 6 },
  cardTitle: { ...TYPE.title, color: AED.ink, marginTop: 10 },
  placement: { color: AED.ink, fontSize: 15, lineHeight: 21 },
  muted: { color: AED.muted, fontSize: 14 },
  navigate: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: AED.radius,
    backgroundColor: AED.ink,
  },
  navigateText: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  navigateSub: { ...TYPE.label, color: '#fff', opacity: 0.6, letterSpacing: 1 },

  section: {
    backgroundColor: AED.surface,
    borderTopWidth: 2,
    borderTopColor: AED.ink,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 2,
  },
  sectionTitle: { color: AED.ink, fontSize: 17, fontWeight: '900', letterSpacing: -0.4, flex: 1 },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AED.line,
  },
  otherIndex: { width: 32, color: AED.ink, opacity: 0.25, fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  otherTitle: { color: AED.ink, fontSize: 15, fontWeight: '700' },
  otherDistance: { color: AED.ink, fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  cprToggle: { flexDirection: 'row', alignItems: 'center', minHeight: AED.touch - 8 },
  cprStepRow: { flexDirection: 'row', gap: 12 },
  cprStepNum: { width: 28, color: AED.red, fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  cprStep: { flex: 1, color: AED.ink, fontSize: 15, lineHeight: 21 },
  footer: { color: AED.muted, fontSize: 12, lineHeight: 17, paddingTop: 8 },
});
