import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { MorphPressable } from '@/components/aed/MorphPressable';
import { AED, TYPE } from '@/constants/aed-theme';
import type { CommunityAlert } from '@/lib/aed/alerts';
import { formatDistance } from '@/lib/aed/geo';
import { disableResponder, enableResponder, isResponderEnabled, lastHeartbeat } from '@/lib/aed/responder';

/** Opt-in volunteer mode: get "AED needed" alerts from people within 1 km. */
export default function ResponderScreen() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [beatInfo, setBeatInfo] = useState<{ at: number; alerts: CommunityAlert[] } | null>(null);

  useEffect(() => {
    isResponderEnabled().then(setEnabled);
    const t = setInterval(() => setBeatInfo(lastHeartbeat()), 2000);
    return () => clearInterval(t);
  }, []);

  const toggle = useCallback(async (on: boolean) => {
    setBusy(true);
    setError('');
    try {
      if (on) {
        const r = await enableResponder();
        if (!r.ok) setError(r.reason);
        setEnabled(r.ok);
      } else {
        await disableResponder();
        setEnabled(false);
      }
      setBeatInfo(lastHeartbeat());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.labelRow}>
        <View style={styles.labelSquare} />
        <Text style={styles.label}>Tryb ratownika</Text>
      </View>
      <Text style={styles.display}>Pomóż komuś w promieniu 1 km</Text>
      <Text style={styles.lead}>
        Gdy ktoś w pobliżu wezwie pomoc, dostaniesz powiadomienie z miejscem zdarzenia i zadaniem: przynieść najbliższy AED albo od
        razu pomóc przy uciskaniu klatki piersiowej.
      </Text>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchTitle}>Tryb ratownika</Text>
          <Text style={styles.switchSub}>{enabled ? 'Włączony – otrzymujesz alarmy w okolicy' : 'Wyłączony'}</Text>
        </View>
        {enabled === null || busy ? (
          <ActivityIndicator color={AED.red} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={toggle}
            trackColor={{ true: AED.red, false: '#C9CBD0' }}
            accessibilityLabel="Tryb ratownika"
          />
        )}
      </View>

      {!!error && (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
          <MorphPressable onPress={() => Linking.openSettings()} style={styles.smallButton} accessibilityRole="button">
            <Text style={styles.smallButtonText}>Otwórz ustawienia</Text>
          </MorphPressable>
        </View>
      )}

      {enabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alarmy w okolicy</Text>
          <Text style={styles.muted}>
            {beatInfo
              ? `Ostatnie sprawdzenie: ${new Date(beatInfo.at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Czekam na pierwszą pozycję…'}
          </Text>
          {beatInfo?.alerts.length === 0 && <Text style={styles.body}>Brak aktywnych alarmów w promieniu 1 km.</Text>}
          {beatInfo?.alerts.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/alert/[id]', params: { id: String(a.id) } })}
              style={({ pressed }) => [styles.alertRow, pressed && { opacity: 0.8 }]}>
              <Text style={styles.alertDist}>{formatDistance(a.odleglosc_m ?? 0)}</Text>
              <Text style={styles.alertText}>{a.rola === 'przynies_aed' ? 'Przynieś AED' : 'Pomóż na miejscu'}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Jak to działa</Text>
        {[
          'Ktoś przy poszkodowanym wybiera w aplikacji „Wezwij ratowników w pobliżu”.',
          'Ratownicy w promieniu 1 km dostają powiadomienie z adresem i współrzędnymi.',
          'Osoba bliżej najbliższego AED dostaje zadanie: weź AED i zanieś. Pozostali idą od razu pomóc.',
        ].map((t, i) => (
          <View key={t} style={styles.stepRow}>
            <Text style={styles.stepNum}>{String(i + 1).padStart(2, '0')}</Text>
            <Text style={styles.body}>{t}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prywatność i bateria</Text>
        <Text style={styles.body}>
          Pozycja trafia na serwer tylko przy włączonym trybie, z losowym identyfikatorem telefonu, bez konta i danych osobowych. Serwer
          usuwa ją po 15 minutach bez aktualizacji i od razu po wyłączeniu trybu. Tryb korzysta z GPS w tle (niebieski wskaźnik na pasku
          stanu), co zużywa więcej baterii.
        </Text>
        <Text style={[styles.body, { marginTop: 8 }]}>Tryb ratownika nie zastępuje numeru alarmowego 112.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AED.background },
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelSquare: { width: 8, height: 8, backgroundColor: AED.red, borderRadius: 4 },
  label: { ...TYPE.label, color: AED.red },
  display: { ...TYPE.display, color: AED.ink },
  lead: { color: AED.muted, fontSize: 16, lineHeight: 23 },
  switchRow: {
    borderRadius: AED.radius,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: AED.surface,
    padding: 18,
    marginTop: 6,
  },
  switchTitle: { color: AED.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  switchSub: { color: AED.muted, fontSize: 14, marginTop: 2 },
  error: { borderRadius: AED.radius, backgroundColor: AED.redTint, padding: 16, gap: 10 },
  errorText: { color: AED.ink, fontSize: 14, lineHeight: 19 },
  smallButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: AED.ink,
  },
  smallButtonText: { color: AED.ink, fontWeight: '800', fontSize: 15 },
  section: { borderRadius: AED.radius, backgroundColor: AED.surface, padding: 18, gap: 8 },
  sectionTitle: { color: AED.ink, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  muted: { color: AED.muted, fontSize: 13 },
  body: { flex: 1, color: AED.ink, fontSize: 15, lineHeight: 21 },
  stepRow: { flexDirection: 'row', gap: 12 },
  stepNum: { width: 26, color: AED.red, fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'], lineHeight: 21 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AED.line,
  },
  alertDist: { color: AED.red, fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  alertText: { color: AED.ink, fontSize: 16, fontWeight: '700' },
});
