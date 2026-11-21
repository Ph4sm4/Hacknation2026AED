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

export default function AedMap({ points, origin, selected, highlight, onSelect, onPickOrigin, fitTo }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const cluster = useRef<L.MarkerClusterGroup | null>(null);
  const originMarker = useRef<L.Marker | null>(null);
  const selMarker = useRef<L.Marker | null>(null);
  const hlLayer = useRef<L.LayerGroup | null>(null);
  const pendingFit = useRef<L.LatLngBounds | null>(null);
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
    m.attributionControl.addAttribution('AED: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (ODbL), dane.gov.pl');
    m.on("click", (e: L.LeafletMouseEvent) => cbs.current.onPickOrigin(e.latlng.lat, e.latlng.lng));
    hlLayer.current = L.layerGroup().addTo(m);
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
        m.fitBounds(b, { padding: [60, 60], maxZoom: 17 });
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
    else m.fitBounds(b, { padding: [60, 60], maxZoom: 17 });
  }, [fitTo]);

  // nearest list highlight lines
  useEffect(() => {
    const lg = hlLayer.current;
    if (!lg) return;
    lg.clearLayers();
  }, [highlight]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    selMarker.current?.remove();
    if (!selected) return;
    selMarker.current = L.marker([selected.lat, selected.lon], { icon: iconFor(0, true), zIndexOffset: 2000 }).addTo(m);
    hlLayer.current?.clearLayers();
    L.polyline([origin, [selected.lat, selected.lon]], { color: "#C8102E", weight: 3, dashArray: "6 6" }).addTo(hlLayer.current!);
    if (m.getSize().x === 0) {
      pendingFit.current = L.latLngBounds([origin, [selected.lat, selected.lon]]);
    } else if (!m.getBounds().pad(-0.15).contains([selected.lat, selected.lon])) {
      m.flyTo([selected.lat, selected.lon], Math.max(m.getZoom(), 16), { duration: 0.6 });
    }
  }, [selected, origin]);

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
