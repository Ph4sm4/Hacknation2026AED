import type { WalkingRoute } from '@/modules/aed-routing';
import type { Coords } from './types';

const TIMEOUT_MS = 6000;

/**
 * Walking route from OpenStreetMap data (FOSSGIS OSRM, foot profile) – the same service as the web map.
 * Used when Apple Maps routing is unavailable (Expo Go, Android) or fails. Resolves null on any error.
 */
export async function osrmWalkingRoute(from: Coords, to: Coords): Promise<WalkingRoute | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url =
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.routes?.[0];
    const coords: [number, number][] | undefined = r?.geometry?.coordinates;
    if (!coords?.length) return null;
    return {
      distance: r.distance,
      duration: r.duration,
      coordinates: coords.map(([longitude, latitude]) => ({ latitude, longitude })),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
