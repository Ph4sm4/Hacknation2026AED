import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchNearest } from './api';
import { distanceM } from './geo';
import { nearestOffline, snapshotDate } from './snapshot';
import type { AedItem, Coords, DataSource } from './types';

/** iOS "Precise location: off" reports accuracy in kilometres; anything worse than this is treated as approximate. */
export const APPROXIMATE_ACCURACY_M = 500;

export type NearestState = {
  status: 'locating' | 'loading' | 'ready' | 'denied' | 'error';
  coords: Coords | null;
  /** Horizontal accuracy of the latest fix in metres (radius of the circle on the map). */
  accuracyM: number | null;
  items: AedItem[];
  source: DataSource | null;
  /** ISO date of the bundled snapshot when source === "offline". */
  offlineDate: string | null;
  error: string | null;
};

const INITIAL: NearestState = {
  status: 'locating',
  coords: null,
  accuracyM: null,
  items: [],
  source: null,
  offlineDate: null,
  error: null,
};

/**
 * Location → nearest AEDs. Watches the position at the highest accuracy so the fix tightens as GPS locks on.
 * Live GdzieAED API first; on any network error or timeout falls back to the bundled offline snapshot,
 * so the screen always works in an emergency.
 */
export function useNearestAed(k = 10) {
  const [state, setState] = useState<NearestState>(INITIAL);
  const lastQuery = useRef<Coords | null>(null);
  const requestId = useRef(0);
  const watch = useRef<Location.LocationSubscription | null>(null);

  const loadFor = useCallback(
    async (coords: Coords) => {
      // skip refreshes that moved less than 25 m
      if (lastQuery.current && distanceM(lastQuery.current, coords) < 25) return;
      lastQuery.current = coords;
      const id = ++requestId.current;
      setState((s) => ({ ...s, coords, status: s.items.length ? s.status : 'loading' }));

      let items: AedItem[];
      let source: DataSource = 'live';
      try {
        items = await fetchNearest(coords, k);
      } catch {
        items = nearestOffline(coords, k);
        source = 'offline';
      }
      if (id !== requestId.current) return; // a newer position won
      setState((s) => ({
        ...s,
        status: 'ready',
        coords,
        items,
        source,
        offlineDate: source === 'offline' ? snapshotDate() : null,
        error: null,
      }));
    },
    [k],
  );

  const onPosition = useCallback(
    (pos: Location.LocationObject) => {
      const { latitude, longitude, accuracy } = pos.coords;
      setState((s) => ({ ...s, accuracyM: accuracy ?? s.accuracyM }));
      return loadFor({ latitude, longitude });
    },
    [loadFor],
  );

  const locate = useCallback(async () => {
    watch.current?.remove();
    watch.current = null;
    lastQuery.current = null;
    setState((s) => ({ ...s, status: s.items.length ? s.status : 'locating', error: null }));
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setState((s) => ({ ...s, status: 'denied' }));
        return;
      }
      // fast first answer from a recent cached fix, then live GPS updates
      const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 });
      if (last) await onPosition(last);
      watch.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5 },
        onPosition,
      );
    } catch {
      setState((s) =>
        s.items.length
          ? s
          : { ...s, status: 'error', error: 'Nie udało się ustalić Twojej lokalizacji. Sprawdź, czy GPS jest włączony.' },
      );
    }
  }, [onPosition]);

  useEffect(() => {
    locate();
    return () => {
      watch.current?.remove();
      watch.current = null;
    };
  }, [locate]);

  return { ...state, refresh: locate };
}
