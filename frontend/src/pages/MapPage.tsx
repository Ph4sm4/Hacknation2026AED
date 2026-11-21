import { Crosshair, Footprints, MapPin, Navigation, Search, X, Building2, Clock, KeyRound, Layers, ShieldCheck, Flag, List, Map as MapIcon } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ACCESS_LABEL, SOURCE_LABEL, address, api, displayName, distance, fmt, hoursPl, type AED, type Point } from "../lib/api";
import { Alert, OpenBadge, QualityBar } from "../components/ui";

const AedMap = lazy(() => import("../components/AedMap"));

const DEFAULT_ORIGIN: [number, number] = [52.2318, 21.0060]; // Warszawa, Centrum

export default function MapPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [origin, setOrigin] = useState<[number, number]>(DEFAULT_ORIGIN);
  const [originLabel, setOriginLabel] = useState("Przykładowy punkt: Warszawa, Centrum");
  const [nearest, setNearest] = useState<AED[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [filters, setFilters] = useState({ open_now: false, public_only: true });
  const [selected, setSelected] = useState<AED | null>(null);
  const [q, setQ] = useState("");
  const [searchRes, setSearchRes] = useState<AED[] | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [fitTo, setFitTo] = useState<[number, number][] | null>(null);

  useEffect(() => {
    api<{ data: Point[] }>("/api/aed/points").then((r) => setPoints(r.data));
  }, []);

  const loadNearest = useCallback(
    async (o: [number, number], fit = true) => {
      setLoading(true);
      try {
        const p = new URLSearchParams({ lat: String(o[0]), lon: String(o[1]), k: "8", open_now: String(filters.open_now), public_only: String(filters.public_only) });
        const r = await api<{ data: AED[] }>(`/api/aed/nearest?${p}`);
        setNearest(r.data);
        if (fit && r.data.length) setFitTo([o, ...r.data.slice(0, 3).map((a) => [a.szerokosc_geograficzna, a.dlugosc_geograficzna] as [number, number])]);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    loadNearest(origin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, filters]);

  const locate = () => {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Twoja przeglądarka nie udostępnia lokalizacji.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin([pos.coords.latitude, pos.coords.longitude]);
        setOriginLabel("Twoja lokalizacja");
        setSearchRes(null);
      },
      () => setGeoError("Nie udało się pobrać lokalizacji. Zezwól na dostęp lub kliknij punkt na mapie."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const select = useCallback(async (id: string) => {
    const r = await api<AED>(`/api/aed/${id}`);
    setSelected(r);
    setMobileView("map");
  }, []);

  const pick = useCallback((lat: number, lon: number) => {
    setOrigin([lat, lon]);
    setOriginLabel(`Wybrany punkt: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    setSelected(null);
  }, []);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    const r = await api<{ data: AED[]; total: number }>(`/api/aed?q=${encodeURIComponent(q.trim())}&limit=30`);
    setSearchRes(r.data);
  };

  const list = searchRes ?? nearest;
  const sel = useMemo(() => (selected ? { id: selected.id, lat: selected.szerokosc_geograficzna, lon: selected.dlugosc_geograficzna } : null), [selected]);

  return (
    <div className="relative flex h-[calc(100dvh-100px)] flex-col lg:flex-row">
      {/* mobile view switch */}
      <div className="flex border-b border-line lg:hidden" role="tablist" aria-label="Widok">
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={mobileView === v}
            onClick={() => setMobileView(v)}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold ${mobileView === v ? "border-b-[3px] border-brand text-brand" : "text-muted"}`}
          >
            {v === "list" ? <List className="h-4 w-4" aria-hidden /> : <MapIcon className="h-4 w-4" aria-hidden />}
            {v === "list" ? "Lista" : "Mapa"}
          </button>
        ))}
      </div>

      {/* side panel */}
      <aside
        className={`${mobileView === "list" ? "flex" : "hidden"} min-h-0 w-full flex-1 flex-col border-r border-line bg-white lg:flex lg:w-[420px] lg:flex-none`}
        aria-label="Wyszukiwanie defibrylatorów"
      >
        <div className="space-y-3 border-b border-line p-4">
          <h1 className="text-xl font-extrabold tracking-tight">Znajdź najbliższy defibrylator</h1>
          <button onClick={locate} className="btn btn-primary w-full text-base">
            <Crosshair className="h-5 w-5" aria-hidden /> Użyj mojej lokalizacji
          </button>
          {geoError && <Alert tone="warn">{geoError}</Alert>}
          <form onSubmit={search} role="search" className="flex gap-2">
            <label htmlFor="q" className="sr-only">
              Szukaj miejsca lub miejscowości
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input id="q" value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder="np. dworzec, szkoła, Krosno…" />
            </div>
            <button className="btn btn-navy px-4" type="submit">
              Szukaj
            </button>
          </form>
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <legend className="sr-only">Filtry</legend>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[#0B3D91]" checked={filters.open_now} onChange={(e) => setFilters((f) => ({ ...f, open_now: e.target.checked }))} />
              Dostępne teraz
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[#0B3D91]" checked={filters.public_only} onChange={(e) => setFilters((f) => ({ ...f, public_only: e.target.checked }))} />
              Pomiń prywatne
            </label>
          </fieldset>
        </div>

        <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2 text-xs text-muted">
          <span className="flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-navy" aria-hidden />
            {searchRes ? `Wyniki wyszukiwania: ${searchRes.length}` : originLabel}
          </span>
          {searchRes && (
            <button className="font-semibold text-navy underline" onClick={() => setSearchRes(null)}>
              Wróć do najbliższych
            </button>
          )}
        </div>

        <ol className="min-h-0 flex-1 overflow-y-auto" aria-live="polite" aria-busy={loading}>
          {list.map((a, i) => (
            <li key={a.id} className="border-b border-line">
              <button
                onClick={() => select(a.id)}
                className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-surface ${selected?.id === a.id ? "bg-navy-soft" : ""}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm font-bold ${i === 0 && !searchRes ? "bg-brand text-white" : "bg-navy-soft text-navy"}`}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold leading-snug text-ink">{displayName(a)}</span>
                    {a.odleglosc_m !== undefined && <span className="shrink-0 text-sm font-bold tabular-nums text-navy">{distance(a.odleglosc_m)}</span>}
                  </span>
                  {a.lokalizacja_opis && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{a.lokalizacja_opis}</span>}
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <OpenBadge open={a.otwarte_teraz} h24={a.dostep_24h === "tak"} />
                    {a.dostepnosc && <span className="badge bg-surface text-muted ring-1 ring-line">{ACCESS_LABEL[a.dostepnosc]}</span>}
                    {a.czas_dojscia_min !== undefined && (
                      <span className="badge text-muted">
                        <Footprints className="h-3 w-3" aria-hidden /> ~{Math.max(1, Math.round(a.czas_dojscia_min))} min
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!loading && list.length === 0 && <li className="p-6 text-center text-sm text-muted">Brak wyników dla wybranych filtrów.</li>}
        </ol>
        <Legend total={points.length} />
      </aside>

      {/* map */}
      <div className={`${mobileView === "map" ? "block" : "hidden"} relative isolate min-h-0 flex-1 lg:block`}>
        <Suspense fallback={<div className="flex h-full items-center justify-center text-muted">Ładowanie mapy…</div>}>
          <AedMap points={points} origin={origin} selected={sel} highlight={nearest.map((n) => n.id)} onSelect={select} onPickOrigin={pick} fitTo={fitTo} />
        </Suspense>
        <p className="pointer-events-none absolute left-3 top-3 z-[500] hidden rounded bg-white/95 px-3 py-2 text-xs font-medium text-muted shadow-sm ring-1 ring-line sm:block">
          Kliknij na mapie, aby wyszukać AED wokół wybranego punktu
        </p>
        {selected && <Detail aed={selected} origin={origin} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function Legend({ total }: { total: number }) {
  return (
    <div className="border-t border-line bg-white px-4 py-3 text-xs text-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 bg-ok" /> 24/7</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 bg-navy" /> w godzinach</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 bg-[#667085]" /> prywatny</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 bg-brand" /> dane dysponenta</span>
      </div>
      <p className="mt-1.5">
        <strong className="text-ink">{fmt.format(total)}</strong> defibrylatorów w zbiorze
      </p>
    </div>
  );
}

const REPORT_KINDS: [string, string][] = [
  ["potwierdzam", "Potwierdzam – AED jest na miejscu"],
  ["zamkniety", "Zamknięty / brak dostępu"],
  ["brak_urzadzenia", "Brak urządzenia"],
  ["uszkodzony", "Uszkodzony / rozładowany"],
  ["bledna_lokalizacja", "Błędna lokalizacja"],
  ["inne", "Inny problem"],
];

function Detail({ aed, origin, onClose }: { aed: AED; origin: [number, number]; onClose: () => void }) {
  const [reporting, setReporting] = useState(false);
  const [kind, setKind] = useState("potwierdzam");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    setReporting(false);
    setSent(false);
    setComment("");
  }, [aed.id]);

  const lat = aed.szerokosc_geograficzna;
  const lon = aed.dlugosc_geograficzna;
  const nav = `https://www.google.com/maps/dir/?api=1&origin=${origin[0]},${origin[1]}&destination=${lat},${lon}&travelmode=walking`;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    await api(`/api/aed/${aed.id}/reports`, { method: "POST", body: JSON.stringify({ kind, comment }) });
    setSent(true);
    setReporting(false);
  };

  const rows: [typeof Building2, string, string][] = [
    [Clock, "Godziny dostępności", hoursPl(aed.godziny_dostepnosci)],
    [ShieldCheck, "Kto może skorzystać", ACCESS_LABEL[aed.dostepnosc] + (aed.dostepnosc === "ograniczony" ? " – np. w godzinach otwarcia obiektu" : "")],
    [Layers, "Kondygnacja / położenie", [aed.kondygnacja !== "" ? `poziom ${aed.kondygnacja}` : "", aed.wewnatrz_budynku === "tak" ? "wewnątrz budynku" : aed.wewnatrz_budynku === "nie" ? "na zewnątrz" : ""].filter(Boolean).join(", ") || "Brak danych"],
    [KeyRound, "Szafka", aed.szafka_zamknieta === "tak" ? `Zamknięta${aed.instrukcja_dostepu ? ` – ${aed.instrukcja_dostepu}` : ""}` : aed.szafka_zamknieta === "nie" ? "Otwarta" : "Brak danych"],
    [Building2, "Dysponent", [aed.dysponent_nazwa, aed.kontakt_telefon].filter(Boolean).join(" · ") || "Nieznany"],
  ];

  return (
    <section
      aria-label={`Szczegóły: ${displayName(aed)}`}
      className="absolute inset-x-0 bottom-0 z-[1100] max-h-[75%] overflow-y-auto border-t-4 border-brand bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-4 sm:max-h-none sm:w-[400px] sm:border sm:border-t-4 sm:border-line sm:border-t-brand"
    >
      <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-white p-4">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <OpenBadge open={aed.otwarte_teraz} h24={aed.dostep_24h === "tak"} />
            {aed.zrodla.some((s) => s !== "osm") && <span className="badge bg-brand text-white">Dane dysponenta</span>}
          </div>
          <h2 className="mt-2 text-lg font-extrabold leading-snug">{displayName(aed)}</h2>
          {address(aed) && <p className="text-sm text-muted">{address(aed)}</p>}
        </div>
        <button onClick={onClose} className="btn btn-outline h-10 min-h-0 w-10 shrink-0 p-0" aria-label="Zamknij szczegóły">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded border-l-4 border-navy bg-navy-soft p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-navy">Gdzie dokładnie</p>
          <p className="mt-1 font-medium text-ink">{aed.lokalizacja_opis || "Brak opisu miejsca zawieszenia – pomóż uzupełnić dane."}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a href={nav} target="_blank" rel="noreferrer" className="btn btn-primary">
            <Navigation className="h-4 w-4" aria-hidden /> Prowadź
          </a>
          <a href="tel:112" className="btn btn-outline">
            Dzwoń 112
          </a>
        </div>

        <dl className="divide-y divide-line border-y border-line text-sm">
          {rows.map(([Icon, k, v]) => (
            <div key={k} className="flex gap-3 py-2.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden />
              <div>
                <dt className="text-xs font-semibold text-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="rounded border border-line p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Jakość danych</p>
            <QualityBar value={aed.wskaznik_jakosci} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Źródła: {aed.zrodla.map((s) => SOURCE_LABEL[s] ?? s).join(", ")} · weryfikacja: {aed.data_weryfikacji || "brak daty"}
          </p>
          {aed.problemy_jakosci.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {aed.problemy_jakosci.map((p) => (
                <li key={p} className="badge bg-warn-soft text-warn">{p}</li>
              ))}
            </ul>
          )}
        </div>

        {sent && <Alert tone="ok" title="Dziękujemy!">Zgłoszenie trafi do dysponenta i weryfikacji.</Alert>}
        {!reporting ? (
          <button className="btn btn-outline w-full" onClick={() => setReporting(true)}>
            <Flag className="h-4 w-4" aria-hidden /> Zgłoś problem lub potwierdź AED
          </button>
        ) : (
          <form onSubmit={send} className="space-y-3 rounded border border-line p-3">
            <fieldset>
              <legend className="label">Co chcesz zgłosić?</legend>
              <div className="space-y-1.5">
                {REPORT_KINDS.map(([v, l]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="h-4 w-4 accent-[#C8102E]" />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="cmt" className="label">Komentarz (opcjonalnie)</label>
              <textarea id="cmt" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} className="input" />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-navy flex-1" type="submit">Wyślij</button>
              <button className="btn btn-outline" type="button" onClick={() => setReporting(false)}>Anuluj</button>
            </div>
          </form>
        )}
        {aed.zgloszenia && aed.zgloszenia.length > 0 && (
          <p className="text-xs text-muted">Zgłoszenia obywateli: {aed.zgloszenia.length} (ostatnie: {aed.zgloszenia[0].created_at.slice(0, 10)})</p>
        )}
      </div>
    </section>
  );
}
