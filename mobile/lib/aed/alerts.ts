import AsyncStorage from '@react-native-async-storage/async-storage';

import { AED_API_URL, fetchWithTimeout } from '@/constants/config';
import type { Coords } from './types';

export type AlertRole = 'przynies_aed' | 'pomoz_na_miejscu';
export type AlertResponse = 'przynosze_aed' | 'ide_na_miejsce' | 'nie_moge';

export type AlertAed = {
  id: string;
  nazwa: string;
  adres: string;
  lokalizacja_opis: string;
  godziny_dostepnosci: string;
  dostep_24h: string;
  lat: number;
  lon: number;
  odleglosc_od_poszkodowanego_m: number;
};

export type CommunityAlert = {
  id: number;
  status: 'aktywny' | 'odwolany' | 'zakonczony' | 'wygasl';
  lat: number;
  lon: number;
  accuracy: number | null;
  adres: string;
  created_at: string;
  expires_at: string;
  recipients: number;
  aed: AlertAed | null;
  odpowiedzi: Record<AlertResponse, number> | null;
  moja_odpowiedz: AlertResponse | null;
  // only when asked with the recipient's position
  odleglosc_m?: number;
  odleglosc_do_aed_m?: number;
  trasa_przez_aed_m?: number;
  rola?: AlertRole;
  czas_min?: number;
};

const DEVICE_KEY = 'gdzieaed.device-id';
let deviceId: string | null = null;

/** Anonymous, random id of this phone (no account, no personal data). */
export async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  let id = await AsyncStorage.getItem(DEVICE_KEY).catch(() => null);
  if (!id) {
    const rnd = () => Math.random().toString(36).slice(2, 10);
    id = `dev_${Date.now().toString(36)}${rnd()}${rnd()}`;
    await AsyncStorage.setItem(DEVICE_KEY, id).catch(() => undefined);
  }
  deviceId = id;
  return id;
}

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  const res = await fetchWithTimeout(
    `${AED_API_URL}${path}`,
    { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } },
    timeoutMs,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof json.detail === 'string' ? json.detail : `Błąd serwera (${res.status})`);
  return json as T;
}

export async function sendAlert(c: Coords & { accuracy?: number | null }): Promise<CommunityAlert> {
  return call('/api/alerts', {
    method: 'POST',
    body: JSON.stringify({ device_id: await getDeviceId(), lat: c.latitude, lon: c.longitude, accuracy: c.accuracy ?? null }),
  });
}

export async function getAlert(id: number, at?: Coords | null): Promise<CommunityAlert> {
  const q = new URLSearchParams({ device_id: await getDeviceId() });
  if (at) {
    q.set('lat', String(at.latitude));
    q.set('lon', String(at.longitude));
  }
  return call(`/api/alerts/${id}?${q}`);
}

export async function respondToAlert(id: number, response: AlertResponse) {
  return call<{ odpowiedzi: Record<AlertResponse, number> }>(`/api/alerts/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ device_id: await getDeviceId(), response }),
  });
}

export async function closeAlert(id: number, status: 'odwolany' | 'zakonczony' = 'odwolany') {
  return call(`/api/alerts/${id}/close`, { method: 'POST', body: JSON.stringify({ device_id: await getDeviceId(), status }) });
}

export async function responderHeartbeat(c: Coords & { accuracy?: number | null }) {
  return call<{ alerts: CommunityAlert[]; radius_m: number }>('/api/responders/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ device_id: await getDeviceId(), lat: c.latitude, lon: c.longitude, accuracy: c.accuracy ?? null }),
  });
}

export async function responderOff() {
  return call(`/api/responders/${await getDeviceId()}`, { method: 'DELETE' });
}

export const formatCoords = (lat: number, lon: number) => `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
