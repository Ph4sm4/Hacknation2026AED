import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const DURATION = 220; // ms – keep in sync with duration-[220ms] below

/**
 * Shared modal: fades the backdrop, slides the sheet up on phones and scales it in on larger screens.
 * Stays mounted while the exit transition runs, so callers only toggle `open`.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  className = "sm:max-w-lg",
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  if (open && !mounted) setMounted(true);

  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // enter on the frame after mount; unmount once the exit transition has played
  useEffect(() => {
    if (!mounted) return;
    if (open) {
      let id = requestAnimationFrame(() => {
        id = requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(id);
    }
    const t = setTimeout(() => {
      setMounted(false);
      setEntered(false);
    }, DURATION);
    return () => clearTimeout(t);
  }, [open, mounted]);

  // focus, Escape and scroll lock while open
  useEffect(() => {
    if (!open || !mounted) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, [open, mounted]);

  if (!mounted) return null;
  const shown = open && entered;

  return createPortal(
    <div
      className={`fixed inset-0 z-[2000] flex items-end justify-center bg-ink/50 transition-opacity duration-[220ms] ease-out motion-reduce:transition-none sm:items-center sm:p-4 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-lg border border-ink/20 bg-white p-5 shadow-[0_24px_48px_-24px_rgb(11_11_12/0.5)] transition-[translate,scale,opacity] duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:rounded-lg ${
          shown ? "translate-y-0 opacity-100 sm:scale-100" : "translate-y-full opacity-0 sm:translate-y-3 sm:scale-[0.97]"
        } ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Small, borderless close button for modal headers. */
export function ModalClose({ onClick, label = "Zamknij" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      data-autofocus
      onClick={onClick}
      aria-label={label}
      className="-mr-1.5 -mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-sm text-muted transition-colors hover:bg-surface hover:text-ink"
    >
      <X className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
    </button>
  );
}
