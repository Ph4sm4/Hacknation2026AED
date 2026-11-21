import { Check, ExternalLink, Mail, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, PageHeader } from "../components/ui";
import { api, fmt } from "../lib/api";
import { useAuth } from "../lib/auth";

type Status = "nowe" | "przyjete" | "odrzucone";
type Report = {
  id: number;
  aed_id: string;
  kind: string;
  comment: string;
  status: Status;
  created_at: string;
  moderator_note: string;
  moderated_at: string | null;
  moderated_by: string | null;
  inne_nowe_dla_aed: number;
  aed: {
    id: string;
    nazwa: string;
    adres: string;
    lokalizacja_opis: string;
    lat: number;
    lon: number;
    wojewodztwo: string;
    dysponent_nazwa: string;
    kontakt_email: string;
    kontakt_telefon: string;
    zrodla: string[];
    osm_id: string;
  } | null;
};

const KIND: Record<string, { label: string; effect: string; tone: string }> = {
  brak_urzadzenia: { label: "Brak urządzenia", effect: "Po przyjęciu AED znika z wyszukiwania najbliższych i z mapy.", tone: "bg-brand-soft text-brand" },
  uszkodzony: { label: "Uszkodzony", effect: "Po przyjęciu AED jest oznaczony jako niedostępny.", tone: "bg-brand-soft text-brand" },
  zamkniety: { label: "Zamknięty / brak dostępu", effect: "Po przyjęciu AED jest oznaczony jako niedostępny.", tone: "bg-warn-soft text-warn" },
  bledna_lokalizacja: { label: "Błędna lokalizacja", effect: "Po przyjęciu zgłoszenie trafia do poprawy danych.", tone: "bg-warn-soft text-warn" },
  inne: { label: "Inne", effect: "Informacja dla dysponenta.", tone: "bg-surface text-muted" },
  potwierdzam: { label: "Potwierdzenie: AED jest na miejscu", effect: "Po przyjęciu AED dostaje datę potwierdzenia przez mieszkańca.", tone: "bg-ok-soft text-ok" },
};

const TABS: { key: Status; label: string }[] = [
  { key: "nowe", label: "Do sprawdzenia" },
  { key: "przyjete", label: "Przyjęte" },
  { key: "odrzucone", label: "Odrzucone" },
];

const dt = (s: string | null) => (s ? new Date(s.replace(" ", "T") + "Z").toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) : "");

