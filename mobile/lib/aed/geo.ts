import type { Coords } from './types';

const R = 6371008.8; // mean Earth radius, m
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(a: Coords, b: Coords): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** ~4.8 km/h – same assumption as the GdzieAED API (backend/aed/api/store.py). */
export const walkMinutes = (meters: number) => Math.round((meters / 80) * 10) / 10;

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10 || Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}

export function formatWalk(min: number): string {
  if (min < 1) return 'mniej niż 1 min pieszo';
  if (min < 60) return `ok. ${Math.round(min)} min pieszo`;
  return `ok. ${Math.floor(min / 60)} h ${Math.round(min % 60)} min pieszo`;
}
