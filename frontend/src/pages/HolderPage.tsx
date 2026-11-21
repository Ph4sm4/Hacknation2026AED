import { ArrowRight, CheckCircle2, Download, FileUp, Loader2, Search, Send, UploadCloud, Wand2, XCircle, AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Alert, PageHeader, PasswordInput, Stat, TextField } from "../components/ui";
import { ApiError, api, displayName, fmt, type AED } from "../lib/api";
import { useAuth } from "../lib/auth";

type Issue = { row: number; field: string; level: "error" | "warning" | "fix"; message: string; value: string };
type Validation = {
  token: string;
  summary: { rows: number; valid_rows: number; invalid_rows: number; errors: number; warnings: number; fixes: number; mapped_columns: number; unmapped_columns: string[]; conformity: number };
  detected: Record<string, string | number | boolean>;
  mapping: { source: string; target: string | null; method: string }[];
  issues: Issue[];
  records: Record<string, string | number>[];
};
type Submission = { id: number; title: string; license: string; update_frequency: string; records: number; conformity: number; status: string; created_at: string };

export default function HolderPage() {
  const { user, loading } = useAuth();
  return (
    <>
      <PageHeader eyebrow="Portal dysponenta" title="Udostępnij dane o swoich defibrylatorach">
        Wgraj plik, który już masz – Excel, CSV albo JSON. Sprawdzimy go względem wzorcowego zakresu danych, poprawimy typowe błędy i przygotujemy zasób gotowy do
        automatycznej publikacji w dane.gov.pl.
      </PageHeader>
      <div className="mx-auto max-w-7xl px-4 py-10">
        {loading ? null : user ? <Dashboard /> : <AuthPanel />}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ auth */
function AuthPanel() {
  const [mode, setMode] = useState<"login" | "register">("login");
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_440px]">
      <div className="order-2 lg:order-1">
        <h2 className="h-section">Jak to działa?</h2>
        <ol className="mt-6 space-y-5">
          {[
            ["Wgraj plik", "Dowolny układ kolumn – rozpoznajemy nazwy, kodowanie i separator. Nie musisz niczego przepisywać."],
            ["Sprawdź raport", "Widzisz każdy błąd i ostrzeżenie z numerem wiersza. Typowe pomyłki (np. zamienione współrzędne, formaty dat) poprawiamy automatycznie."],
            ["Uzupełnij braki", "Wartości wspólne dla wszystkich urządzeń (np. dysponent, dostępność) ustawisz raz dla całego pliku."],
            ["Opublikuj", "Dostajesz stały adres zasobu CSV i plik XML harwestera – wklejasz go w dane.gov.pl, a portal sam pobiera aktualizacje."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-navy text-base font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-bold">{t}</p>
                <p className="text-sm text-muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <Alert tone="info" title="Możesz sprawdzić plik bez zakładania konta">
            Konto jest potrzebne dopiero do publikacji – wiąże dane z Twoją instytucją (nazwa, REGON).
          </Alert>
        </div>
        <div className="mt-6">
          <Validator />
        </div>
      </div>

      <div className="order-1 lg:order-2">
        <div className="card sticky top-24 overflow-hidden">
          <div className="grid grid-cols-2 border-b border-line" role="tablist" aria-label="Konto dysponenta">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`py-3.5 text-sm font-bold ${mode === m ? "border-b-[3px] border-brand text-brand" : "bg-surface text-muted hover:text-ink"}`}
              >
                {m === "login" ? "Logowanie" : "Załóż konto"}
              </button>
            ))}
          </div>
          <div className="p-6">{mode === "login" ? <LoginForm /> : <RegisterForm />}</div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email, password);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Błąd logowania");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h2 className="text-lg font-bold">Zaloguj się jako dysponent</h2>
      {err && <Alert tone="error">{err}</Alert>}
      <TextField label="E-mail służbowy" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <PasswordInput label="Hasło" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Zaloguj
      </button>
    </form>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const [f, setF] = useState({ email: "", organization: "", regon: "", password: "", password2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const pwShort = f.password.length > 0 && f.password.length < 8;
  const mismatch = f.password2.length > 0 && f.password !== f.password2;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pwShort || mismatch) return;
    setErr("");
    setBusy(true);
    try {
      await register({ email: f.email, password: f.password, organization: f.organization, regon: f.regon });
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Nie udało się założyć konta");
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h2 className="text-lg font-bold">Konto instytucji</h2>
      {err && <Alert tone="error">{err}</Alert>}
      <TextField label="Nazwa instytucji (dysponent)" required value={f.organization} onChange={set("organization")} placeholder="np. Gmina Miasto Legionowo" />
      <TextField label="REGON" inputMode="numeric" value={f.regon} onChange={set("regon")} hint="9 lub 14 cyfr – opcjonalnie" pattern="[0-9]*" />
      <TextField label="E-mail służbowy" type="email" autoComplete="email" required value={f.email} onChange={set("email")} />
      <PasswordInput label="Hasło" autoComplete="new-password" required value={f.password} onChange={set("password")} hint="Minimum 8 znaków" error={pwShort ? "Hasło musi mieć co najmniej 8 znaków" : undefined} />
      <PasswordInput label="Powtórz hasło" autoComplete="new-password" required value={f.password2} onChange={set("password2")} error={mismatch ? "Hasła nie są identyczne" : undefined} />
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Załóż konto
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ dashboard */
function Dashboard() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Submission[]>([]);
  const load = useCallback(() => api<{ data: Submission[] }>("/api/holder/submissions").then((r) => setSubs(r.data)), []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Zalogowano jako</p>
          <h2 className="text-2xl font-extrabold">{user!.organization}</h2>
          <p className="text-sm text-muted">
            {user!.email}
            {user!.regon && ` · REGON ${user!.regon}`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-[360px]">
          <Stat label="Zbiory" value={subs.length} tone="navy" />
          <Stat label="Rekordy AED" value={fmt.format(subs.reduce((a, s) => a + s.records, 0))} tone="brand" />
        </div>
      </div>
      <Validator onPublished={load} />
      <Submissions subs={subs} />
      <Claim />
    </div>
  );
}

function Submissions({ subs }: { subs: Submission[] }) {
  const origin = window.location.origin;
  if (!subs.length) return null;
  return (
    <section aria-labelledby="h-subs">
      <h2 id="h-subs" className="h-section">Twoje zbiory w dane.gov.pl</h2>
      <div className="mt-4 overflow-x-auto rounded border border-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Zbiór</th>
              <th scope="col" className="px-4 py-3 text-right">Rekordy</th>
              <th scope="col" className="px-4 py-3">Zgodność</th>
              <th scope="col" className="px-4 py-3">Adresy do dane.gov.pl</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {subs.map((s) => (
              <tr key={s.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-xs text-muted">
                    {s.license} · aktualizacja: {s.update_frequency} · {s.created_at.slice(0, 10)}
                  </p>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{s.records}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${s.conformity === 100 ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>{s.conformity}%</span>
                </td>
                <td className="space-y-1 px-4 py-3 font-mono text-xs">
                  <a className="block truncate text-navy hover:underline" href={`/api/holder/submissions/${s.id}/data.csv`}>{`${origin}/api/holder/submissions/${s.id}/data.csv`}</a>
                  <a className="block truncate text-navy hover:underline" href={`/api/holder/submissions/${s.id}/harvester.xml`}>{`${origin}/api/holder/submissions/${s.id}/harvester.xml`}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Claim() {
  const { user } = useAuth();
  const [q, setQ] = useState(user?.organization.split(" ").slice(-1)[0] ?? "");
  const [res, setRes] = useState<{ total: number; data: AED[] } | null>(null);
  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setRes(await api(`/api/holder/claim?q=${encodeURIComponent(q.trim())}`));
  };
  return (
    <section aria-labelledby="h-claim" className="card p-6">
      <h2 id="h-claim" className="text-xl font-bold">Znajdź swoje AED w danych społecznościowych</h2>
      <p className="mt-1 text-sm text-muted">
        Twoje urządzenia mogą już być na mapie dzięki wolontariuszom OpenStreetMap. Potwierdź je i uzupełnij w swoim pliku – staną się danymi oficjalnymi.
      </p>
      <form onSubmit={run} className="mt-4 flex gap-2" role="search">
        <label htmlFor="claim-q" className="sr-only">Nazwa dysponenta, miejscowość lub obiekt</label>
        <input id="claim-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="np. nazwa gminy, szkoły, miejscowość" />
        <button className="btn btn-navy">
          <Search className="h-4 w-4" aria-hidden /> Szukaj
        </button>
      </form>
      {res && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Znaleziono: {res.total}</p>
          <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded border border-line text-sm">
            {res.data.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2">
                <span>
                  <span className="font-semibold">{displayName(a)}</span>
                  <span className="block text-xs text-muted">{[a.dysponent_nazwa, a.lokalizacja_opis].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted">{a.osm_id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ validator */
const DEFAULTABLE: [string, string, string[] | null][] = [
  ["dysponent_nazwa", "Dysponent", null],
  ["dostepnosc", "Dostępność", ["publiczny", "ograniczony", "prywatny"]],
  ["godziny_dostepnosci", "Godziny dostępności", null],
  ["status", "Status", ["aktywny", "serwis", "nieaktywny", "wycofany"]],
  ["data_weryfikacji", "Data weryfikacji", null],
  ["data_aktualizacji", "Data aktualizacji", null],
];

function Validator({ onPublished }: { onPublished?: () => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [res, setRes] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const inp = useRef<HTMLInputElement>(null);

  const run = useCallback(
    async (f: File, d: Record<string, string>) => {
      setBusy(true);
      setErr("");
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("defaults", JSON.stringify(d));
        setRes(await api<Validation>("/api/validate", { method: "POST", body: fd }));
      } catch (x) {
        setErr(x instanceof ApiError ? x.message : "Błąd walidacji");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const choose = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setRes(null);
    run(f, defaults);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    choose(e.dataTransfer.files[0]);
  };

  return (
    <section aria-labelledby="h-val" className="space-y-6">
      <div>
        <h2 id="h-val" className="h-section">Sprawdź plik z danymi</h2>
        <p className="mt-1 text-muted">CSV (dowolne kodowanie i separator), XLSX, JSON lub GeoJSON · do 10 MB</p>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded border-2 border-dashed px-6 py-10 text-center transition-colors ${drag ? "border-navy bg-navy-soft" : "border-line bg-surface"}`}
      >
        <UploadCloud className="h-10 w-10 text-navy" aria-hidden />
        <p className="font-semibold">{file ? file.name : "Przeciągnij plik tutaj"}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button className="btn btn-navy" onClick={() => inp.current?.click()} type="button">
            <FileUp className="h-4 w-4" aria-hidden /> Wybierz plik
          </button>
          <a href="/api/schema/przyklad.csv" className="btn btn-outline" download>
            Przykładowy plik
          </a>
        </div>
        <input ref={inp} type="file" className="sr-only" accept=".csv,.txt,.xlsx,.json,.geojson" onChange={(e) => choose(e.target.files?.[0])} aria-label="Plik z danymi AED" />
      </div>
      {busy && (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sprawdzanie pliku…
        </p>
      )}
      {err && <Alert tone="error">{err}</Alert>}
      {res && file && (
        <Report
          res={res}
          defaults={defaults}
          setDefaults={setDefaults}
          rerun={() => run(file, defaults)}
          canPublish={!!user}
          defaultTitle={user ? `Defibrylatory AED – ${user.organization}` : ""}
          onPublished={onPublished}
        />
      )}
    </section>
  );
}

function Report({
  res,
  defaults,
  setDefaults,
  rerun,
  canPublish,
  defaultTitle,
  onPublished,
}: {
  res: Validation;
  defaults: Record<string, string>;
  setDefaults: (d: Record<string, string>) => void;
  rerun: () => void;
  canPublish: boolean;
  defaultTitle: string;
  onPublished?: () => void;
}) {
  const s = res.summary;
  const fileLevel = res.issues.filter((i) => i.row === 0);
  const rowIssues = res.issues.filter((i) => i.row > 0);
  const [levelFilter, setLevelFilter] = useState<"all" | "error" | "warning" | "fix">("all");
  const missingCols = fileLevel.filter((i) => i.level === "error").map((i) => i.field);
  const shown = rowIssues.filter((i) => levelFilter === "all" || i.level === levelFilter).slice(0, 200);
  const ok = s.valid_rows === s.rows && s.rows > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Zgodność" value={`${s.conformity}%`} tone={ok ? "ok" : s.conformity > 0 ? "warn" : "brand"} sub={`${s.valid_rows} z ${s.rows} wierszy poprawnych`} />
        <Stat label="Błędy" value={s.errors} tone={s.errors ? "brand" : "ok"} />
        <Stat label="Ostrzeżenia" value={s.warnings} tone={s.warnings ? "warn" : "ok"} />
        <Stat label="Auto-poprawki" value={s.fixes} tone="navy" />
        <Stat label="Kolumny" value={`${s.mapped_columns}/${res.mapping.length}`} sub="rozpoznane" />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(res.detected)
          .filter(([k]) => ["format", "encoding", "separator", "sheet"].includes(k))
          .map(([k, v]) => (
            <span key={k} className="badge bg-surface text-muted ring-1 ring-line">
              {k}: {String(v)}
            </span>
          ))}
      </div>

      {fileLevel.filter((i) => i.level !== "error").map((i) => (
        <Alert key={i.message} tone={i.level === "fix" ? "info" : "warn"}>{i.message}</Alert>
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="flex items-center gap-2 font-bold">
            <Wand2 className="h-4 w-4 text-navy" aria-hidden /> Mapowanie kolumn
          </h3>
          <ul className="mt-3 divide-y divide-line text-sm">
            {res.mapping.map((m) => (
              <li key={m.source} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate">{m.source}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                <code className={`min-w-0 flex-1 truncate font-mono text-xs ${m.target ? "text-navy" : "text-muted line-through"}`}>
                  {m.target ? (m.target.startsWith("_") ? "adres → ulica, nr, kod, miejscowość" : m.target) : "pominięta"}
                </code>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="font-bold">Wartości wspólne dla całego pliku</h3>
          <p className="mt-1 text-xs text-muted">Uzupełnij brakujące kolumny obowiązkowe jedną wartością dla wszystkich wierszy.</p>
          {missingCols.length > 0 && (
            <p className="mt-2 text-sm font-semibold text-brand">
              Brakuje kolumn: {missingCols.map((c) => <code key={c} className="mr-1 font-mono text-xs">{c}</code>)}
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {DEFAULTABLE.map(([k, label, opts]) => (
              <div key={k}>
                <label htmlFor={`d-${k}`} className="label text-xs">
                  {label} {missingCols.includes(k) && <span className="text-brand">(brak)</span>}
                </label>
                {opts ? (
                  <select id={`d-${k}`} className="input" value={defaults[k] ?? ""} onChange={(e) => setDefaults({ ...defaults, [k]: e.target.value })}>
                    <option value="">— z pliku —</option>
                    {opts.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`d-${k}`}
                    className="input"
                    type={k.startsWith("data_") ? "date" : "text"}
                    value={defaults[k] ?? ""}
                    placeholder={k === "godziny_dostepnosci" ? "np. 24/7 lub Mo-Fr 08:00-16:00" : ""}
                    onChange={(e) => setDefaults({ ...defaults, [k]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          <button className="btn btn-navy mt-4 w-full" onClick={rerun}>
            Sprawdź ponownie
          </button>
        </div>
      </div>

      {rowIssues.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3">
            <h3 className="font-bold">Szczegóły ({rowIssues.length})</h3>
            <div className="flex gap-1" role="group" aria-label="Filtr poziomu">
              {(["all", "error", "warning", "fix"] as const).map((l) => (
                <button key={l} onClick={() => setLevelFilter(l)} aria-pressed={levelFilter === l} className={`rounded-sm px-2.5 py-1 text-xs font-semibold ${levelFilter === l ? "bg-navy text-white" : "text-muted hover:bg-white"}`}>
                  {{ all: "Wszystkie", error: "Błędy", warning: "Ostrzeżenia", fix: "Poprawki" }[l]}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="px-4 py-2">Wiersz</th>
                  <th scope="col" className="px-4 py-2">Pole</th>
                  <th scope="col" className="px-4 py-2">Komunikat</th>
                  <th scope="col" className="px-4 py-2">Wartość</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((i, n) => (
                  <tr key={n}>
                    <td className="px-4 py-2 tabular-nums">{i.row}</td>
                    <td className="px-4 py-2 font-mono text-xs">{i.field}</td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1.5">
                        {i.level === "error" ? <XCircle className="h-4 w-4 shrink-0 text-brand" aria-label="Błąd" /> : i.level === "warning" ? <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-label="Ostrzeżenie" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-navy" aria-label="Poprawka" />}
                        {i.message}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs text-muted">{i.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <a href={`/api/validate/${res.token}/data.csv`} className="btn btn-outline" download>
          <Download className="h-4 w-4" aria-hidden /> Pobierz plik w wzorcowym zakresie (CSV)
        </a>
        {ok ? <Alert tone="ok">Plik jest w pełni zgodny ze wzorcowym zakresem danych.</Alert> : null}
      </div>

      {canPublish ? <Publish res={res} defaultTitle={defaultTitle} onPublished={onPublished} /> : (
        <Alert tone="info" title="Chcesz opublikować dane?">Zaloguj się lub załóż konto instytucji, aby otrzymać stały adres zasobu i plik XML dla dane.gov.pl.</Alert>
      )}
    </div>
  );
}

function Publish({ res, defaultTitle, onPublished }: { res: Validation; defaultTitle: string; onPublished?: () => void }) {
  const [title, setTitle] = useState(defaultTitle);
  const [license, setLicense] = useState("CC0-1.0");
  const [freq, setFreq] = useState("monthly");
  const [done, setDone] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const r = await api<{ id: number }>("/api/holder/submissions", {
        method: "POST",
        body: JSON.stringify({ upload_token: res.token, title, license, update_frequency: freq }),
      });
      setDone(r.id);
      onPublished?.();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Błąd publikacji");
    }
  };
  if (done)
    return (
      <Alert tone="ok" title="Zbiór przekazany do rejestru ogólnopolskiego">
        Adres XML do zarejestrowania w dane.gov.pl (harwester):{" "}
        <a className="font-mono text-navy underline" href={`/api/holder/submissions/${done}/harvester.xml`}>
          /api/holder/submissions/{done}/harvester.xml
        </a>
      </Alert>
    );
  return (
    <form onSubmit={submit} className="card border-t-4 border-t-brand p-5">
      <h3 className="text-lg font-bold">Publikacja w dane.gov.pl</h3>
      {err && <div className="mt-3"><Alert tone="error">{err}</Alert></div>}
      <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <TextField label="Tytuł zbioru" required minLength={5} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div>
          <label htmlFor="lic" className="label">Licencja</label>
          <select id="lic" className="input" value={license} onChange={(e) => setLicense(e.target.value)}>
            <option value="CC0-1.0">CC0 1.0</option>
            <option value="CC-BY-4.0">CC BY 4.0</option>
          </select>
        </div>
        <div>
          <label htmlFor="freq" className="label">Aktualizacja</label>
          <select id="freq" className="input" value={freq} onChange={(e) => setFreq(e.target.value)}>
            <option value="daily">codziennie</option>
            <option value="weekly">co tydzień</option>
            <option value="monthly">co miesiąc</option>
            <option value="quarterly">co kwartał</option>
            <option value="irregular">nieregularnie</option>
          </select>
        </div>
      </div>
      <button className="btn btn-primary mt-4" disabled={res.summary.valid_rows === 0}>
        <Send className="h-4 w-4" aria-hidden /> Przekaż {res.summary.valid_rows} poprawnych rekordów
      </button>
      {res.summary.valid_rows === 0 && <p className="mt-2 text-xs text-brand">Popraw błędy, aby opublikować dane.</p>}
    </form>
  );
}
