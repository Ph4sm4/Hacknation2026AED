import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { fetchNearest } from './api';
import { distanceM } from './geo';
import { nearestOffline, snapshotDate } from './snapshot';
import type { AedItem, Coords, DataSource } from './types';

/** Precise location granted, but the fix is still coarser than this – GPS is still locking on (indoors, cold start). */
export const LOCKING_ACCURACY_M = 100;

/**
 * Whether the user granted precise location: iOS "Precise Location" (accuracy 'full' | 'reduced'),
 * Android "Use precise location" ('fine' | 'coarse'). null when the platform does not say.
 */
function preciseFrom(perm: Location.LocationPermissionResponse): boolean | null {
  if (perm.ios?.accuracy) return perm.ios.accuracy === 'full';
  if (perm.android?.accuracy) return perm.android.accuracy === 'fine';
  return null;
}

export type NearestState = {
  status: 'locating' | 'loading' | 'ready' | 'denied' | 'error';
  coords: Coords | null;
  /** Horizontal accuracy of the latest fix in metres (radius of the circle on the map). */
  accuracyM: number | null;
  /** Precise location permission (false = approximate only, user must switch it on in Settings). */
  precise: boolean | null;
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
  precise: null,
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
  const grantedPrecise = useRef<boolean | null>(null);

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
      // GPS reports ~1/s while standing still – only re-render when the accuracy circle visibly changes
      setState((s) => (accuracy == null || Math.round(accuracy) === Math.round(s.accuracyM ?? -1) ? s : { ...s, accuracyM: accuracy }));
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
      grantedPrecise.current = preciseFrom(perm);
      setState((s) => ({ ...s, precise: grantedPrecise.current }));
      // fast first answer from a recent cached fix, then live GPS updates
      const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 });
      if (last) await onPosition(last);
      watch.current = await Location.watchPositionAsync(
        // no distance filter: a coarse first fix must be able to tighten while the user stands still
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0 },
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

  // back from Settings (e.g. "Precise Location" switched on): restart with the new permission
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') return;
      const perm = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!perm) return;
      const precise = perm.status === 'granted' ? preciseFrom(perm) : null;
      if (perm.status === 'granted' && (precise !== grantedPrecise.current || !watch.current)) locate();
    });
    return () => sub.remove();
  }, [locate]);

  return { ...state, refresh: locate };
}
