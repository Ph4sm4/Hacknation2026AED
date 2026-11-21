import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, PageHeader, Stat } from "../components/ui";
import { api, fmt } from "../lib/api";

type Gmina = {
  teryt: string;
  gmina: string;
  rodzaj: string;
  powiat: string;
  wojewodztwo: string;
  ludnosc: number;
  powierzchnia_km2: number;
  aed: number;
  aed_24h: number;
  aed_publiczne: number;
  aed_na_10_tys: number;
  mieszkancow_na_aed: number | null;
  lat: number | null;
  lon: number | null;
};

type Summary = {
  zrodlo_ludnosci: string;
  gminy: number;
  gminy_bez_aed: number;
  ludnosc_w_gminach_bez_aed: number;
  ludnosc: number;
  aed_przypisane: number;
  aed_bez_gminy: number;
  aed_na_10_tys: number;
  wojewodztwa: { wojewodztwo: string; ludnosc: number; aed: number; gminy: number; gminy_bez_aed: number; aed_na_10_tys: number }[];
};

type Sort = "najlepsze" | "najslabsze" | "bez_aed";

// Sequential navy ramp (one hue, light → dark) for counties; gminas with no AED at all are red dots on top.
const BINS: { min: number; color: string; label: string }[] = [
  { min: 0, color: "#eef2fa", label: "poniżej 2" },
  { min: 2, color: "#c9d7ef", label: "2–3" },
  { min: 3, color: "#9bb4e0", label: "3–4,5" },
  { min: 4.5, color: "#6488cb", label: "4,5–6" },
  { min: 6, color: "#3060b0", label: "6–8" },
  { min: 8, color: "#0b3d91", label: "8 i więcej" },
];
const WHITE_SPOT = "#c8102e";
const colorFor = (v: number) => [...BINS].reverse().find((b) => v >= b.min)!.color;
const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const PAGE = 50;

