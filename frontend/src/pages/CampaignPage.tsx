import { ArrowRight, Building2, Clock, Download, FileCheck2, HeartPulse, MapPinned, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LogoMark } from "../components/Logo";
import { api, fmt } from "../lib/api";

type Stats = { total: number; official_records: number; missing_hours: number; campaign_leads: { dysponent: string; aed: number }[] };

export default function CampaignPage() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    api<Stats>("/api/stats").then(setS);
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-brand lg:block" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
          <div className="flex flex-col justify-center">
            <p className="eyebrow">Akcja społeczna · dane.gov.pl</p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] text-ink sm:text-6xl">
              Gdzie<span className="text-brand">AED</span>?
              <br />
              Każda minuta
              <br />
              się liczy.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted">
              Masz defibrylator? Pokaż, gdzie jest. Udostępnij dane w portalu dane.gov.pl – tak, żeby świadek zatrzymania krążenia, dyspozytor 112 i każda
              aplikacja ratunkowa wiedzieli, gdzie jest najbliższe AED, czy jest dostępne i czy działa.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/dysponent" className="btn btn-primary px-6 text-base">
                Udostępnij dane <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to="/standard" className="btn btn-outline px-6 text-base">
                Zobacz wzorcowy zakres
              </Link>
            </div>
            <p className="mt-8 text-2xl font-black tracking-[-0.03em] text-brand">#GdzieAED</p>
          </div>
          <div className="flex items-center justify-center lg:justify-end">
            <div className="flex aspect-square w-full max-w-[420px] flex-col items-center justify-center gap-6 bg-brand p-10 text-white lg:bg-transparent">
              <LogoMark className="h-44 w-44" inverted title="Znak akcji GdzieAED" />
              <p className="text-center text-5xl font-extrabold uppercase tracking-tight">
                Gdzie AED
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="bg-ink text-white" aria-label="Skala problemu">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-3">
          <Num value={s ? fmt.format(s.total) : "…"} label="defibrylatorów zebraliśmy z rozproszonych źródeł" />
          <Num value={s ? fmt.format(s.official_records) : "…"} label="z nich pochodzi z oficjalnych danych dysponentów w dane.gov.pl" accent />
          <Num value={s ? `${Math.round((100 * s.missing_hours) / s.total)}%` : "…"} label="nie ma informacji, w jakich godzinach AED jest dostępne" />
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="h-section max-w-2xl">Dlaczego dane, a nie kolejna aplikacja?</h2>
        <p className="mt-3 max-w-3xl text-muted">
          Aplikacji z mapą AED jest kilka – każda ma inny, niepełny obraz. Problem leży u źródła: dysponenci nie publikują danych albo robią to każdy inaczej. Jeden
          otwarty, jednolity zbiór w dane.gov.pl zasila wszystkie aplikacje, systemy ratownictwa i mapy jednocześnie.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            [MapPinned, "Gdzie dokładnie", "Nie tylko adres – piętro, wejście, „przy recepcji”. Liczy się każdy metr."],
            [Clock, "Kiedy dostępne", "AED zamknięte na klucz po godzinach to AED, którego nie ma. Godziny w standardzie opening_hours."],
            [FileCheck2, "Czy sprawne", "Status, data przeglądu i ważność elektrod – i zgłoszenia od obywateli."],
            [Building2, "Kto odpowiada", "Dysponent z REGON i kontaktem – wiadomo, kogo powiadomić o usterce."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Clock;
            return (
              <div key={t as string} className="rounded-2xl bg-surface p-5">
                <I className="h-7 w-7 text-brand" aria-hidden />
                <h3 className="mt-3 text-lg font-bold">{t as string}</h3>
                <p className="mt-1 text-sm text-muted">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Steps */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="h-section">Trzy kroki dla dysponenta</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              ["Pobierz szablon", "Wzorcowy zakres danych w XLSX lub CSV – z opisem pól i listami wartości."],
              ["Wgraj i sprawdź", "Portal dysponenta sprawdzi plik, poprawi typowe błędy i pokaże braki."],
              ["Opublikuj w dane.gov.pl", "Otrzymujesz plik XML harwestera – portal sam pobiera aktualizacje."],
            ].map(([t, d], i) => (
              <li key={t} className="card p-6">
                <span className="text-[15px] font-medium tabular-nums text-brand">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-lg font-bold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Leads */}
      {s && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="eyebrow">Do kogo idziemy najpierw</p>
              <h2 className="h-section mt-2">Dysponenci, których AED są już na mapach społecznościowych</h2>
              <p className="mt-3 text-muted">
                Wolontariusze OpenStreetMap zmapowali tysiące urządzeń i wskazali ich dysponentów. To gotowa lista instytucji do zaproszenia – ich dane wystarczy
                potwierdzić i opublikować jako oficjalne.
              </p>
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-brand-soft p-4">
                <HeartPulse className="h-6 w-6 shrink-0 text-brand" aria-hidden />
                <p className="text-sm font-semibold text-ink">Jedna instytucja = dziesiątki AED w otwartych danych w jeden dzień.</p>
              </div>
            </div>
            <ol className="divide-y divide-line rounded border border-line">
              {s.campaign_leads.slice(0, 10).map((l, i) => (
                <li key={l.dysponent} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-6 text-right font-bold tabular-nums text-muted">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{l.dysponent}</span>
                  <span className="font-bold tabular-nums text-navy">{l.aed} AED</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Brand */}
      <section className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-12 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold">Materiały akcji</h2>
            <p className="mt-1 text-muted">Logotyp (SVG, PNG, JPG, PDF) i księga znaku – do wykorzystania przez urzędy, szkoły i partnerów.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="btn btn-navy" href="/brand/gdzieaed-logo.svg" download>
              <Download className="h-4 w-4" aria-hidden /> Logotyp SVG
            </a>
            <a className="btn btn-outline" href="/brand/gdzieaed-ksiega-znaku.pdf" download>
              <Download className="h-4 w-4" aria-hidden /> Księga znaku PDF
            </a>
            <button
              className="btn btn-outline"
              onClick={() => navigator.share?.({ title: "GdzieAED", text: "GdzieAED? Każda minuta się liczy. Pokaż, gdzie jest Twój defibrylator – udostępnij dane w dane.gov.pl.", url: window.location.origin + "/akcja" })}
            >
              <Share2 className="h-4 w-4" aria-hidden /> Udostępnij
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function Num({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={`text-5xl font-extrabold leading-none tabular-nums tracking-[-0.035em] sm:text-6xl ${accent ? "text-brand" : "text-white"}`}>{value}</p>
      <p className="mt-3 max-w-xs text-sm text-white/75">{label}</p>
    </div>
  );
}
