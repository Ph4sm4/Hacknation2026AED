import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/ui";
import { api } from "../lib/api";

type SField = {
  name: string;
  group: string;
  label: string;
  description: string;
  type: string;
  required: "O" | "Z" | "F";
  example: unknown;
  osm: string;
  enum: string | null;
  constraints: Record<string, unknown>;
};
type Schema = {
  version: string;
  title: string;
  description: string;
  publishing_rules: string[];
  groups: { key: string; label: string }[];
  enums: Record<string, { value: string; label?: string }[]>;
  fields: SField[];
};

const REQ = {
  O: { label: "obowiązkowe", cls: "bg-brand text-white" },
  Z: { label: "zalecane", cls: "bg-navy text-white" },
  F: { label: "fakultatywne", cls: "bg-surface text-muted ring-1 ring-line" },
};
const TYPE: Record<string, string> = { string: "tekst", number: "liczba", integer: "liczba całk.", boolean: "tak/nie", date: "data", datetime: "data i czas" };

export default function StandardPage() {
  const [s, setS] = useState<Schema | null>(null);
  const [only, setOnly] = useState<"all" | "O">("all");
  useEffect(() => {
    api<Schema>("/api/schema").then(setS);
  }, []);
  const counts = useMemo(() => (s ? { O: s.fields.filter((f) => f.required === "O").length, all: s.fields.length } : null), [s]);

  return (
    <>
      <PageHeader eyebrow={`Wzorcowy zakres danych · wersja ${s?.version ?? "…"}`} title="Jeden standard danych o AED dla całej Polski">
        Każdy dysponent – gmina, szpital, szkoła, przewoźnik czy firma – udostępnia dane w tym samym układzie. Dzięki temu zbiory z setek instytucji łączą się
        automatycznie w jeden ogólnopolski rejestr w dane.gov.pl.
      </PageHeader>
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-10">
        <section aria-labelledby="h-files" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <h2 id="h-files" className="sr-only">Pliki do pobrania</h2>
          <FileLink href="/api/schema/xlsx" Icon={FileSpreadsheet} title="Wzorcowy zakres (XLSX)" sub="opis pól, słowniki, przykład, szablon z listami" primary />
          <FileLink href="/api/schema/szablon.csv" Icon={FileText} title="Pusty szablon CSV" sub="UTF-8, nagłówki zgodne ze standardem" />
          <FileLink href="/api/schema/tableschema.json" Icon={FileJson} title="Table Schema (JSON)" sub="Frictionless – do automatycznej walidacji" />
          <FileLink href="/api/schema/aed.schema.json" Icon={FileJson} title="JSON Schema" sub="dla API i integracji systemów" />
        </section>

        {s && (
          <section aria-labelledby="h-rules" className="card border-l-4 border-l-navy p-6">
            <h2 id="h-rules" className="text-lg font-bold">Zasady publikacji</h2>
            <ol className="mt-3 grid list-decimal gap-x-10 gap-y-2 pl-5 text-sm text-ink marker:font-bold marker:text-navy md:grid-cols-2">
              {s.publishing_rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </section>
        )}

        {s && counts && (
          <section aria-labelledby="h-fields">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="h-fields" className="h-section">Pola rekordu</h2>
                <p className="mt-1 text-muted">
                  {counts.all} pól, w tym {counts.O} obowiązkowych. Jeden wiersz = jedno urządzenie.
                </p>
              </div>
              <div className="flex rounded border border-line p-0.5" role="group" aria-label="Filtr wymagalności">
                {(["all", "O"] as const).map((v) => (
                  <button key={v} onClick={() => setOnly(v)} aria-pressed={only === v} className={`rounded-sm px-3 py-1.5 text-sm font-semibold ${only === v ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
                    {v === "all" ? "Wszystkie" : "Tylko obowiązkowe"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 space-y-6">
              {s.groups.map((g) => {
                const fields = s.fields.filter((f) => f.group === g.key && (only === "all" || f.required === "O"));
                if (!fields.length) return null;
                return (
                  <div key={g.key} className="overflow-x-auto rounded border border-line">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <caption className="border-b border-line bg-surface px-4 py-2.5 text-left text-sm font-bold text-navy">{g.label}</caption>
                      <thead className="text-xs uppercase tracking-wide text-muted">
                        <tr className="border-b border-line">
                          <th scope="col" className="w-56 px-4 py-2">Nazwa pola</th>
                          <th scope="col" className="px-4 py-2">Opis</th>
                          <th scope="col" className="w-28 px-4 py-2">Typ</th>
                          <th scope="col" className="w-32 px-4 py-2">Wymagalność</th>
                          <th scope="col" className="w-48 px-4 py-2">Przykład</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {fields.map((f) => (
                          <tr key={f.name} className="align-top">
                            <th scope="row" className="px-4 py-2.5 font-normal">
                              <code className="font-mono text-[13px] font-semibold text-ink">{f.name}</code>
                              <p className="text-xs text-muted">{f.label}</p>
                            </th>
                            <td className="px-4 py-2.5 text-ink">
                              {f.description}
                              {f.enum && (
                                <p className="mt-1 text-xs text-muted">
                                  Słownik: {s.enums[f.enum].map((e) => <code key={e.value} className="mr-1 rounded-sm bg-surface px-1 font-mono">{e.value}</code>)}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-muted">{TYPE[f.type]}</td>
                            <td className="px-4 py-2.5"><span className={`badge ${REQ[f.required].cls}`}>{REQ[f.required].label}</span></td>
                            <td className="break-words px-4 py-2.5 font-mono text-xs text-muted">{String(f.example ?? "")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function FileLink({ href, Icon, title, sub, primary }: { href: string; Icon: typeof FileJson; title: string; sub: string; primary?: boolean }) {
  return (
    <a href={href} className={`card group flex items-start gap-3 p-4 hover:border-navy ${primary ? "border-t-4 border-t-brand" : ""}`} download>
      <Icon className={`h-8 w-8 shrink-0 ${primary ? "text-brand" : "text-navy"}`} aria-hidden />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-bold text-ink group-hover:text-navy">
          {title} <Download className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
    </a>
  );
}
