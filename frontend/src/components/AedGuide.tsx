import { Phone, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { GUIDE_INTRO, GUIDE_NOTE, GUIDE_STEPS } from "../lib/aedGuide";

/** The 5 steps as picture cards. `dense` = single column (dialog), otherwise a responsive grid. */
export function AedGuideSteps({ dense = false }: { dense?: boolean }) {
  return (
    <ol className={dense ? "grid gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-5"}>
      {GUIDE_STEPS.map((s, i) => (
        <li key={s.title} className={`rounded-2xl bg-surface ${dense ? "flex items-center gap-4 p-3" : "p-4"}`}>
          {/* static, trusted markup from lib/aedGuide.ts */}
          <div
            aria-hidden
            className={`shrink-0 rounded-xl bg-white ${dense ? "h-[88px] w-[88px] p-1.5" : "mx-auto aspect-square w-full max-w-[180px] p-3"}`}
            dangerouslySetInnerHTML={{ __html: s.svg }}
          />
          <div className={dense ? "min-w-0" : "mt-3"}>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">Krok {i + 1}</p>
            <h3 className="mt-0.5 text-[17px] font-extrabold leading-snug tracking-[-0.01em]">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function GuideIntro() {
  return (
    <p className="flex items-start gap-2.5 rounded-2xl bg-brand-soft p-4 text-[15px] font-medium leading-relaxed text-ink">
      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
      {GUIDE_INTRO}
    </p>
  );
}

export function GuideNote() {
  return <p className="text-sm leading-relaxed text-muted">{GUIDE_NOTE}</p>;
}

/** Same instruction over the map – keeps the selected AED and route in place. */
export function AedGuideDialog({ onClose }: { onClose: () => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aed-guide-title"
        className="max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="aed-guide-title" className="text-2xl font-extrabold tracking-[-0.02em]">
            Jak użyć AED
          </h2>
          <button ref={closeBtn} onClick={onClose} className="btn btn-outline h-10 min-h-0 w-10 shrink-0 p-0" aria-label="Zamknij instrukcję">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <GuideIntro />
          <AedGuideSteps dense />
          <GuideNote />
        </div>
      </div>
    </div>,
    document.body,
  );
}
