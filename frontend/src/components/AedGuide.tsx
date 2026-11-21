import { Phone } from "lucide-react";
import { useState } from "react";
import { GUIDE_INTRO, GUIDE_NOTE, GUIDE_STEPS } from "../lib/aedGuide";
import { Modal, ModalClose } from "./Modal";

/** time for the rail to travel one step – dots and line segments fill one after another */
const STEP_MS = 120;
const LAST = GUIDE_STEPS.length - 1;

/**
 * Vertical stepper: a rail of numbered dots next to the step cards. Hovering (or tapping) a step
 * fills the rail up to it, segment by segment, and back down when moving to an earlier step.
 */
function GuideStepper() {
  const [{ active, from }, set] = useState({ active: 0, from: 0 });
  const go = (i: number) => set((s) => (s.active === i ? s : { active: i, from: s.active }));
  const forward = active >= from;
  const ms = (n: number) => `${Math.max(0, n) * STEP_MS}ms`;

  return (
    <ol className="grid gap-2">
      {GUIDE_STEPS.map((s, i) => {
        const reached = i <= active;
        const current = i === active;
        return (
          <li key={s.title} className="relative grid grid-cols-[28px_1fr] gap-3" onMouseEnter={() => go(i)} onClick={() => go(i)}>
            {/* rail segment from this dot to the next one (dot centre 30px from the top, 8px list gap) */}
            {i < LAST && (
              <span aria-hidden className="absolute -bottom-[38px] left-[13px] top-[30px] w-[2px] overflow-hidden rounded-full bg-ink/15">
                <span
                  className={`block h-full w-full origin-top bg-brand ease-linear transition-[scale] motion-reduce:transition-none ${i < active ? "scale-y-100" : "scale-y-0"}`}
                  style={{ transitionDuration: `${STEP_MS}ms`, transitionDelay: forward ? ms(i - from) : ms(from - 1 - i) }}
                />
              </span>
            )}
            <span
              aria-hidden
              className={`relative z-10 mt-4 grid h-7 w-7 place-items-center rounded-full border-2 text-xs font-extrabold tabular-nums transition-[background-color,border-color,color,scale,box-shadow] ease-out motion-reduce:transition-none ${
                reached ? "border-brand bg-brand text-white" : "border-ink/25 bg-white text-muted"
              } ${current ? "scale-110 shadow-[0_0_0_4px_var(--color-brand-soft)]" : "scale-100"}`}
              style={{ transitionDuration: `${STEP_MS * 1.5}ms`, transitionDelay: forward ? ms(i - from) : ms(from - i) }}
            >
              {i + 1}
            </span>
            <div
              className={`flex items-center gap-4 rounded-md border p-3 transition-[background-color,border-color,box-shadow] duration-200 ease-out ${
                current ? "border-brand/45 bg-white shadow-[0_6px_18px_-12px_rgb(11_11_12/0.45)]" : "border-ink/15 bg-surface"
              }`}
            >
              {/* static, trusted markup from lib/aedGuide.ts */}
              <div aria-hidden className="h-[88px] w-[88px] shrink-0 rounded-sm border border-ink/10 bg-white p-1.5" dangerouslySetInnerHTML={{ __html: s.svg }} />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">Krok {i + 1}</p>
                <h3 className="mt-0.5 text-[17px] font-extrabold leading-snug tracking-[-0.01em]">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The 5 steps as picture cards. `dense` = stepper with a progress rail (dialog), otherwise a responsive grid. */
export function AedGuideSteps({ dense = false }: { dense?: boolean }) {
  if (dense) return <GuideStepper />;
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {GUIDE_STEPS.map((s, i) => (
        <li key={s.title} id={`krok-${i + 1}`} className="rounded-md border border-ink/15 bg-surface p-4">
          {/* static, trusted markup from lib/aedGuide.ts */}
          <div
            aria-hidden
            className="mx-auto aspect-square w-full max-w-[180px] shrink-0 rounded-sm border border-ink/10 bg-white p-3"
            dangerouslySetInnerHTML={{ __html: s.svg }}
          />
          <div className="mt-3">
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
    <p className="flex items-start gap-2.5 rounded-md border border-brand/25 bg-brand-soft p-4 text-[15px] font-medium leading-relaxed text-ink">
      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
      {GUIDE_INTRO}
    </p>
  );
}

export function GuideNote() {
  return <p className="text-sm leading-relaxed text-muted">{GUIDE_NOTE}</p>;
}

/** Same instruction over the map – keeps the selected AED and route in place. */
export function AedGuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="aed-guide-title" className="sm:max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <h2 id="aed-guide-title" className="text-2xl font-extrabold tracking-[-0.02em]">
          Jak użyć AED
        </h2>
        <ModalClose onClick={onClose} label="Zamknij instrukcję" />
      </div>
      <div className="mt-4 space-y-3">
        <GuideIntro />
        <AedGuideSteps dense />
        <GuideNote />
      </div>
    </Modal>
  );
}
