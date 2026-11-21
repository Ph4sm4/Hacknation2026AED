import { distanceM } from './geo';
import { toAedItem } from './normalize';
import type { AedItem, Coords } from './types';

// [id, lat, lon, nazwa, adres, miejscowosc, opis, godziny, dostepnosc, dostep_24h]
type Row = [string, number, number, string, string, string, string, string, string, string];
type Snapshot = { generatedAt: string; data: Row[] };

let cache: Snapshot | null = null;

/** Loaded lazily (~2 MB) – only when the live API is unreachable. Rebuild: scripts/build-aed-snapshot.mjs */
function load(): Snapshot {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cache ??= require('@/assets/data/aed-snapshot.json') as Snapshot;
  return cache;
}

export const snapshotDate = () => load().generatedAt;

/** Offline nearest search: linear scan over ~18k points takes a few ms on a phone. */
export function nearestOffline(origin: Coords, k = 10): AedItem[] {
  const rows = load().data;
  // cheap equirectangular pre-score, exact haversine only for the winners
  const cosLat = Math.cos((origin.latitude * Math.PI) / 180);
  const scored: { d: number; i: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const dy = rows[i][1] - origin.latitude;
    const dx = (rows[i][2] - origin.longitude) * cosLat;
    scored.push({ d: dx * dx + dy * dy, i });
  }
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, k).map(({ i }) => {
    const [id, lat, lon, nazwa, adres, miejscowosc, opis, godziny, dostepnosc, dostep_24h] = rows[i];
    return toAedItem({
      id,
      latitude: lat,
      longitude: lon,
      nazwa,
      adres,
      miejscowosc,
      opis,
      godziny,
      dostepnosc,
      dostep_24h,
      distanceM: distanceM(origin, { latitude: lat, longitude: lon }),
    });
  });
}
