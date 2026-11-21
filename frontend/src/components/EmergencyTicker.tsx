import { useEffect, useState } from "react";

/** Messages of the red emergency strip – first-aid essentials + the campaign call to action. */
const MESSAGES: [string, string][] = [
  ["Zatrzymanie krążenia?", "Dzwoń 112, uciskaj klatkę piersiową, poproś kogoś o AED."],
  ["Każda minuta się liczy", "Bez pomocy szansa na przeżycie spada o 7–10% z każdą minutą."],
  ["Uciskaj mocno i szybko", "100–120 razy na minutę, na głębokość 5–6 cm, bez przerw."],
  ["AED jest bezpieczny", "Defibrylator sam ocenia rytm serca i mówi, co robić krok po kroku."],
  ["Masz AED?", "Pokaż, gdzie jest – udostępnij dane w portalu dane.gov.pl."],
];

const HOLD_MS = 3800;
const SWITCH_MS = 650;

/**
 * Vertical ticker looping upwards with a snappy "anticipate + overshoot" switch.
 * The list carries a copy of the first message at the end; after sliding onto it we jump back to 0
 * without a transition, so the loop is seamless. Pauses on hover / focus; static under reduced motion.
 */
export function EmergencyTicker() {
  const [i, setI] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(() => {
      setAnimate(true);
      setI((x) => x + 1);
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [i, paused, reduced]);

  // landed on the trailing copy of message 0 → snap back to the real one
  useEffect(() => {
    if (i !== MESSAGES.length) return;
    const t = setTimeout(() => {
      setAnimate(false);
      setI(0);
    }, SWITCH_MS);
    return () => clearTimeout(t);
  }, [i]);

  const items = [...MESSAGES, MESSAGES[0]];
  return (
    <div
      className="relative h-6 min-w-0 flex-1 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* screen readers get the messages once, as a list – the animation is decorative */}
      <ul className="sr-only">
        {MESSAGES.map(([a, b]) => (
          <li key={a}>
            {a} {b}
          </li>
        ))}
      </ul>
      <ul
        aria-hidden
        className="will-change-transform"
        style={{
          transform: `translateY(-${i * 1.5}rem)`,
          transition: animate ? `transform ${SWITCH_MS}ms cubic-bezier(0.68, -0.55, 0.27, 1.55)` : "none",
        }}
      >
        {items.map(([a, b], k) => (
          <li key={k} className="flex h-6 items-center truncate font-medium leading-6 tracking-[-0.01em]">
            <span className="font-extrabold uppercase tracking-[0.06em]">{a}</span>
            <span className="mx-2 hidden opacity-60 sm:inline">/</span>
            <span className="hidden truncate sm:inline">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