export default function ModerationPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Status>("nowe");
  const [data, setData] = useState<{ counts: Record<Status, number>; data: Report[] } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    api<{ counts: Record<Status, number>; data: Report[] }>(`/api/moderation/reports?status=${tab}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [tab]);

  useEffect(() => {
    if (user?.is_moderator) load();
  }, [user, load]);

  if (loading) return <div className="p-10 text-center text-muted">Ładowanie…</div>;

  return (
    <>
      <PageHeader eyebrow="Moderacja" title="Zgłoszenia mieszkańców">
        Mieszkańcy zgłaszają w aplikacji, że AED jest zamknięty, uszkodzony albo go nie ma, lub potwierdzają, że jest na miejscu. Przyjęte zgłoszenie od razu
        zmienia dane w wyszukiwarce najbliższych AED.
      </PageHeader>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        {!user && (
          <Alert tone="info" title="Zaloguj się kontem moderatora">
            <Link to="/dysponent" className="underline">Przejdź do logowania</Link>. Uprawnienia moderatora nadaje administrator poleceniem{" "}
            <code>python -m aed.api.moderators add e-mail</code>.
          </Alert>
        )}
        {user && !user.is_moderator && (
          <Alert tone="warn" title="Brak uprawnień moderatora">Konto {user.email} nie może moderować zgłoszeń.</Alert>
        )}
        {user?.is_moderator && (
          <>
            <div role="tablist" aria-label="Status zgłoszeń" className="flex flex-wrap gap-2 border-b border-line">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`-mb-px min-h-[44px] border-b-[3px] px-3 text-sm font-semibold ${tab === t.key ? "border-brand text-brand" : "border-transparent text-ink hover:text-navy"}`}
                >
                  {t.label} {data && <span className="ml-1 text-muted">({fmt.format(data.counts[t.key])})</span>}
                </button>
              ))}
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            {data && data.data.length === 0 && <p className="text-muted">Brak zgłoszeń w tej kategorii.</p>}
            <ul className="space-y-4" aria-live="polite">
              {data?.data.map((r) => <ReportCard key={r.id} r={r} onDone={load} />)}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function ReportCard({ r, onDone }: { r: Report; onDone: () => void }) {
  const [note, setNote] = useState(r.moderator_note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const k = KIND[r.kind] ?? KIND.inne;

  const decide = async (status: Status) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/moderation/reports/${r.id}`, { method: "POST", body: JSON.stringify({ status, note }) });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const mail = r.aed?.kontakt_email
    ? `mailto:${r.aed.kontakt_email}?subject=${encodeURIComponent(`Zgłoszenie dot. AED ${r.aed.id}`)}&body=${encodeURIComponent(
        `Dzień dobry,\n\nmieszkaniec zgłosił w serwisie GdzieAED: ${k.label}${r.comment ? ` – „${r.comment}”` : ""}.\nAED: ${r.aed.nazwa}, ${r.aed.adres}\n\nProsimy o weryfikację.\nZespół GdzieAED`,
      )}`
    : "";

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <span className={`badge ${k.tone}`}>{k.label}</span>
          <h3 className="text-lg font-bold">{r.aed?.nazwa ?? r.aed_id}</h3>
          {r.aed && (
            <p className="text-sm text-muted">
              {[r.aed.adres, r.aed.wojewodztwo].filter(Boolean).join(" · ") || "Brak adresu"}
              {r.aed.lokalizacja_opis && r.aed.lokalizacja_opis !== r.aed.nazwa && <> · {r.aed.lokalizacja_opis}</>}
            </p>
          )}
        </div>
        <p className="text-sm text-muted">Zgłoszono {dt(r.created_at)}</p>
      </div>

      {r.comment && <blockquote className="mt-3 border-l-4 border-line pl-3 text-ink">„{r.comment}”</blockquote>}
      {r.inne_nowe_dla_aed > 0 && (
        <p className="mt-2 text-sm font-semibold text-warn">Dla tego AED czeka jeszcze {r.inne_nowe_dla_aed} innych zgłoszeń.</p>
      )}

      {r.aed && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a className="inline-flex items-center gap-1 text-navy underline" href={`/?aed=${r.aed.id}`} target="_blank" rel="noreferrer">
            <MapPin className="h-4 w-4" aria-hidden /> Pokaż na mapie
          </a>
          {r.aed.osm_id && (
            <a className="inline-flex items-center gap-1 text-navy underline" href={`https://www.openstreetmap.org/${r.aed.osm_id}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden /> OpenStreetMap
            </a>
          )}
          <span className="text-muted">
            Dysponent: {r.aed.dysponent_nazwa || "nieznany"}
            {r.aed.kontakt_telefon && ` · tel. ${r.aed.kontakt_telefon}`}
          </span>
          {mail && (
            <a className="inline-flex items-center gap-1 text-navy underline" href={mail}>
              <Mail className="h-4 w-4" aria-hidden /> Napisz do dysponenta
            </a>
          )}
        </div>
      )}

      {r.status === "nowe" ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <p className="text-sm text-muted">{k.effect}</p>
          <div>
            <label htmlFor={`note-${r.id}`} className="label">Notatka moderatora (opcjonalnie)</label>
            <input id={`note-${r.id}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={() => decide("przyjete")}>
              <Check className="h-4 w-4" aria-hidden /> Przyjmij
            </button>
            <button className="btn btn-outline" disabled={busy} onClick={() => decide("odrzucone")}>
              <X className="h-4 w-4" aria-hidden /> Odrzuć
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm text-muted">
          <span>
            {r.status === "przyjete" ? "Przyjęte" : "Odrzucone"} {dt(r.moderated_at)}
            {r.moderated_by && ` przez ${r.moderated_by}`}
            {r.moderator_note && ` · „${r.moderator_note}”`}
          </span>
          <button className="btn btn-ghost" disabled={busy} onClick={() => decide("nowe")}>Przywróć do sprawdzenia</button>
        </div>
      )}
    </li>
  );
}
