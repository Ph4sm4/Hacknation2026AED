import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import { Layers } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Point } from "../lib/api";

type Props = {
  points: Point[];
  origin: [number, number];
  selected: { id: string; lat: number; lon: number } | null;
  highlight: string[];
  onSelect: (id: string) => void;
  onPickOrigin: (lat: number, lon: number) => void;
  fitTo?: [number, number][] | null;
  /** AED under the pointer in the list – pulses on the map */
  hover?: { lat: number; lon: number } | null;
};

const COLORS = { h24: "#0F7B3F", pub: "#0B3D91", lim: "#0B3D91", priv: "#667085" };

function pinSvg(fill: string, ring: boolean, size = 26) {
  return `<svg class="aed-pin" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
  <path fill="${fill}" stroke="#fff" stroke-width="4" d="M32 3C19.8 3 10 12.7 10 24.6 10 40.8 32 61 32 61s22-20.2 22-36.4C54 12.7 44.2 3 32 3z"/>
  <path fill="#fff" d="M32 36.5S20.5 29.6 20.5 22.1c0-3.6 2.8-6.2 6-6.2 2.4 0 4.3 1.3 5.5 3.2 1.2-1.9 3.1-3.2 5.5-3.2 3.2 0 6 2.6 6 6.2 0 7.5-11.5 14.4-11.5 14.4z"/>
  <path fill="${fill}" d="M34.2 18.3 28.2 26.8h3.6l-1.3 5.9 6.2-8.9h-3.6l1.1-5.5z"/>
  ${ring ? '<rect x="44" y="2" width="16" height="16" fill="#C8102E" stroke="#fff" stroke-width="3"/>' : ""}
</svg>`;
}