export default function CoveragePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Gmina[]>([]);
  const [error, setError] = useState("");
  const [woj, setWoj] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("bez_aed");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    api<{ podsumowanie: Summary; gminy: Gmina[] }>("/api/coverage")
      .then((d) => {
        setSummary(d.podsumowanie);
        setRows(d.gminy);
      })
      .catch((e) => setError(e.message));
  }, []);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let out = rows.filter((r) => (!woj || r.wojewodztwo === woj) && (!ql || `${r.gmina} ${r.powiat}`.toLowerCase().includes(ql)));
    if (sort === "bez_aed") out = out.filter((r) => r.aed === 0).sort((a, b) => b.ludnosc - a.ludnosc);
    else if (sort === "najslabsze") out = out.filter((r) => r.aed > 0).sort((a, b) => a.aed_na_10_tys - b.aed_na_10_tys);
    else out = [...out].sort((a, b) => b.aed_na_10_tys - a.aed_na_10_tys);
    return out;
  }, [rows, woj, q, sort]);

  useEffect(() => setShown(PAGE), [woj, q, sort]);
  const whiteSpots = useMemo(() => rows.filter((r) => r.aed === 0 && r.lat != null), [rows]);

  return (
    <>
      <PageHeader eyebrow="Pokrycie AED" title="Białe plamy na mapie defibrylatorów">
        Ile AED przypada na mieszkańców każdej gminy i powiatu. Gminy bez żadnego AED w otwartych danych to pierwsze adresy, pod które kierujemy akcję
        „Pokaż, gdzie jest Twój AED”.
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-10">
        {error && <Alert tone="error" title="Nie udało się wczytać danych o pokryciu">{error}</Alert>}

        {summary && (
          <section aria-labelledby="h-cov-stats">
            <h2 id="h-cov-stats" className="sr-only">Podsumowanie</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-10 py-4 lg:grid-cols-4">
              <Stat label="AED na 10 tys. mieszkańców" value={nf1.format(summary.aed_na_10_tys)} sub="średnio w Polsce" tone="navy" />
              <Stat
                label="Gminy bez żadnego AED"
                value={fmt.format(summary.gminy_bez_aed)}
                sub={`z ${fmt.format(summary.gminy)} gmin`}
                tone="brand"
              />
              <Stat
                label="Mieszkańcy tych gmin"
                value={fmt.format(summary.ludnosc_w_gminach_bez_aed)}
                sub={`${nf1.format((100 * summary.ludnosc_w_gminach_bez_aed) / summary.ludnosc)}% ludności Polski`}
              />
              <Stat label="AED przypisane do gmin" value={fmt.format(summary.aed_przypisane)} sub="granice gmin z PRG GUGiK" />
            </div>
          </section>
        )}

        <section aria-labelledby="h-cov-map" className="space-y-3">
          <h2 id="h-cov-map" className="h-section">Mapa powiatów</h2>
          <p className="text-muted">Kolor: liczba AED na 10 tys. mieszkańców. Najedź na powiat lub dotknij go, aby zobaczyć szczegóły. Ta sama informacja jest w tabeli poniżej.</p>
          <CountyMap whiteSpots={whiteSpots} />
          <Legend />
        </section>

        <section aria-labelledby="h-cov-rank" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="h-cov-rank" className="h-section">Ranking gmin</h2>
            <a className="btn btn-outline" href="/api/download/pokrycie_gmin.csv" download>
              <Download className="h-4 w-4" aria-hidden /> Pobierz CSV
            </a>
          </div>

          <div className="flex flex-wrap gap-3" role="group" aria-label="Filtry rankingu">
            <div>
              <label htmlFor="cov-sort" className="label">Pokaż</label>
              <select id="cov-sort" className="input min-w-56" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="bez_aed">Gminy bez AED (największe)</option>
                <option value="najslabsze">Najsłabiej pokryte (z AED)</option>
                <option value="najlepsze">Najlepiej pokryte</option>
              </select>
            </div>
            <div>
              <label htmlFor="cov-woj" className="label">Województwo</label>
              <select id="cov-woj" className="input min-w-48" value={woj} onChange={(e) => setWoj(e.target.value)}>
                <option value="">Cała Polska</option>
                {summary?.wojewodztwa
                  .map((w) => w.wojewodztwo)
                  .sort((a, b) => a.localeCompare(b, "pl"))
                  .map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div className="min-w-60 flex-1">
              <label htmlFor="cov-q" className="label">Szukaj gminy lub powiatu</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input id="cov-q" className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="np. Legionowo" />
              </div>
            </div>
          </div>

          <p className="text-sm text-muted" aria-live="polite">{fmt.format(list.length)} gmin</p>

          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Ranking gmin według liczby AED na 10 tys. mieszkańców</caption>
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2.5">#</th>
                  <th scope="col" className="px-3 py-2.5">Gmina</th>
                  <th scope="col" className="px-3 py-2.5">Powiat · województwo</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Ludność</th>
                  <th scope="col" className="px-3 py-2.5 text-right">AED</th>
                  <th scope="col" className="px-3 py-2.5 text-right">AED / 10 tys.</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Mieszkańców na 1 AED</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, shown).map((r, i) => (
                  <tr key={r.teryt} className="border-t border-line">
                    <td className="px-3 py-2 tabular-nums text-muted">{i + 1}</td>
                    <th scope="row" className="px-3 py-2 font-semibold">
                      {r.gmina} <span className="font-normal text-muted">({r.rodzaj})</span>
                    </th>
                    <td className="px-3 py-2 text-muted">{r.powiat} · {r.wojewodztwo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt.format(r.ludnosc)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.aed === 0 ? <span className="font-extrabold text-brand">0</span> : fmt.format(r.aed)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{nf1.format(r.aed_na_10_tys)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.mieszkancow_na_aed ? fmt.format(r.mieszkancow_na_aed) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown < list.length && (
            <button className="btn btn-outline" onClick={() => setShown((s) => s + PAGE)}>
              Pokaż kolejne {Math.min(PAGE, list.length - shown)}
            </button>
          )}
        </section>

        {summary && (
          <section aria-labelledby="h-cov-method">
            <h2 id="h-cov-method" className="sr-only">Metodologia</h2>
            <Alert tone="info" title="Jak liczymy">
              AED przypisujemy do gminy według granic z Państwowego Rejestru Granic (usługa ULDK GUGiK). Liczba mieszkańców: {summary.zrodlo_ludnosci.split(", https")[0]}.
              Brak AED oznacza brak w otwartych danych (OpenStreetMap i zbiory dysponentów), a nie zawsze brak urządzenia w gminie. Właśnie dlatego zachęcamy
              dysponentów do udostępniania danych. {summary.aed_bez_gminy > 0 && `${fmt.format(summary.aed_bez_gminy)} AED leży poza granicami gmin (np. na morzu lub tuż za granicą).`}
            </Alert>
          </section>
        )}
      </div>
    </>
  );
}

type CountyProps = { powiat: string; wojewodztwo: string; ludnosc: number; aed: number; gminy: number; gminy_bez_aed: number; aed_na_10_tys: number };

function CountyMap({ whiteSpots }: { whiteSpots: Gmina[] }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false, attributionControl: true }).setView([52.0, 19.3], 6);
    map.createPane("whiteSpots").style.zIndex = "450"; // above the county polygons (overlayPane = 400)
    // no basemap: the choropleth alone reads best and needs no third-party tile service
    map.attributionControl.addAttribution("granice: PRG GUGiK · ludność: GUS 2024 · AED: OpenStreetMap (ODbL) i dysponenci");
    let layer: L.GeoJSON | null = null;
    fetch("/api/coverage/powiaty.geojson")
      .then((r) => r.json())
      .then((gj) => {
        layer = L.geoJSON(gj, {
          style: (f) => ({
            fillColor: colorFor((f?.properties as CountyProps).aed_na_10_tys),
            fillOpacity: 0.9,
            color: "#98a2b3",
            weight: 0.6,
          }),
          onEachFeature: (f, lyr) => {
            const p = f.properties as CountyProps;
            lyr.bindTooltip(
              `<strong>${p.powiat}</strong> (${p.wojewodztwo})<br>` +
                `${nf1.format(p.aed_na_10_tys)} AED na 10 tys. mieszkańców<br>` +
                `${fmt.format(p.aed)} AED · ${fmt.format(p.ludnosc)} mieszkańców<br>` +
                `gminy bez AED: ${p.gminy_bez_aed} z ${p.gminy}`,
              { sticky: true },
            );
            lyr.on({
              mouseover: () => (lyr as L.Path).setStyle({ weight: 2, color: "#101828" }),
              mouseout: () => layer?.resetStyle(lyr as L.Path),
            });
          },
        }).addTo(map);
        map.fitBounds(layer.getBounds(), { padding: [8, 8] });
      });
    mapRef.current = map;
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  // gminas without any AED: red dots sized by population (bounding-box centre of the PRG boundary)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !whiteSpots.length) return;
    const group = L.layerGroup(
      whiteSpots.map((g) =>
        L.circleMarker([g.lat!, g.lon!], {
          radius: Math.max(3, Math.min(11, Math.sqrt(g.ludnosc) / 15)),
          color: "#ffffff",
          weight: 1.5,
          fillColor: WHITE_SPOT,
          fillOpacity: 0.9,
          pane: "whiteSpots",
        }).bindTooltip(`<strong>Gmina ${g.gmina}</strong> (${g.rodzaj})<br>brak AED w otwartych danych<br>${fmt.format(g.ludnosc)} mieszkańców · ${g.powiat}`, {
          sticky: true,
        }),
      ),
    ).addTo(map);
    return () => {
      group.remove();
    };
  }, [whiteSpots]);
  return <div ref={el} className="h-[520px] w-full rounded border border-line !bg-white" role="img" aria-label="Mapa powiatów pokolorowana według liczby AED na 10 tysięcy mieszkańców" />;
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-label="Legenda mapy">
      <span className="font-semibold">AED na 10 tys. mieszkańców:</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white" style={{ background: WHITE_SPOT }} aria-hidden />
        gmina bez AED (wielkość = liczba mieszkańców)
      </span>
      {BINS.map((b) => (
        <span key={b.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-4 w-6 rounded-sm border border-line" style={{ background: b.color }} aria-hidden />
          {b.label}
        </span>
      ))}
    </div>
  );
}
