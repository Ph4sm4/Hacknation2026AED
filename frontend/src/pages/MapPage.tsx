import { Crosshair, Footprints, MapPin, Navigation, Search, X, Building2, Clock, KeyRound, Layers, Lock, ShieldCheck, Flag, List, Map as MapIcon, Users, HeartPulse, ChevronRight } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ACCESS_LABEL, SOURCE_LABEL, address, api, displayName, distance, hoursPl, type AED, type Point } from "../lib/api";
import { Alert, MetaRow, OpenBadge, QualityBar, Tag } from "../components/ui";
import { AedGuideDialog } from "../components/AedGuide";
import { GUIDE_STEPS } from "../lib/aedGuide";

const AedMap = lazy(() => import("../components/AedMap"));

const WATCH_MS = 30_000;
const DEFAULT_ORIGIN: [number, number] = [52.2318, 21.0060]; // Warszawa, Centrum

export default function MapPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [origin, setOrigin] = useState<[number, number]>(DEFAULT_ORIGIN);
  const [originLabel, setOriginLabel] = useState("Przykładowy punkt: Warszawa, Centrum");
  const [nearest, setNearest] = useState<AED[]>([]);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [locating, setLocating] = useState(false);
  const [locatingNote, setLocatingNote] = useState("");
  const [filters, setFilters] = useState({ open_now: false, public_only: true });
  const [selected, setSelected] = useState<AED | null>(null);
  const [hovered, setHovered] = useState<AED | null>(null);
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
      setGeoError("Twoja przeglądarka nie udostępnia lokalizacji. Wyszukaj miejsce lub kliknij punkt na mapie.");
      return;
    }
    // browsers only give the position to https:// pages and localhost – not to http://192.168… addresses
    if (!window.isSecureContext) {
      setGeoError(
        `Przeglądarka udostępnia lokalizację tylko stronom https:// lub localhost, a ta strona działa pod ${window.location.host}. Otwórz ją przez https albo kliknij punkt na mapie.`,
      );
      return;
    }
    setLocating(true);
    const ok = (pos: GeolocationPosition) => {
      setLocating(false);
      setOrigin([pos.coords.latitude, pos.coords.longitude]);
      setOriginLabel(`Twoja lokalizacja (±${Math.round(pos.coords.accuracy)} m)`);
      setSearchRes(null);
    };
    const mac = /Mac/.test(navigator.platform) || /Mac OS X/.test(navigator.userAgent);
    const fail = (err: GeolocationPositionError) => {
      setLocating(false);
      if (err.code === err.PERMISSION_DENIED) {
        setGeoError("Strona nie ma zgody na lokalizację. Kliknij ikonę obok adresu strony → Lokalizacja → Zezwalaj i spróbuj ponownie.");
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setGeoError(
          mac
            ? "Mac nie zdołał ustalić pozycji (bez GPS liczy ją z okolicznych sieci Wi-Fi). Sprawdź, czy Wi-Fi jest włączone i czy aplikacja Mapy pokazuje Twoje położenie. Do tego czasu wyszukaj miejsce albo kliknij punkt na mapie."
            : "Urządzenie nie zdołało ustalić pozycji. Sprawdź, czy usługi lokalizacji są włączone, albo kliknij punkt na mapie.",
        );
      } else {
        setGeoError("Ustalanie pozycji trwało zbyt długo. Spróbuj ponownie, wyszukaj miejsce albo kliknij punkt na mapie.");
      }
    };
    // macOS CoreLocation often answers "location unknown" (kCLErrorLocationUnknown) before its Wi-Fi scan finishes.
    // A one-shot request gives up right there, so on that error keep watching for up to WATCH_MS.
    const watchFor = (lastErr: GeolocationPositionError) => {
      setLocatingNote("Szukam sygnału… (do 30 s)");
      let done = false;
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          if (done) return;
          done = true;
          navigator.geolocation.clearWatch(id);
          clearTimeout(timer);
          setLocatingNote("");
          ok(pos);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED && !done) {
            done = true;
            navigator.geolocation.clearWatch(id);
            clearTimeout(timer);
            setLocatingNote("");
            fail(err);
          }
          // POSITION_UNAVAILABLE while watching: CoreLocation keeps trying – wait
        },
        { enableHighAccuracy: false, maximumAge: 600000 },
      );
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        navigator.geolocation.clearWatch(id);
        setLocatingNote("");
        fail(lastErr);
      }, WATCH_MS);
    };
    navigator.geolocation.getCurrentPosition(
      ok,
      (err) => (err.code === err.PERMISSION_DENIED ? fail(err) : watchFor(err)),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  const select = useCallback(async (id: string) => {
    const r = await api<AED>(`/api/aed/${id}`);
    setSelected(r);
    setMobileView("map");
  }, []);

  // deep link /?aed=AED-PL-… (moderation panel, shared links): centre on that AED and open its details
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("aed");
    if (!id) return;
    api<AED>(`/api/aed/${encodeURIComponent(id)}`)
      .then((r) => {
        setOrigin([r.szerokosc_geograficzna, r.dlugosc_geograficzna]);
        setOriginLabel(`AED: ${displayName(r)}`);
        setSelected(r);
      })
      .catch(() => undefined);
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
  const hoverPos = useMemo(() => (hovered ? { lat: hovered.szerokosc_geograficzna, lon: hovered.dlugosc_geograficzna } : null), [hovered]);

  return (
    <div className="relative flex h-full flex-col lg:flex-row">
      {/* mobile view switch */}
      <div className="flex border-b border-line lg:hidden" role="tablist" aria-label="Widok">
        {(["list", "map"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={mobileView === v}
            onClick={() => setMobileView(v)}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-bold ${mobileView === v ? "border-b-4 border-brand text-ink" : "border-b-4 border-transparent text-ink/50"}`}
          >
            {v === "list" ? <List className="h-4 w-4" aria-hidden /> : <MapIcon className="h-4 w-4" aria-hidden />}
            {v === "list" ? "Lista" : "Mapa"}
          </button>
        ))}
      </div>

      {/* side panel */}
      <aside
        className={`${mobileView === "list" ? "flex" : "hidden"} min-h-0 w-full flex-1 flex-col border-r border-line bg-white lg:flex lg:w-[340px] lg:flex-none 2xl:w-[380px]`}
        aria-label="Wyszukiwanie defibrylatorów"
      >
        <div className="space-y-3 p-4">
          <p className="eyebrow">Znajdź AED</p>
          <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.025em]">Najbliższy defibrylator</h1>
          <button onClick={locate} disabled={locating} className="btn btn-primary w-full" aria-busy={locating}>
            <Crosshair className={`h-5 w-5 ${locating ? "animate-spin" : ""}`} aria-hidden /> {locating ? locatingNote || "Ustalam lokalizację…" : "Użyj mojej lokalizacji"}
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
            <button className="btn btn-navy px-3.5" type="submit">
              Szukaj
            </button>
          </form>
          <fieldset className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <legend className="sr-only">Filtry</legend>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[#C8102E]" checked={filters.open_now} onChange={(e) => setFilters((f) => ({ ...f, open_now: e.target.checked }))} />
              Dostępne teraz
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[#C8102E]" checked={filters.public_only} onChange={(e) => setFilters((f) => ({ ...f, public_only: e.target.checked }))} />
              Pomiń prywatne
            </label>
          </fieldset>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          <span className="flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
            {searchRes ? `Wyniki wyszukiwania: ${searchRes.length}` : originLabel}
          </span>
          {searchRes && (
            <button className="font-bold text-ink underline underline-offset-4" onClick={() => setSearchRes(null)}>
              Wróć do najbliższych
            </button>
          )}
        </div>

        <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 pb-2" aria-live="polite" aria-busy={loading}>
          {list.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => select(a.id)}
                onMouseEnter={() => setHovered(a)}
                onMouseLeave={() => setHovered((h) => (h?.id === a.id ? null : h))}
                onFocus={() => setHovered(a)}
                onBlur={() => setHovered((h) => (h?.id === a.id ? null : h))}
                className={`group flex w-full gap-3 rounded-md px-3 py-3 text-left transition-[background-color,box-shadow,scale] duration-200 ease-out scale-100 hover:scale-[1.015] focus-visible:scale-[1.015] active:scale-[0.99] ${
                  selected?.id === a.id ? "bg-brand-soft" : "hover:bg-surface hover:shadow-[0_6px_18px_-10px_rgb(11_11_12/0.35)]"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-bold leading-snug tracking-[-0.01em] text-ink">{displayName(a)}</span>
                    {a.odleglosc_m !== undefined && (
                      <span className="flex shrink-0 items-center text-[15px] font-extrabold tabular-nums tracking-[-0.02em] text-ink transition-colors duration-200 group-hover:text-brand">
                        {distance(a.odleglosc_m)}
                        <ChevronRight
                          className="h-4 w-0 -translate-x-1 opacity-0 transition-[width,opacity,transform] duration-200 ease-out group-hover:w-4 group-hover:translate-x-0 group-hover:opacity-100"
                          aria-hidden
                        />
                      </span>
                    )}
                  </span>
                  {a.lokalizacja_opis && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{a.lokalizacja_opis}</span>}
                  <MetaRow className="mt-1.5">
                    <OpenBadge open={a.otwarte_teraz} h24={a.dostep_24h === "tak"} />
                    {a.dostepnosc && <Tag icon={<AccessIcon access={a.dostepnosc} />}>{ACCESS_LABEL[a.dostepnosc]}</Tag>}
                    {a.czas_dojscia_min !== undefined && (
                      <Tag icon={<Footprints className="h-3.5 w-3.5 shrink-0" aria-hidden />}><span className="sr-only">pieszo </span>{Math.max(1, Math.round(a.czas_dojscia_min))} min</Tag>
                    )}
                  </MetaRow>
                </span>
              </button>
            </li>
          ))}
          {!loading && list.length === 0 && <li className="p-6 text-center text-sm text-muted">Brak wyników dla wybranych filtrów.</li>}
        </ol>
      </aside>

      {/* map */}
      <div className={`${mobileView === "map" ? "block" : "hidden"} relative isolate min-h-0 flex-1 lg:block`}>
        <Suspense fallback={<div className="flex h-full items-center justify-center text-muted">Ładowanie mapy…</div>}>
          <AedMap points={points} origin={origin} selected={sel} highlight={nearest.map((n) => n.id)} onSelect={select} onPickOrigin={pick} fitTo={fitTo} hover={hoverPos} />
        </Suspense>
        <p className="pointer-events-none absolute left-3 top-3 z-[500] hidden rounded bg-white/95 px-3 py-2 text-xs font-medium text-muted shadow-sm ring-1 ring-line sm:block">
          Kliknij na mapie, aby wyszukać AED wokół wybranego punktu
        </p>
        {selected && <Detail key={selected.id} aed={selected} origin={origin} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function AccessIcon({ access }: { access: string }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (access === "prywatny") return <Lock className={cls} aria-hidden />;
  if (access === "ograniczony") return <KeyRound className={cls} aria-hidden />;
  return <Users className={cls} aria-hidden />;
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
  // slides in from the right edge; on close it slides back out, then unmounts
  const [leaving, setLeaving] = useState(false);
  const close = () => setLeaving(true);
  const [reporting, setReporting] = useState(false);
  const [guide, setGuide] = useState(false);
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
      className={`absolute inset-x-0 bottom-0 z-[1100] max-h-[75%] overflow-y-auto overscroll-contain rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-4 sm:max-h-none sm:w-[400px] sm:border sm:border-line ${leaving ? "animate-slide-out-right" : "animate-slide-in-right"}`}
      onAnimationEnd={(e) => {
        if (leaving && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-white p-4">
        <div>
          <MetaRow>
            <OpenBadge open={aed.otwarte_teraz} h24={aed.dostep_24h === "tak"} />
            {aed.zrodla.some((s) => s !== "osm") && <Tag tone="brand" strong icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}>Dane dysponenta</Tag>}
          </MetaRow>
          <h2 className="mt-2 text-lg font-extrabold leading-snug">{displayName(aed)}</h2>
          {address(aed) && <p className="text-sm text-muted">{address(aed)}</p>}
          {aed.adres_zrodlo?.startsWith("PRG") && (
            <p className="text-xs text-muted">Adres przybliżony: {aed.adres_zrodlo}</p>
          )}
          {aed.zgloszony_problem && (
            <p className="mt-1"><Tag tone="brand">Zgłoszony problem: {aed.zgloszony_problem.replace("_", " ")} (zweryfikowany)</Tag></p>
          )}
          {aed.potwierdzone_przez_mieszkanca && (
            <p className="mt-1"><Tag tone="ok">Potwierdzony przez mieszkańca {aed.potwierdzone_przez_mieszkanca}</Tag></p>
          )}
        </div>
        <button onClick={close} className="btn btn-outline h-10 min-h-0 w-10 shrink-0 p-0" aria-label="Zamknij szczegóły">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-2xl bg-navy-soft p-4">
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

        <button
          type="button"
          onClick={() => setGuide(true)}
          className="group flex w-full items-center gap-3 rounded-md border border-brand/25 bg-brand-soft p-3 text-left transition-colors hover:bg-brand/15"
        >
          <span className="flex shrink-0 -space-x-3" aria-hidden>
            {GUIDE_STEPS.slice(0, 3).map((s) => (
              <span key={s.title} className="h-11 w-11 rounded-sm bg-white p-1 ring-2 ring-brand-soft" dangerouslySetInnerHTML={{ __html: s.svg }} />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 font-extrabold text-ink">
              <HeartPulse className="h-4 w-4 text-brand" aria-hidden /> Jak użyć AED?
            </span>
            <span className="block text-sm text-muted">5 kroków z rysunkami</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
        <AedGuideDialog open={guide} onClose={() => setGuide(false)} />

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
            <ul className="mt-3 space-y-1">
              {aed.problemy_jakosci.map((p) => (
                <li key={p}>
                  <Tag tone="warn" icon={<span aria-hidden>–</span>}>{p.charAt(0).toUpperCase() + p.slice(1)}</Tag>
                </li>
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
