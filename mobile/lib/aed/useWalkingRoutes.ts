import { useEffect, useMemo, useState } from 'react';

import { routingAvailable, walkingRoute, type WalkingRoute } from '@/modules/aed-routing';
import type { AedItem, Coords } from './types';

/** How many of the straight-line nearest AEDs get a real walking route (MapKit throttles bursts). */
const ROUTED = 3;

/**
 * Real walking routes (Apple MapKit) to the few nearest AEDs, and the list re-ranked by walking time:
 * the AED across a railway line can be 80 m away in a straight line and 1 km on foot.
 * Without the native module (Expo Go) it returns the list unchanged.
 */
export function useWalkingRoutes(coords: Coords | null, items: AedItem[]) {
  const [routes, setRoutes] = useState<Record<string, WalkingRoute>>({});
  const key = coords && items.length ? `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}|${items.slice(0, ROUTED).map((a) => a.id).join(',')}` : '';

  useEffect(() => {
    if (!routingAvailable || !key || !coords) return;
    let cancelled = false;
    setRoutes({}); // routes from the previous position no longer apply
    (async () => {
      const out: Record<string, WalkingRoute> = {};
      for (const a of items.slice(0, ROUTED)) {
        const r = await walkingRoute(coords, { latitude: a.latitude, longitude: a.longitude });
        if (cancelled) return;
        if (r) {
          out[a.id] = r;
          setRoutes({ ...out });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ranked = useMemo(() => {
    const head = items.slice(0, ROUTED);
    if (!head.every((a) => routes[a.id])) return items; // wait until all candidates are routed
    const byWalk = [...head].sort((a, b) => routes[a.id].duration - routes[b.id].duration);
    return [...byWalk, ...items.slice(ROUTED)];
  }, [items, routes]);

  return { routes, ranked, routingAvailable };
}
