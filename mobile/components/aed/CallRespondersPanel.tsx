import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { MorphPressable } from '@/components/aed/MorphPressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AED, TYPE } from '@/constants/aed-theme';
import { closeAlert, formatCoords, getAlert, sendAlert, type CommunityAlert } from '@/lib/aed/alerts';
import { formatDistance } from '@/lib/aed/geo';
import type { Coords } from '@/lib/aed/types';

const POLL_MS = 5000;

/**
 * "Wezwij ratowników w pobliżu": sends this position to volunteers within 1 km and shows live answers.
 * Shown on the emergency screen under the 112 button.
 */
export function CallRespondersPanel({ coords, accuracyM }: { coords: Coords | null; accuracyM: number | null }) {
  const [alert, setAlert] = useState<CommunityAlert | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!alert) return;
    try {
      setAlert(await getAlert(alert.id));
    } catch {
      // keep the last state; retry on the next tick
    }
  }, [alert]);

  useEffect(() => {
    if (!alert || alert.status !== 'aktywny') return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [alert, refresh]);

  const send = async () => {
    if (!coords) return;
    setBusy(true);
    setError('');
    try {
      setAlert(await sendAlert({ ...coords, accuracy: accuracyM }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmSend = () =>
    Alert.alert(
      'Wezwać ratowników w pobliżu?',
      'Twoja lokalizacja trafi do osób z włączonym trybem ratownika w promieniu 1 km. Najbliższa z nich przyniesie AED.\n\nJeśli jeszcze tego nie zrobiłeś – zadzwoń też pod 112.',
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Wyślij alarm', style: 'destructive', onPress: send },
      ],
    );

  const finish = async (status: 'odwolany' | 'zakonczony') => {
    if (!alert) return;
    setBusy(true);
    try {
      await closeAlert(alert.id, status);
      setAlert({ ...alert, status });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!alert) {
    return (
      <View style={{ gap: 6 }}>
        <MorphPressable
          accessibilityRole="button"
          accessibilityLabel="Wezwij ratowników w pobliżu. Wysyła Twoją lokalizację osobom w promieniu 1 kilometra"
          disabled={!coords || busy}
          onPress={confirmSend}
          style={({ pressed }) => [styles.callButton, (!coords || busy) && { opacity: 0.5 }, pressed && { backgroundColor: AED.red }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <IconSymbol name="bolt.heart.fill" size={22} color="#fff" />}
          <View style={{ flex: 1 }}>
            <Text style={styles.callTitle}>Wezwij ratowników w pobliżu</Text>
            <Text style={styles.callSub}>Alarm do osób w promieniu 1 km</Text>
          </View>
        </MorphPressable>
        {!coords && <Text style={styles.muted}>Czekam na Twoją lokalizację…</Text>}
        {!!error && <Text style={[styles.muted, { color: AED.red }]}>{error}</Text>}
      </View>
    );
  }

  const active = alert.status === 'aktywny';
  const o = alert.odpowiedzi ?? { przynosze_aed: 0, ide_na_miejsce: 0, nie_moge: 0 };
  return (
    <View style={styles.panel} accessibilityLiveRegion="polite">
      <View style={styles.labelRow}>
        <View style={[styles.labelSquare, !active && { backgroundColor: AED.muted }]} />
        <Text style={[styles.label, !active && { color: AED.muted }]}>
          {active ? 'Alarm wysłany' : alert.status === 'zakonczony' ? 'Alarm zakończony' : 'Alarm odwołany'}
        </Text>
      </View>
      <View style={styles.figures}>
        <Figure value={alert.recipients} label="powiadomionych" />
        <Figure value={o.przynosze_aed} label="niesie AED" accent />
        <Figure value={o.ide_na_miejsce} label="idzie pomóc" />
      </View>
      {active && alert.recipients === 0 && (
        <Text style={styles.body}>
          W promieniu 1 km nie ma teraz aktywnych ratowników. Dzwoń 112 i poproś kogoś obok o przyniesienie AED.
        </Text>
      )}
      <Text style={styles.muted}>
        {alert.adres ? `${alert.adres} · ` : ''}
        {formatCoords(alert.lat, alert.lon)}
        {alert.aed ? ` · najbliższy AED: ${alert.aed.nazwa} (${formatDistance(alert.aed.odleglosc_od_poszkodowanego_m)})` : ''}
      </Text>
      {active && (
        <View style={styles.row}>
          <MorphPressable accessibilityRole="button" disabled={busy} onPress={() => finish('zakonczony')} style={styles.secondary}>
            <Text style={styles.secondaryText}>Pomoc dotarła</Text>
          </MorphPressable>
          <MorphPressable accessibilityRole="button" disabled={busy} onPress={() => finish('odwolany')} style={styles.secondary}>
            <Text style={styles.secondaryText}>Odwołaj alarm</Text>
          </MorphPressable>
        </View>
      )}
    </View>
  );
}

function Figure({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.figure, accent && { color: AED.red }]}>{value}</Text>
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: AED.ink,
  },
  callTitle: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  callSub: { color: '#fff', opacity: 0.7, fontSize: 13, marginTop: 1 },
  panel: { borderRadius: AED.radius, backgroundColor: AED.surface, padding: 18, gap: 10 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelSquare: { width: 8, height: 8, backgroundColor: AED.red, borderRadius: 4 },
  label: { ...TYPE.label, color: AED.red },
  figures: { flexDirection: 'row', gap: 12 },
  figure: { ...TYPE.figure, color: AED.ink },
  figureLabel: { color: AED.muted, fontSize: 12, fontWeight: '700' },
  body: { color: AED.ink, fontSize: 14, lineHeight: 19 },
  muted: { color: AED.muted, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10 },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: AED.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  secondaryText: { color: AED.ink, fontSize: 15, fontWeight: '800' },
});
