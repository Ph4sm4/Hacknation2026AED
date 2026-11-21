import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { Polyline } from 'react-native-maps';

import { AED } from '@/constants/aed-theme';
import { distanceM } from '@/lib/aed/geo';
import type { Coords } from '@/lib/aed/types';

/** roughly one segment per this many metres, within [MIN_SEGMENTS, MAX_SEGMENTS] */
const SEGMENT_M = 15;
const MIN_SEGMENTS = 8;
const MAX_SEGMENTS = 32;

/**
 * Splits `path` into `n` pieces of equal length (each piece keeps the original bends).
 * Consecutive pieces share their joint point.
 */
function splitPath(path: Coords[], n: number): Coords[][] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + distanceM(path[i - 1], path[i]));
  const total = cum[cum.length - 1];
  const at = (d: number): { point: Coords; seg: number } => {
    let s = 1;
    while (s < path.length - 1 && cum[s] < d) s++;
    const a = path[s - 1];
    const b = path[s];
    const k = cum[s] === cum[s - 1] ? 1 : Math.min(1, Math.max(0, (d - cum[s - 1]) / (cum[s] - cum[s - 1])));
    return { point: { latitude: a.latitude + (b.latitude - a.latitude) * k, longitude: a.longitude + (b.longitude - a.longitude) * k }, seg: s };
  };
  const pieces: Coords[][] = [];
  let start = { point: path[0], seg: 1 };
  for (let i = 1; i <= n; i++) {
    const end = i === n ? { point: path[path.length - 1], seg: path.length - 1 } : at((total * i) / n);
    // vertices strictly between the two cut points keep the bends of the street
    pieces.push([start.point, ...path.slice(start.seg, end.seg), end.point]);
    start = end;
  }
  return pieces;
}

/**
 * Walking route drawn progressively from the user to the AED (ease-out, 0.6–1.4 s depending on length),
 * red over a white casing – same look as the web map. Once drawn, a dotted line covers the last metres
 * from the footway to the AED itself. Remount (key) to replay for another AED.
 *
 * On iOS react-native-maps re-creates the whole overlay whenever a polyline's coordinates change and
 * MapKit renders overlays asynchronously, so extending one line every frame shows nothing until it stops.
 * Instead the route is cut into short pieces that are only ever added, never changed.
 */
export function AnimatedRoute({ path, dest }: { path: Coords[]; dest: Coords }) {
  const { pieces, total } = useMemo(() => {
    let len = 0;
    for (let i = 1; i < path.length; i++) len += distanceM(path[i - 1], path[i]);
    const n = Math.min(MAX_SEGMENTS, Math.max(MIN_SEGMENTS, Math.round(len / SEGMENT_M)));
    return { pieces: path.length < 2 ? [] : splitPath(path, n), total: len };
  }, [path]);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const n = pieces.length;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce || n === 0) return setShown(n);
      const duration = Math.min(1400, Math.max(600, total * 1.2));
      const t0 = Date.now();
      let last = 0;
      const frame = () => {
        if (cancelled) return;
        const t = Math.min(1, (Date.now() - t0) / duration);
        const count = t === 1 ? n : Math.ceil(n * (1 - Math.pow(1 - t, 3))); // ease-out cubic
        if (count !== last) {
          last = count;
          setShown(count);
        }
        if (t < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [pieces, total]);

  const done = pieces.length > 0 && shown === pieces.length;
  return (
    <>
      {pieces.slice(0, shown).map((p, i) => (
        // casing then red per piece; butt caps keep the next piece's casing off the previous red line
        <PieceLines key={i} coords={p} />
      ))}
      {done && (
        <Polyline coordinates={[path[path.length - 1], dest]} strokeColor={AED.red} strokeWidth={3} lineDashPattern={[2, 6]} lineCap="round" />
      )}
    </>
  );
}

function PieceLines({ coords }: { coords: Coords[] }) {
  return (
    <>
      <Polyline coordinates={coords} strokeColor="#FFFFFF" strokeWidth={8} lineCap="butt" lineJoin="round" />
      <Polyline coordinates={coords} strokeColor={AED.red} strokeWidth={4.5} lineCap="round" lineJoin="round" />
    </>
  );
}

/** Fallback when no walking route could be fetched: straight dashed line. */
export function StraightLine({ from, to }: { from: Coords; to: Coords }) {
  return <Polyline coordinates={[from, to]} strokeColor={AED.red} strokeWidth={3} lineDashPattern={[6, 6]} />;
}
