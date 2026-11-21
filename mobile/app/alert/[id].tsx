import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AedGuideEntry } from '@/components/aed/AedGuideEntry';
import { MorphPressable } from '@/components/aed/MorphPressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AED, TYPE } from '@/constants/aed-theme';
import { call112, openWalkingRoute } from '@/lib/aed/actions';
import { formatCoords, getAlert, respondToAlert, type AlertResponse, type CommunityAlert } from '@/lib/aed/alerts';
import { formatDistance, formatWalk } from '@/lib/aed/geo';
import type { Coords } from '@/lib/aed/types';

const POLL_MS = 5000;
const RESPONSES: { key: AlertResponse; label: string }[] = [
  { key: 'przynosze_aed', label: 'Przynoszę AED' },
  { key: 'ide_na_miejsce', label: 'Idę na miejsce' },
  { key: 'nie_moge', label: 'Nie mogę pomóc' },
];
const STATUS_TEXT: Record<string, string> = {
  odwolany: 'Alarm został odwołany przez osobę, która go wysłała.',
  zakonczony: 'Pomoc dotarła – alarm zakończony. Dziękujemy!',
  wygasl: 'Alarm wygasł (po 30 minutach).',
};

/** What a volunteer sees after tapping the alert notification. */
export default function AlertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const alertId = Number(id);
  const [me, setMe] = useState<Coords | null>(null);
  const [alert, setAlert] = useState<CommunityAlert | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState<AlertResponse | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const map = useRef<MapView>(null);
  const fitted = useRef(false);

  // own position: last known first, then a fresh fix
  useEffect(() => {
    (async () => {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 }).catch(() => null);
      if (last) setMe(last.coords);
      const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
      if (cur) setMe(cur.coords);
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      setAlert(await getAlert(alertId, me));
      setFetchedAt(Date.now());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [alertId, me]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    if (!alert || fitted.current) return;
    const pts = [{ latitude: alert.lat, longitude: alert.lon }];
    if (alert.aed) pts.push({ latitude: alert.aed.lat, longitude: alert.aed.lon });
    if (me) pts.push(me);
    if (pts.length < 2) return;
    fitted.current = true;
    setTimeout(() => map.current?.fitToCoordinates(pts, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true }), 300);
  }, [alert, me]);

  const answer = async (r: AlertResponse) => {
    setSending(r);
    try {
      await respondToAlert(alertId, r);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(null);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const bring = alert?.rola === 'przynies_aed' && !!alert.aed;
  const where = alert ? alert.adres || 'Adres nieustalony – użyj współrzędnych' : '';
  const minutesAgo = alert && fetchedAt ? Math.max(0, Math.round((fetchedAt - Date.parse(alert.created_at)) / 60000)) : 0;

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>Alarm GdzieAED · {minutesAgo === 0 ? 'przed chwilą' : `${minutesAgo} min temu`}</Text>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Potrzebny AED
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Zamknij" onPress={close} style={styles.close} hitSlop={8}>
            <IconSymbol name="xmark" size={22} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      {!alert ? (
        <View style={styles.loading}>
          {error ? <Text style={styles.body}>{error}</Text> : <ActivityIndicator color={AED.red} />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {alert.status !== 'aktywny' && (
            <View style={styles.statusBanner} accessibilityRole="alert">
              <Text style={styles.statusText}>{STATUS_TEXT[alert.status] ?? 'Alarm nieaktywny.'}</Text>
            </View>
          )}

          {/* the task for this person */}
          <View style={styles.task}>
            <Label>Twoje zadanie</Label>
            <Text style={styles.taskTitle}>{bring ? 'Przynieś AED' : 'Pomóż na miejscu'}</Text>
            <View style={styles.figureRow}>
              <Text style={styles.figure}>
                {formatDistance((bring ? alert.trasa_przez_aed_m : alert.odleglosc_m) ?? 0)}
              </Text>
              {alert.czas_min != null && <Text style={styles.figureSub}>{formatWalk(alert.czas_min)}</Text>}
            </View>
            {bring && alert.aed ? (
              <>
                <Text style={styles.step}>
                  <Text style={styles.stepNum}>01 </Text>
                  Weź AED ({formatDistance(alert.odleglosc_do_aed_m ?? 0)} od Ciebie): {alert.aed.nazwa}
                  {alert.aed.adres ? `, ${alert.aed.adres}` : ''}
                  {alert.aed.lokalizacja_opis && alert.aed.lokalizacja_opis !== alert.aed.nazwa ? ` – ${alert.aed.lokalizacja_opis}` : ''}
                </Text>
                <Text style={styles.step}>
                  <Text style={styles.stepNum}>02 </Text>
                  Zanieś do poszkodowanego ({formatDistance(alert.aed.odleglosc_od_poszkodowanego_m)} od AED).
                </Text>
              </>
            ) : (
              <Text style={styles.step}>
                Idź prosto do poszkodowanego i pomóż przy uciskaniu klatki piersiowej. AED przyniesie osoba, która jest bliżej
                defibrylatora.
              </Text>
            )}
            <MorphPressable
              accessibilityRole="button"
              accessibilityLabel={bring ? 'Prowadź do AED, a potem do poszkodowanego' : 'Prowadź do poszkodowanego'}
              onPress={() =>
                openWalkingRoute({ lat: alert.lat, lon: alert.lon }, bring && alert.aed ? { lat: alert.aed.lat, lon: alert.aed.lon } : undefined)
              }
              style={({ pressed }) => [styles.navigate, pressed && { opacity: 0.85 }]}>
              <IconSymbol name="figure.walk" size={20} color="#fff" />
              <Text style={styles.navigateText}>{bring ? 'Prowadź: AED → poszkodowany' : 'Prowadź do poszkodowanego'}</Text>
            </MorphPressable>
          </View>

          {/* where */}
          <View style={styles.section}>
            <Label>Miejsce zdarzenia</Label>
            <Text style={styles.place}>{where}</Text>
            <Text style={styles.coords} selectable>
              {formatCoords(alert.lat, alert.lon)}
              {alert.accuracy ? `  ±${Math.round(alert.accuracy)} m` : ''}
            </Text>
            {alert.aed && (
              <Text style={styles.muted}>
                Najbliższy AED przy poszkodowanym: {alert.aed.nazwa} ({formatDistance(alert.aed.odleglosc_od_poszkodowanego_m)})
              </Text>
            )}
          </View>

          <View style={styles.mapBox}>
            <MapView
              ref={map}
              style={StyleSheet.absoluteFill}
              mapType="hybrid"
              showsUserLocation
              initialRegion={{ latitude: alert.lat, longitude: alert.lon, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
              accessibilityLabel="Mapa: miejsce zdarzenia i najbliższy AED">
              <Marker coordinate={{ latitude: alert.lat, longitude: alert.lon }} title="Poszkodowany" description={where} pinColor={AED.red} />
              {alert.aed && (
                <Marker
                  coordinate={{ latitude: alert.aed.lat, longitude: alert.aed.lon }}
                  title={`AED: ${alert.aed.nazwa}`}
                  description={alert.aed.adres}
                  pinColor={AED.green}
                />
              )}
            </MapView>
          </View>

          {/* answer */}
          <View style={styles.section}>
            <Label>Twoja odpowiedź</Label>
            <View style={styles.answers}>
              {RESPONSES.map((r) => {
                const active = alert.moja_odpowiedz === r.key;
                return (
                  <MorphPressable
                    key={r.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active, disabled: alert.status !== 'aktywny' }}
                    disabled={alert.status !== 'aktywny' || sending !== null}
                    onPress={() => answer(r.key)}
                    style={({ pressed }) => [styles.answer, active && styles.answerActive, pressed && { opacity: 0.85 }]}>
                    {sending === r.key ? (
                      <ActivityIndicator color={active ? '#fff' : AED.ink} />
                    ) : (
                      <Text style={[styles.answerText, active && { color: '#fff' }]}>{r.label}</Text>
                    )}
                  </MorphPressable>
                );
              })}
            </View>
            {alert.odpowiedzi && (
              <Text style={styles.muted}>
                Powiadomiono {alert.recipients} os. · AED niesie: {alert.odpowiedzi.przynosze_aed} · idzie na miejsce:{' '}
                {alert.odpowiedzi.ide_na_miejsce}
              </Text>
            )}
          </View>

          <AedGuideEntry />

          <MorphPressable accessibilityRole="button" onPress={call112} style={styles.call112}>
            <IconSymbol name="phone.fill" size={18} color={AED.red} />
            <Text style={styles.call112Text}>Zadzwoń 112</Text>
          </MorphPressable>
          {!!error && <Text style={styles.muted}>{error}</Text>}
        </ScrollView>
      )}
    </View>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <View style={styles.labelRow}>
      <View style={styles.labelSquare} />
      <Text style={styles.label}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AED.background },
  header: { backgroundColor: AED.red },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 },
  headerLabel: { ...TYPE.label, color: '#fff', opacity: 0.85 },
  headerTitle: { ...TYPE.display, color: '#fff', marginTop: 4 },
  close: { width: AED.touch, height: AED.touch, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 20, gap: 12, paddingBottom: 48 },
  statusBanner: { backgroundColor: AED.ink, padding: 14, borderRadius: AED.radius},
  statusText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelSquare: { width: 8, height: 8, backgroundColor: AED.red, borderRadius: 4 },
  label: { ...TYPE.label, color: AED.red },
  task: { borderRadius: AED.radius, backgroundColor: AED.surface, padding: 18, gap: 8 },
  taskTitle: { ...TYPE.title, fontSize: 28, lineHeight: 30, color: AED.ink, marginTop: 4 },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  figure: { ...TYPE.figure, color: AED.ink },
  figureSub: { color: AED.ink, fontSize: 17, fontWeight: '700' },
  step: { color: AED.ink, fontSize: 15, lineHeight: 21 },
  stepNum: { color: AED.red, fontWeight: '500' },
  navigate: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: AED.ink,
  },
  navigateText: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: -0.4 },
  section: { borderRadius: AED.radius, backgroundColor: AED.surface, padding: 18, gap: 8 },
  place: { color: AED.ink, fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  coords: { color: AED.ink, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  muted: { color: AED.muted, fontSize: 13, lineHeight: 18 },
  body: { color: AED.ink, fontSize: 15, textAlign: 'center' },
  mapBox: { height: 260, borderRadius: AED.radius, overflow: 'hidden', backgroundColor: '#E4E5E7' },
  answers: { gap: 8 },
  answer: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: AED.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  answerActive: { backgroundColor: AED.red, borderColor: AED.red },
  answerText: { color: AED.ink, fontSize: 16, fontWeight: '600' },
  call112: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AED.red,
    backgroundColor: '#fff',
  },
  call112Text: { color: AED.red, fontSize: 17, fontWeight: '700' },
});
