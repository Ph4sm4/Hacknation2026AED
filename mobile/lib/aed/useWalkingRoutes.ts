import { useEffect, useMemo, useState } from 'react';

import { routingAvailable, walkingRoute, type WalkingRoute } from '@/modules/aed-routing';
import { osrmWalkingRoute } from './osrm';
import type { AedItem, Coords } from './types';

/** How many of the straight-line nearest AEDs get a real walking route (MapKit throttles bursts). */
const ROUTED = 3;

export type RouteSource = 'apple' | 'osm';
export type AedRoute = WalkingRoute & { source: RouteSource };

async function routeTo(from: Coords, a: AedItem): Promise<AedRoute | null> {
  const to = { latitude: a.latitude, longitude: a.longitude };
  const apple = routingAvailable ? await walkingRoute(from, to) : null;
  if (apple) return { ...apple, source: 'apple' };
  const osm = await osrmWalkingRoute(from, to);
  return osm ? { ...osm, source: 'osm' } : null;
}

/**
 * Real walking routes to the few nearest AEDs, and the list re-ranked by walking time:
 * the AED across a railway line can be 80 m away in a straight line and 1 km on foot.
 * Apple Maps (native module) first, OpenStreetMap routing (OSRM) when it is missing (Expo Go) or fails.
 * `failed` marks AEDs for which neither service answered – the map then shows a straight line.
 */
export function useWalkingRoutes(coords: Coords | null, items: AedItem[], selected?: AedItem | null) {
  const [routes, setRoutes] = useState<Record<string, AedRoute>>({});
  const [failed, setFailed] = useState<Record<string, true>>({});
  const key = coords && items.length ? `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}|${items.slice(0, ROUTED).map((a) => a.id).join(',')}` : '';

  useEffect(() => {
    if (!key || !coords) return;
    let cancelled = false;
    // routes from the previous position no longer apply
    setRoutes({});
    setFailed({});
    (async () => {
      for (const a of items.slice(0, ROUTED)) {
        const r = await routeTo(coords, a);
        if (cancelled) return;
        if (r) setRoutes((prev) => ({ ...prev, [a.id]: r }));
        else setFailed((prev) => ({ ...prev, [a.id]: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // an AED picked further down the list / on the map gets its route on demand
  const extraId = selected && !routes[selected.id] && !failed[selected.id] && !items.slice(0, ROUTED).some((a) => a.id === selected.id) ? selected.id : null;
  useEffect(() => {
    if (!extraId || !coords || !selected) return;
    let cancelled = false;
    routeTo(coords, selected).then((r) => {
      if (cancelled) return;
      if (r) setRoutes((prev) => ({ ...prev, [extraId]: r }));
      else setFailed((prev) => ({ ...prev, [extraId]: true }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraId, key]);

  const ranked = useMemo(() => {
    const head = items.slice(0, ROUTED);
    if (!head.every((a) => routes[a.id] || failed[a.id])) return items; // wait until every candidate is settled
    // AEDs without a route keep their straight-line walking estimate (80 m/min)
    const seconds = (a: AedItem) => routes[a.id]?.duration ?? a.walkMin * 60;
    const byWalk = [...head].sort((a, b) => seconds(a) - seconds(b));
    return [...byWalk, ...items.slice(ROUTED)];
  }, [items, routes, failed]);

  return { routes, failed, ranked };
}
