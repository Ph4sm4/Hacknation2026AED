// Copy of frontend/src/lib/aedGuide.ts – keep both in sync.
/**
 * How to use an AED – 5 short steps with pictograms (ERC 2021 basic life support sequence).
 * Plain data, no imports: the same file is copied to the mobile app (mobile/lib/aed/guide.ts).
 * Pictograms are static SVG markup (viewBox 120×120, ink + medical red).
 */

const INK = "#0B0B0C";
const RED = "#C8102E";
const MUTED = "#A3A7AE";

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** front view of a chest: head, neck, shoulders, collarbones */
const TORSO = `
  <circle cx="60" cy="19" r="10" stroke="${INK}" stroke-width="3.5"/>
  <path d="M54 29v5M66 29v5" stroke="${INK}" stroke-width="3.5"/>
  <path d="M52 34c-14 1-26 5-30 16l-6 52q6.5 5 13 0l4-32v48M68 34c14 1 26 5 30 16l6 52q-6.5 5-13 0l-4-32v48" stroke="${INK}" stroke-width="3.5"/>
  <path d="M40 45q10 4 18 1M62 46q8 3 18-1" stroke="${MUTED}" stroke-width="2.5"/>`;

export type GuideStep = { title: string; text: string; svg: string };

export const GUIDE_INTRO = "Najpierw zadzwoń 112 i uciskaj klatkę piersiową. Poproś kogoś, żeby przyniósł AED.";

export const GUIDE_NOTE = "AED nie wykona wyładowania, jeśli nie jest potrzebne. Nie bój się go użyć – nie zrobisz nim krzywdy.";

export const GUIDE_STEPS: GuideStep[] = [
  {
    title: "Włącz AED",
    text: "Otwórz pokrywę lub naciśnij przycisk zasilania. Urządzenie powie, co robić krok po kroku.",
    svg: svg(`
      <path d="M44 30v-6a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v6" stroke="${INK}" stroke-width="3.5"/>
      <rect x="12" y="30" width="82" height="66" rx="12" stroke="${INK}" stroke-width="3.5"/>
      <path fill="${RED}" d="M42 78c-12-8-18-15-18-22 0-5.5 4-9 8.5-9 4 0 7.5 2.5 9.5 6 2-3.5 5.5-6 9.5-6 4.5 0 8.5 3.5 8.5 9 0 7-6 14-18 22z"/>
      <path fill="#fff" d="M44 52l-7 11h5l-2 9 7-12h-5z"/>
      <circle cx="76" cy="76" r="9" fill="${RED}"/>
      <path d="M76 70v6M71.6 72.5a6.2 6.2 0 1 0 8.8 0" stroke="#fff" stroke-width="2.5"/>
      <path d="M101 52a14 14 0 0 1 0 22M108 45a22 22 0 0 1 0 36" stroke="${RED}" stroke-width="3.5"/>`),
  },
  {
    title: "Naklej elektrody",
    text: "Odsłoń klatkę piersiową. Jedna elektroda pod prawym obojczykiem, druga na lewym boku, pod pachą.",
    svg: svg(`${TORSO}
      <path d="M47 64c0 24 10 36 13 54M83 96c-2 10-14 14-21 22" stroke="${MUTED}" stroke-width="2"/>
      <rect x="35" y="50" width="22" height="15" rx="4" fill="${RED}"/>
      <rect x="74" y="70" width="17" height="25" rx="4" fill="${RED}" transform="rotate(-12 82.5 82.5)"/>`),
  },
  {
    title: "Nie dotykaj",
    text: "AED analizuje rytm serca. Nikt nie może wtedy dotykać poszkodowanego.",
    svg: svg(`
      <path d="M8 30h24l6-10 7 20 7-28 6 22 5-4h49" stroke="${RED}" stroke-width="3.5"/>
      <g fill="${INK}">
        <rect x="45" y="68" width="32" height="32" rx="10"/>
        <rect x="45" y="55" width="7" height="24" rx="3.5"/>
        <rect x="53.5" y="50" width="7" height="28" rx="3.5"/>
        <rect x="62" y="52" width="7" height="26" rx="3.5"/>
        <rect x="70.5" y="58" width="6.5" height="20" rx="3.25"/>
        <rect x="36" y="72" width="7" height="22" rx="3.5" transform="rotate(-38 39.5 83)"/>
      </g>
      <circle cx="60" cy="78" r="31" stroke="${RED}" stroke-width="5"/>
      <path d="M38 56l44 44" stroke="${RED}" stroke-width="5"/>`),
  },
  {
    title: "Wyładowanie",
    text: "Jeśli AED każe, sprawdź, że nikt nie dotyka chorego, i naciśnij migający przycisk.",
    svg: svg(`
      <circle cx="60" cy="64" r="40" stroke="${INK}" stroke-width="3.5"/>
      <circle cx="60" cy="64" r="30" fill="${RED}"/>
      <path fill="#fff" d="M65 40L48 68h11l-4 22 18-32H62z"/>
      <path d="M27.5 31.5l-6-6M92.5 31.5l6-6M27.5 96.5l-6 6M92.5 96.5l6 6" stroke="${RED}" stroke-width="3.5"/>`),
  },
  {
    title: "Uciskaj dalej",
    text: "Od razu wróć do RKO: 30 uciśnięć, 2 oddechy. Nie odklejaj elektrod, słuchaj poleceń AED.",
    svg: svg(`${TORSO}
      <path d="M60 46v16M52 55l8 8 8-8" stroke="${RED}" stroke-width="4"/>
      <ellipse cx="60" cy="78" rx="16" ry="8" fill="${INK}"/>
      <ellipse cx="60" cy="74" rx="13" ry="7" fill="${INK}" stroke="#fff" stroke-width="2.5"/>
      <text x="60" y="108" text-anchor="middle" font-size="15" font-weight="800" fill="${RED}">30 : 2</text>`),
  },
];