const iconCache = new Map<string, L.DivIcon>();
function iconFor(flags: number, big = false) {
  const key = `${flags}-${big}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const color = flags & 1 ? COLORS.h24 : flags & 8 ? COLORS.priv : COLORS.pub;
  const size = big ? 40 : 26;
  const icon = L.divIcon({
    className: "",
    html: pinSvg(big ? "#C8102E" : color, (flags & 4) > 0 && !big, size),
    iconSize: [size, size],
    iconAnchor: [size / 2, size - 2],
  });
  iconCache.set(key, icon);
  return icon;
}

type Base = "satellite" | "map";
const BASE_KEY = "gdzieaed.map-base";
const BASE_LABEL: Record<Base, string> = { satellite: "Satelita", map: "Mapa" };

function savedBase(): Base {
  try {
    return localStorage.getItem(BASE_KEY) === "map" ? "map" : "satellite";
  } catch {
    return "satellite";
  }
}

/** URL of the single tile under the map centre – the live thumbnail of the *other* base layer. */
function previewTile(base: Base, lat: number, lon: number, zoom: number): string {
  const z = Math.max(3, Math.min(18, Math.round(zoom) - 1));
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return base === "satellite"
    ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
    : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/** never auto-zoom closer than this – street context stays visible */
const MAX_AUTO_ZOOM = 16;

/**
 * Bring `b` into view without jumping: leaves the map alone when it already shows `b` at street level,
 * otherwise flies to it (capped at MAX_AUTO_ZOOM). `panel` keeps clear of the AED detail panel
 * (400px on the right from 640px up, bottom sheet on phones).
 */
function fitGently(m: L.Map, b: L.LatLngBounds, panel: boolean) {
  const size = m.getSize();
  if (size.x === 0) return;
  const sheet = panel && size.x < 640;
  const tl = L.point(48, 48);
  const br = L.point(panel && !sheet ? 440 : 48, sheet ? Math.round(size.y * 0.6) : 48);
  const view = L.latLngBounds(m.containerPointToLatLng(tl), m.containerPointToLatLng(size.subtract(br)));
  if (m.getZoom() >= 14 && view.contains(b)) return;
  m.flyToBounds(b, { paddingTopLeft: tl, paddingBottomRight: br, maxZoom: MAX_AUTO_ZOOM, duration: 0.6 });
}

/**
 * Whether the camera is moving (fly / zoom animation / drag). While Leaflet animates, the vector pane is only
 * CSS-scaled from the last settled view, so geometry added or changed mid-flight is projected for the new zoom
 * into the old one and appears to float off the streets until the move ends.
 */
const moving = new WeakMap<L.Map, boolean>();
function trackMotion(m: L.Map) {
  m.on("movestart zoomstart", () => moving.set(m, true));
  m.on("moveend zoomend", () => moving.set(m, false));
}

/** Runs `fn` once the camera is still. */
function whenIdle(m: L.Map, signal: AbortSignal, fn: () => void) {
  if (signal.aborted) return;
  if (!moving.get(m)) return fn();
  m.once("moveend", () => whenIdle(m, signal, fn));
}

/**
 * Draws `path` into `lines` progressively from start to end (ease-out, 0.6–1.4 s depending on length),
 * then calls `done`. Works with the canvas renderer, so it extends the geometry frame by frame.
 * Drawing pauses while the camera moves and resumes where it stopped.
 */
function drawPath(m: L.Map, lines: L.Polyline[], path: [number, number][], signal: AbortSignal, done: () => void) {
  const pts = path.map((p) => L.latLng(p));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i - 1].distanceTo(pts[i]));
  const total = cum[cum.length - 1];
  const finish = () => {
    lines.forEach((l) => l.setLatLngs(pts));
    done();
  };
  if (total === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return whenIdle(m, signal, finish);

  const duration = Math.min(1400, Math.max(600, total * 1.2));
  let t0 = performance.now();
  let last = t0;
  let raf = 0;
  let seg = 1;
  const frame = (now: number) => {
    if (moving.get(m)) {
      // hold the progress: shift the start by the time spent waiting
      t0 += now - last;
      last = now;
      raf = requestAnimationFrame(frame);
      return;
    }
    last = now;
    const t = Math.min(1, (now - t0) / duration);
    if (t === 1) return finish();
    const d = total * (1 - Math.pow(1 - t, 3)); // ease-out cubic
    while (seg < pts.length - 1 && cum[seg] < d) seg++;
    const a = pts[seg - 1];
    const b = pts[seg];
    const k = cum[seg] === cum[seg - 1] ? 1 : (d - cum[seg - 1]) / (cum[seg] - cum[seg - 1]);
    const head = L.latLng(a.lat + (b.lat - a.lat) * k, a.lng + (b.lng - a.lng) * k);
    const partial = [...pts.slice(0, seg), head];
    lines.forEach((l) => l.setLatLngs(partial));
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  signal.addEventListener("abort", () => cancelAnimationFrame(raf));
}

/** Walking route from OpenStreetMap data (FOSSGIS OSRM, foot profile). null when unavailable. */
const routeCache = new Map<string, [number, number][] | null>();
async function walkingRoute(from: [number, number], to: [number, number], signal: AbortSignal): Promise<[number, number][] | null> {
  const key = [...from, ...to].map((v) => v.toFixed(5)).join(",");
  if (routeCache.has(key)) return routeCache.get(key)!;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 6000);
  signal.addEventListener("abort", () => ctrl.abort());
  try {
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null; // e.g. rate limit – try again next time
    const data = await res.json();
    const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
    const path = coords?.length ? coords.map(([lon, lat]) => [lat, lon] as [number, number]) : null;
    routeCache.set(key, path);
    return path;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export default function AedMap({ points, origin, selected, onSelect, onPickOrigin, fitTo, hover }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const cluster = useRef<L.MarkerClusterGroup | null>(null);
  const originMarker = useRef<L.Marker | null>(null);
  const selMarker = useRef<L.Marker | null>(null);
  const hoverMarker = useRef<L.Marker | null>(null);
  const hlLayer = useRef<L.LayerGroup | null>(null);
  const pendingFit = useRef<L.LatLngBounds | null>(null);
  const panelOpen = useRef(false);
  const bases = useRef<Record<Base, L.Layer> | null>(null);
  const [base, setBase] = useState<Base>(savedBase);
  const [thumb, setThumb] = useState("");
  const cbs = useRef({ onSelect, onPickOrigin });
  cbs.current = { onSelect, onPickOrigin };

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, preferCanvas: true, maxZoom: 20 }).setView(origin, 15);
    L.control.zoom({ position: "bottomright", zoomInTitle: "Przybliż", zoomOutTitle: "Oddal" }).addTo(m);

    // Satellite (default): official orthophoto of Poland from GUGiK (Geoportal WMS) + street / place labels
    const ortho = L.tileLayer.wms("https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution", {
      layers: "Raster",
      format: "image/jpeg",
      version: "1.3.0",
      maxZoom: 20,
      attribution: 'Ortofotomapa © <a href="https://www.geoportal.gov.pl">GUGiK</a>',
    });
    const esri = (name: string) =>
      L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Reference/${name}/MapServer/tile/{z}/{y}/{x}`, {
        maxZoom: 20,
        maxNativeZoom: 19,
        attribution: "Opisy © Esri",
      });
    const satellite = L.layerGroup([ortho, esri("World_Transportation"), esri("World_Boundaries_and_Places")]);
    const streets = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      maxNativeZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">współtwórcy OpenStreetMap</a>',
    });
    bases.current = { satellite, map: streets };
    bases.current[base].addTo(m);
    // AED data attribution stays visible on every base layer
    m.attributionControl.addAttribution('Trasa: <a href="https://routing.openstreetmap.de/about.html">FOSSGIS OSRM</a>');
    m.attributionControl.addAttribution('AED: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (ODbL), dane.gov.pl');
    m.on("click", (e: L.LeafletMouseEvent) => cbs.current.onPickOrigin(e.latlng.lat, e.latlng.lng));
    hlLayer.current = L.layerGroup().addTo(m);
    trackMotion(m);
    map.current = m;
    const updateThumb = () => {
      const c = m.getCenter();
      setThumb(previewTile(m.hasLayer(satellite) ? "map" : "satellite", c.lat, c.lng, m.getZoom()));
    };
    m.on("moveend", updateThumb);
    updateThumb();
    // The map may be created inside a hidden container (mobile "Lista" tab) – keep its size in sync
    // and apply a deferred fit once it becomes visible.
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      if (m.getSize().x > 0 && pendingFit.current) {
        const b = pendingFit.current;
        pendingFit.current = null;
        fitGently(m, b, panelOpen.current);
      }
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // all points (clustered)
  useEffect(() => {
    const m = map.current;
    if (!m || !points.length) return;
    cluster.current?.remove();
    const cg = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      disableClusteringAtZoom: 17,
      iconCreateFunction: (c) => {
        const n = c.getChildCount();
        const s = n < 10 ? 30 : n < 100 ? 36 : n < 1000 ? 42 : 48;
        return L.divIcon({ html: `<span>${n}</span>`, className: `aed-cluster${n >= 100 ? " lg" : ""}`, iconSize: [s, s] });
      },
    });
    const markers = points.map(([id, lat, lon, flags]) => {
      const mk = L.marker([lat, lon], { icon: iconFor(flags), keyboard: false, title: "Defibrylator AED" });
      mk.on("click", () => cbs.current.onSelect(id));
      return mk;
    });
    cg.addLayers(markers);
    cg.addTo(m);
    cluster.current = cg;
  }, [points]);

  // origin (user / chosen point)
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    originMarker.current?.remove();
    originMarker.current = L.marker(origin, {
      icon: L.divIcon({
        className: "",
        html: '<div style="width:18px;height:18px;background:#0B3D91;border:3px solid #fff;box-shadow:0 0 0 2px #0B3D91"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      zIndexOffset: 1000,
      title: "Punkt wyszukiwania",
    }).addTo(m);
  }, [origin]);

  useEffect(() => {
    const m = map.current;
    if (!m || !fitTo?.length) return;
    const b = L.latLngBounds(fitTo);
    if (m.getSize().x === 0) pendingFit.current = b;
    else fitGently(m, b, panelOpen.current);
  }, [fitTo]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const lg = hlLayer.current!;
    panelOpen.current = !!selected;
    selMarker.current?.remove();
    lg.clearLayers();
    if (!selected) return;
    const dest: [number, number] = [selected.lat, selected.lon];
    selMarker.current = L.marker(dest, { icon: iconFor(0, true), zIndexOffset: 2000 }).addTo(m);
    if (m.getSize().x === 0) pendingFit.current = L.latLngBounds([origin, dest]);
    else fitGently(m, L.latLngBounds([origin, dest]), true);

    const ctrl = new AbortController();
    walkingRoute(origin, dest, ctrl.signal)
      .then((path) => {
        if (ctrl.signal.aborted) return;
        // no walking route (service down, timeout, rate limit) – fall back to a straight dashed line
        if (!path) {
          whenIdle(m, ctrl.signal, () =>
            L.polyline([origin, dest], { color: "#C8102E", weight: 3, dashArray: "6 6", interactive: false }).addTo(lg),
          );
          return;
        }
        fitGently(m, L.latLngBounds(path).extend(dest), true);
        // white casing under the red line keeps the route readable on the orthophoto
        const casing = L.polyline([], { color: "#fff", weight: 8, opacity: 0.9, lineCap: "round", lineJoin: "round", interactive: false }).addTo(lg);
        const line = L.polyline([], { color: "#C8102E", weight: 4.5, lineCap: "round", lineJoin: "round", interactive: false }).addTo(lg);
        drawPath(m, [casing, line], path, ctrl.signal, () => {
          // the last metres from the street to the AED itself (routes snap to the nearest footway)
          L.polyline([path[path.length - 1], dest], { color: "#C8102E", weight: 3, dashArray: "2 6", lineCap: "round", interactive: false }).addTo(lg);
        });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [selected, origin]);

  useEffect(() => {
    const m = map.current;
    hoverMarker.current?.remove();
    hoverMarker.current = null;
    if (!m || !hover) return;
    hoverMarker.current = L.marker([hover.lat, hover.lon], {
      icon: L.divIcon({ className: "", html: '<div class="aed-hover" style="width:64px;height:64px"></div>', iconSize: [64, 64], iconAnchor: [32, 32] }),
      interactive: false,
      keyboard: false,
      zIndexOffset: -1000,
    }).addTo(m);
  }, [hover]);

  // Google-Maps-style switch: a live thumbnail of the other base layer, bottom-left
  const toggleBase = useCallback(() => {
    const m = map.current;
    const b = bases.current;
    if (!m || !b) return;
    const next: Base = base === "satellite" ? "map" : "satellite";
    m.removeLayer(b[base]);
    b[next].addTo(m);
    setBase(next);
    const c = m.getCenter();
    setThumb(previewTile(base, c.lat, c.lng, m.getZoom()));
    try {
      localStorage.setItem(BASE_KEY, next);
    } catch {
      /* storage unavailable – choice lasts for this visit */
    }
  }, [base]);

  const other: Base = base === "satellite" ? "map" : "satellite";
  return (
    <div className="relative h-full w-full">
      <div ref={el} className="h-full w-full" role="region" aria-label="Mapa defibrylatorów AED. Lista najbliższych urządzeń jest dostępna w panelu obok." />
      <button
        type="button"
        onClick={toggleBase}
        aria-label={`Przełącz widok mapy na: ${BASE_LABEL[other]}`}
        title={BASE_LABEL[other]}
        className="group absolute bottom-6 left-4 z-[1000] h-[84px] w-[84px] overflow-hidden rounded-2xl border-[3px] border-white bg-ink/40 shadow-[0_2px_10px_rgb(11_11_12/0.35)] transition-transform duration-200 hover:scale-[1.04] focus-visible:outline-offset-4"
      >
        {thumb && <img src={thumb} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover" draggable={false} />}
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-2 pb-1.5 pt-5 text-[12px] font-semibold text-white">
          <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {BASE_LABEL[other]}
        </span>
      </button>
    </div>
  );
}
