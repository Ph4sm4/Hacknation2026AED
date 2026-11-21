import { Download, ExternalLink, FileCode2, Database, Link2, Copy, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, PageHeader, Stat } from "../components/ui";
import { api, fmt } from "../lib/api";

type Stats = {
  generated_at: string;
  total: number;
  official_records: number;
  osm_records: number;
  matched_official_osm: number;
  multi_source: number;
  access_24_7: number;
  public_access: number;
  missing_hours: number;
  verified_last_year: number;
  avg_quality: number;
  per_voivodeship: Record<string, number>;
  per_source: Record<string, number>;
  field_completeness: Record<string, number>;
  problems: Record<string, number>;
  reports: number;
  holders: number;
  submissions: number;
  sources: { key: string; name: string; publisher: string; kind: string; license: string; url: string; snapshot_date: string; notes: string[]; stats: { rows?: number; fixes?: number; mapping?: string[] } }[];
  pending_sources: { name: string; publisher: string; url: string; reason: string }[];
};

const pct = (a: number, b: number) => `${Math.round((100 * a) / Math.max(1, b))}%`;

export default function DataPage() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    api<Stats>("/api/stats").then(setS);
  }, []);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <PageHeader eyebrow="Dane otwarte" title="Ogólnopolski zbiór defibrylatorów AED">
        Zintegrowany z rozproszonych źródeł, ujednolicony do wzorcowego zakresu danych i gotowy do automatycznego importu w portalu dane.gov.pl.
        Wszystkie zasoby w formatach odczytywalnych maszynowo (CSV, JSON, GeoJSON, XLSX, XML).
      </PageHeader>

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10">
        {s && (
          <section aria-labelledby="h-stats">
            <h2 id="h-stats" className="sr-only">Statystyki</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="AED w zbiorze" value={fmt.format(s.total)} sub={`z ${s.sources.length} źródeł`} tone="navy" />
              <Stat label="Z danych dysponentów" value={fmt.format(s.official_records)} sub={`${s.matched_official_osm} potwierdzonych też w OSM`} tone="brand" />
              <Stat label="Dostęp całodobowy" value={pct(s.access_24_7, s.total)} sub={`${fmt.format(s.access_24_7)} urządzeń 24/7`} tone="ok" />
              <Stat label="Bez godzin dostępności" value={pct(s.missing_hours, s.total)} sub="główna luka w danych" tone="warn" />
            </div>
          </section>
        )}

        <section aria-labelledby="h-dl">
          <h2 id="h-dl" className="h-section">Pobierz dane</h2>
          <p className="mt-2 max-w-3xl text-muted">
            Zbiór publikujemy w dwóch wariantach licencyjnych. Portal dane.gov.pl przyjmuje licencje Creative Commons – dlatego do automatycznego importu
            kierujemy <strong className="text-ink">dane dysponentów</strong>, a pełny zbiór z OpenStreetMap (ODbL) udostępniamy w API do weryfikacji i mapy.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <DownloadCard
              title="Dane dysponentów"
              badge="CC BY 4.0 / CC0 → dane.gov.pl"
              tone="brand"
              desc={`${s ? fmt.format(s.official_records) : "…"} rekordów z oficjalnych zbiorów gmin, w wzorcowym zakresie danych.`}
              files={[
                ["CSV", "/api/download/oficjalne.csv"],
                ["GeoJSON", "/api/download/oficjalne.geojson"],
                ["JSON", "/api/download/oficjalne.json"],
              ]}
            />
            <DownloadCard
              title="Zbiór zintegrowany"
              badge="ODbL 1.0 (zawiera OSM)"
              tone="navy"
              desc={`${s ? fmt.format(s.total) : "…"} rekordów: dane dysponentów + OpenStreetMap, z identyfikatorem krajowym, źródłami i wskaźnikiem jakości.`}
              files={[
                ["CSV", "/api/download/aed_polska.csv"],
                ["XLSX", "/api/download/aed_polska.xlsx"],
                ["GeoJSON", "/api/download/aed_polska.geojson"],
                ["JSON", "/api/download/aed_polska.json"],
              ]}
            />
          </div>
        </section>

        <section aria-labelledby="h-dgp" className="card border-t-4 border-t-navy p-6">
          <div className="flex items-start gap-4">
            <Database className="mt-1 hidden h-8 w-8 shrink-0 text-navy sm:block" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 id="h-dgp" className="text-xl font-bold">Integracja z dane.gov.pl</h2>
              <p className="mt-1 text-muted">
                Katalog generowany jest w oficjalnym formacie harwestera XML portalu (<code className="font-mono text-sm">urn:otwarte-dane:harvester:1.13</code>) i
                walidowany względem schematu XSD z kodu źródłowego dane.gov.pl. Dostawca rejestruje adres raz – portal sam pobiera aktualizacje.
              </p>
              <div className="mt-4 space-y-2">
                <CopyRow label="Harwester XML (dane.gov.pl)" value={`${origin}/api/dane-gov-pl/harvester.xml`} />
                <CopyRow label="Katalog DCAT-AP (JSON-LD)" value={`${origin}/api/dcat.jsonld`} />
                <CopyRow label="Schemat danych (Table Schema)" value={`${origin}/api/schema/tableschema.json`} />
                <CopyRow label="REST API (OpenAPI)" value={`${origin}/api/docs`} />
              </div>
            </div>
          </div>
        </section>

        {s && (
          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="h-woj" className="card p-5">
              <h2 id="h-woj" className="text-lg font-bold">Defibrylatory według województw</h2>
              <p className="text-sm text-muted">Liczba urządzeń w zbiorze zintegrowanym</p>
              <Bars data={s.per_voivodeship} format={(v) => fmt.format(v)} />
            </section>
            <section aria-labelledby="h-comp" className="card p-5">
              <h2 id="h-comp" className="text-lg font-bold">Kompletność kluczowych pól</h2>
              <p className="text-sm text-muted">Odsetek rekordów z wypełnionym polem – tu widać, czego brakuje ratownikom</p>
              <Bars
                data={Object.fromEntries(
                  ["lokalizacja_opis", "dostepnosc", "wewnatrz_budynku", "godziny_dostepnosci", "dysponent_nazwa", "data_weryfikacji", "miejscowosc", "kontakt_telefon", "tryb_pediatryczny"].map((k) => [k, s.field_completeness[k] ?? 0]),
                )}
                max={100}
                format={(v) => `${v.toFixed(0)}%`}
                mono
              />
            </section>
          </div>
        )}

        {s && (
          <section aria-labelledby="h-src">
            <h2 id="h-src" className="h-section">Źródła danych</h2>
            <p className="mt-2 max-w-3xl text-muted">
              Każdy plik źródłowy przechodzi przez ten sam silnik walidacji, z którego korzystają dysponenci – automatycznie mapuje kolumny i poprawia typowe błędy.
            </p>
            <div className="mt-5 overflow-x-auto rounded border border-line">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">Źródła danych o AED</caption>
                <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3">Źródło</th>
                    <th scope="col" className="px-4 py-3">Typ</th>
                    <th scope="col" className="px-4 py-3">Licencja</th>
                    <th scope="col" className="px-4 py-3 text-right">Rekordy</th>
                    <th scope="col" className="px-4 py-3">Stan / uwagi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {s.sources.map((src) => (
                    <tr key={src.key} className="align-top">
                      <td className="px-4 py-3">
                        <a href={src.url} target="_blank" rel="noreferrer" className="font-semibold text-navy hover:underline">
                          {src.name} <ExternalLink className="inline h-3 w-3" aria-hidden />
                        </a>
                        <p className="text-xs text-muted">{src.publisher} · stan na {src.snapshot_date}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${src.kind === "oficjalne" ? "bg-brand-soft text-brand-dark" : "bg-navy-soft text-navy"}`}>
                          {src.kind === "oficjalne" ? "dysponent" : "społeczność"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{src.license}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt.format(src.stats.rows ?? 0)}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        <ul className="space-y-0.5">
                          {src.notes.slice(0, 4).map((n) => (
                            <li key={n}>• {n}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                  {s.pending_sources.map((p) => (
                    <tr key={p.name} className="bg-surface/60 align-top">
                      <td className="px-4 py-3">
                        <a href={p.url} target="_blank" rel="noreferrer" className="font-semibold text-navy hover:underline">{p.name}</a>
                        <p className="text-xs text-muted">{p.publisher}</p>
                      </td>
                      <td className="px-4 py-3"><span className="badge bg-surface text-muted ring-1 ring-line">oczekuje</span></td>
                      <td className="px-4 py-3 font-mono text-xs">CC BY 4.0</td>
                      <td className="px-4 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-xs text-muted">{p.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Alert tone="info" title="Dlaczego OSM nie trafia wprost do dane.gov.pl?">
                Licencja ODbL wymaga udostępniania na tych samych warunkach, a portal przyjmuje licencje Creative Commons. Rekordy OpenStreetMap służą więc do
                weryfikacji krzyżowej ({s.matched_official_osm} z {s.official_records} rekordów dysponentów potwierdzono w OSM), wskazywania luk i typowania dysponentów do
                zaproszenia w ramach akcji.
              </Alert>
            </div>
          </section>
        )}
        {s && <p className="text-xs text-muted">Zbiór wygenerowano: {new Date(s.generated_at).toLocaleString("pl-PL")}</p>}
      </div>
    </>
  );
}

function DownloadCard({ title, badge, desc, files, tone }: { title: string; badge: string; desc: string; files: [string, string][]; tone: "brand" | "navy" }) {
  return (
    <div className={`card border-t-4 p-5 ${tone === "brand" ? "border-t-brand" : "border-t-navy"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{title}</h3>
        <span className={`badge ${tone === "brand" ? "bg-brand-soft text-brand-dark" : "bg-navy-soft text-navy"}`}>{badge}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{desc}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {files.map(([f, href]) => (
          <li key={f}>
            <a href={href} className="btn btn-outline py-2" download>
              <Download className="h-4 w-4" aria-hidden /> {f}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-60 shrink-0 text-sm font-semibold">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded border border-line bg-surface px-3 py-1.5">
        {value.endsWith(".xml") ? <FileCode2 className="h-4 w-4 shrink-0 text-navy" aria-hidden /> : <Link2 className="h-4 w-4 shrink-0 text-navy" aria-hidden />}
        <a href={value} className="min-w-0 flex-1 truncate font-mono text-xs text-navy hover:underline" target="_blank" rel="noreferrer">
          {value}
        </a>
        <button
          className="shrink-0 p-1 text-muted hover:text-navy"
          aria-label={`Kopiuj: ${label}`}
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setOk(true);
            setTimeout(() => setOk(false), 1500);
          }}
        >
          {ok ? <Check className="h-4 w-4 text-ok" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

function Bars({ data, max, format, mono }: { data: Record<string, number>; max?: number; format: (v: number) => string; mono?: boolean }) {
  const top = max ?? Math.max(...Object.values(data));
  return (
    <ul className="mt-4 space-y-1.5">
      {Object.entries(data).map(([k, v]) => (
        <li key={k} className="group grid grid-cols-[140px_1fr_56px] items-center gap-3 text-sm sm:grid-cols-[180px_1fr_64px]" title={`${k}: ${format(v)}`}>
          <span className={`truncate text-ink ${mono ? "font-mono text-xs" : ""}`}>{k}</span>
          <span className="h-3.5 bg-surface" aria-hidden>
            <span className="block h-full rounded-r bg-navy transition-colors group-hover:bg-brand" style={{ width: `${(100 * v) / top}%` }} />
          </span>
          <span className="text-right font-semibold tabular-nums text-ink">{format(v)}</span>
        </li>
      ))}
    </ul>
  );
}
