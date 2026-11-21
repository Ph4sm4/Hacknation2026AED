import { Eye, EyeOff, AlertTriangle, CheckCircle2, Clock, Info, XCircle } from "lucide-react";
import { Children, Fragment, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

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

/**
 * Key figure, no tile: a large number with a plain-language label under it.
 * Numbers are black; only the one figure a section wants to stress is red ("brand").
 * ok / warn stay available for status figures (e.g. a validation report).
 */
export function Stat({ label, value, sub, tone = "ink" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ink" | "brand" | "navy" | "ok" | "warn" }) {
  const color = { ink: "text-ink", brand: "text-brand", navy: "text-ink", ok: "text-ok", warn: "text-warn" }[tone];
  return (
    <div>
      <p className={`text-5xl font-extrabold leading-none tracking-[-0.045em] tabular-nums sm:text-6xl ${color}`}>{value}</p>
      <p className="mt-3 text-[15px] font-semibold leading-snug text-ink">{label}</p>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
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
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-2xl p-4 text-sm ${map.cls}`}>
      <map.Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-bold">{title}</p>}
        {children && <div className="text-ink/90">{children}</div>}
      </div>
    </div>
  );
}

export type TagTone = "ok" | "muted" | "ink" | "brand" | "navy" | "warn";
const TAG_TEXT: Record<TagTone, string> = { ok: "text-ok", muted: "text-muted", ink: "text-ink", brand: "text-brand", navy: "text-navy", warn: "text-warn" };

/** Metadata: optional small icon + plain text. No dots, no boxes; colour only when it carries meaning. */
export function Tag({ tone = "muted", icon, strong = false, children }: { tone?: TagTone; icon?: ReactNode; strong?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] leading-5 ${strong ? "font-semibold" : "font-normal"} ${TAG_TEXT[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

/** A line of metadata items separated by space only. */
export function MetaRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <span className={`flex flex-wrap items-center gap-x-3.5 gap-y-1 ${className}`}>
      {items.map((c, i) => (
        <Fragment key={i}>{c}</Fragment>
      ))}
    </span>
  );
}

export function OpenBadge({ open, h24 }: { open?: boolean | null; h24?: boolean }) {
  const icon = <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  if (h24) return <Tag tone="ok" strong icon={icon}>Całodobowo 24/7</Tag>;
  if (open === true) return <Tag tone="ok" strong icon={icon}>Dostępny teraz</Tag>;
  if (open === false) return <Tag tone="ink" strong icon={icon}>Teraz niedostępny</Tag>;
  return <Tag icon={icon}>Godziny nieznane</Tag>;
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

/** Page opener: label, headline, lead – no rules, spacing does the separation. */
export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 pb-6 pt-12 sm:pt-16">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="h-display mt-4 max-w-4xl">{title}</h1>
        {children && <div className="lead mt-5 max-w-3xl">{children}</div>}
      </div>
    </div>
  );
}
