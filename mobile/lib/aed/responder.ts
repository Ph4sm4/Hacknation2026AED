/**
 * "Tryb ratownika" – volunteer responder mode.
 *
 * While enabled, iOS delivers location updates to RESPONDER_TASK (also in the background, blue location
 * indicator visible). Every update (throttled) is sent as a heartbeat; the server answers with active
 * "AED needed" alerts within 1 km and the role for this person. New alerts are shown as local notifications.
 *
 * This module must be imported in the app's global scope (app/_layout.tsx) so the task is defined
 * before iOS relaunches the app in the background.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { formatCoords, responderHeartbeat, responderOff, type CommunityAlert } from './alerts';
import { formatDistance } from './geo';
import type { Coords } from './types';

export const RESPONDER_TASK = 'gdzieaed-responder-location';
const ENABLED_KEY = 'gdzieaed.responder.enabled';
const SEEN_KEY = 'gdzieaed.responder.seen-alerts';
const MIN_BEAT_MS = 15_000;

let lastBeat = 0;
let lastResult: { at: number; alerts: CommunityAlert[] } | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function notificationText(a: CommunityAlert): { title: string; body: string } {
  const where = a.adres || formatCoords(a.lat, a.lon);
  const title = `Potrzebny AED – ${formatDistance(a.odleglosc_m ?? 0)} od Ciebie`;
  if (a.rola === 'przynies_aed' && a.aed) {
    return {
      title,
      body: `Weź AED: ${a.aed.nazwa}${a.aed.adres ? `, ${a.aed.adres}` : ''} (${formatDistance(a.odleglosc_do_aed_m ?? 0)}) i zanieś do poszkodowanego: ${where}.`,
    };
  }
  return { title, body: `Idź do poszkodowanego: ${where}. Pomóż przy uciskaniu klatki piersiowej, ktoś inny przyniesie AED.` };
}

async function notifyNew(alerts: CommunityAlert[]) {
  if (!alerts.length) return;
  const seen = new Set<number>(JSON.parse((await AsyncStorage.getItem(SEEN_KEY).catch(() => null)) ?? '[]'));
  for (const a of alerts) {
    if (seen.has(a.id) || a.status !== 'aktywny' || a.moja_odpowiedz) continue;
    seen.add(a.id);
    const { title, body } = notificationText(a);
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, data: { alertId: a.id } },
      trigger: null,
    }).catch(() => undefined);
  }
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-50))).catch(() => undefined);
}

/** Send the position (throttled) and notify about new alerts. Safe to call from the task and the UI. */
export async function beat(c: Coords & { accuracy?: number | null }, force = false): Promise<CommunityAlert[]> {
  const now = Date.now();
  if (!force && now - lastBeat < MIN_BEAT_MS) return lastResult?.alerts ?? [];
  lastBeat = now;
  const r = await responderHeartbeat(c);
  lastResult = { at: now, alerts: r.alerts };
  await notifyNew(r.alerts);
  return r.alerts;
}

export const lastHeartbeat = () => lastResult;

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(RESPONDER_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const loc = data.locations[data.locations.length - 1];
  try {
    await beat({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy });
  } catch {
    // offline – next location update retries
  }
});

export async function isResponderEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY).catch(() => null)) === '1';
}

export type EnableResult = { ok: true } | { ok: false; reason: string };

export async function enableResponder(): Promise<EnableResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, reason: 'Bez dostępu do lokalizacji tryb ratownika nie zadziała.' };
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    return {
      ok: false,
      reason: 'Zezwól na lokalizację „Zawsze” (Ustawienia → mObywatelAED → Lokalizacja), aby dostawać alarmy, gdy aplikacja działa w tle.',
    };
  }
  await Notifications.requestPermissionsAsync().catch(() => undefined);
  if (!(await Location.hasStartedLocationUpdatesAsync(RESPONDER_TASK).catch(() => false))) {
    await Location.startLocationUpdatesAsync(RESPONDER_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.Other,
    });
  }
  await AsyncStorage.setItem(ENABLED_KEY, '1');
  try {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await beat({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }, true);
  } catch {
    // the background task will send the first heartbeat
  }
  return { ok: true };
}

export async function disableResponder() {
  await AsyncStorage.setItem(ENABLED_KEY, '0');
  if (await Location.hasStartedLocationUpdatesAsync(RESPONDER_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(RESPONDER_TASK).catch(() => undefined);
  }
  lastResult = null;
  await responderOff().catch(() => undefined); // server deletes the stored position
}
