import { Eye, EyeOff, AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

/** Password input with a visibility (eye) toggle – required by the UX guidelines. */
export function PasswordInput({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          className={`input pr-12 ${error ? "border-brand" : ""}`}
          aria-describedby={hint || error ? hintId : undefined}
          aria-invalid={!!error || undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r text-muted hover:text-navy focus-visible:outline-offset-[-3px]"
          aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      {(hint || error) && (
        <p id={hintId} className={`mt-1.5 text-xs ${error ? "font-semibold text-brand" : "text-muted"}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {props.required && <span className="ml-0.5 text-brand" aria-hidden>*</span>}
      </label>
      <input {...props} id={id} className="input" aria-describedby={hint ? `${id}-h` : undefined} />
      {hint && (
        <p id={`${id}-h`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Swiss figure: a rule on top, small caps label, oversized number. Brand tone = red rule + red number. */
export function Stat({ label, value, sub, tone = "ink" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ink" | "brand" | "navy" | "ok" | "warn" }) {
  const color = { ink: "text-ink", brand: "text-brand", navy: "text-navy", ok: "text-ok", warn: "text-warn" }[tone];
  const rule = tone === "brand" ? "border-brand" : "border-ink";
  return (
    <div className={`border-t-2 ${rule} pt-3`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`mt-2 text-4xl font-black leading-none tracking-[-0.04em] tabular-nums sm:text-5xl ${color}`}>{value}</p>
      {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "ok" | "warn" | "error"; title?: string; children?: ReactNode }) {
  const map = {
    info: { cls: "border-navy bg-navy-soft text-navy-dark", Icon: Info },
    ok: { cls: "border-ok bg-ok-soft text-ok", Icon: CheckCircle2 },
    warn: { cls: "border-warn bg-warn-soft text-warn", Icon: AlertTriangle },
    error: { cls: "border-brand bg-brand-soft text-brand-dark", Icon: XCircle },
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-sm border-l-4 p-4 text-sm ${map.cls}`}>
      <map.Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-bold">{title}</p>}
        {children && <div className="text-ink/90">{children}</div>}
      </div>
    </div>
  );
}

export function OpenBadge({ open, h24 }: { open?: boolean | null; h24?: boolean }) {
  if (h24) return <span className="badge bg-ok text-white">24/7</span>;
  if (open === true) return <span className="badge bg-ok-soft text-ok">Dostępny teraz</span>;
  if (open === false) return <span className="badge bg-ink text-white">Teraz niedostępny</span>;
  return <span className="badge text-muted ring-1 ring-inset ring-ink/20">Godziny nieznane</span>;
}

export function QualityBar({ value }: { value: number }) {
  const tone = value >= 70 ? "bg-ok" : value >= 45 ? "bg-warn" : "bg-brand";
  return (
    <div className="flex items-center gap-2" title={`Wskaźnik jakości danych: ${value}/100`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-sm bg-line" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Wskaźnik jakości danych">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-muted">{value}/100</span>
    </div>
  );
}

/** Swiss page opener: label in the narrow column, display headline + lead on the wide one, heavy rule below. */
export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="border-b-2 border-ink bg-white">
      <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-4 px-4 pb-12 pt-10 sm:pb-16 sm:pt-14 lg:grid-cols-12">
        <div className="lg:col-span-3 lg:pt-3">
          <p className="eyebrow">{eyebrow}</p>
        </div>
        <div className="lg:col-span-9">
          <h1 className="h-display">{title}</h1>
          {children && <div className="lead mt-6 max-w-3xl">{children}</div>}
        </div>
      </div>
    </div>
  );
}
