export type AED = {
  id: string;
  id_aed: string;
  nazwa: string;
  szerokosc_geograficzna: number;
  dlugosc_geograficzna: number;
  wojewodztwo: string;
  miejscowosc: string;
  ulica: string;
  nr_budynku: string;
  kod_pocztowy: string;
  lokalizacja_opis: string;
  kondygnacja: number | "";
  wewnatrz_budynku: string;
  dostepnosc: "" | "publiczny" | "ograniczony" | "prywatny";
  godziny_dostepnosci: string;
  szafka_zamknieta: string;
  instrukcja_dostepu: string;
  dostosowanie_dla_wozkow: string;
  status: string;
  producent: string;
  model: string;
  tryb_pediatryczny: string;
  dysponent_nazwa: string;
  kontakt_telefon: string;
  kontakt_email: string;
  data_weryfikacji: string;
  data_aktualizacji: string;
  zdjecie_url: string;
  zrodla: string[];
  liczba_zrodel: number;
  licencja: string;
  osm_id: string;
  dostep_24h: string;
  wskaznik_jakosci: number;
  problemy_jakosci: string[];
  otwarte_teraz?: boolean | null;
  odleglosc_m?: number;
  czas_dojscia_min?: number;
  zgloszenia?: { kind: string; comment: string; created_at: string }[];
};

export type Point = [string, number, number, number, number];

export type User = { id: number; email: string; organization: string; regon: string };

const TOKEN_KEY = "pokazaed.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable – session-only login */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : Array.isArray(j.detail) ? j.detail.map((d: { msg: string }) => d.msg).join("; ") : msg;
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export const fmt = new Intl.NumberFormat("pl-PL");

export function displayName(a: Pick<AED, "nazwa" | "lokalizacja_opis" | "miejscowosc">): string {
  if (a.nazwa) return a.nazwa;
  if (a.miejscowosc) return `Defibrylator AED – ${a.miejscowosc}`;
  return "Defibrylator AED";
}

export function address(a: AED): string {
  const street = [a.ulica, a.nr_budynku].filter(Boolean).join(" ");
  const city = [a.kod_pocztowy, a.miejscowosc].filter(Boolean).join(" ");
  return [street, city].filter(Boolean).join(", ");
}

export const ACCESS_LABEL: Record<string, string> = {
  publiczny: "Publiczny",
  ograniczony: "Ograniczony",
  prywatny: "Prywatny",
  "": "Brak danych",
};

export const SOURCE_LABEL: Record<string, string> = {
  osm: "OpenStreetMap",
  krosno: "Krosno (dane.gov.pl)",
  marki: "Marki (dane.gov.pl)",
  legionowo: "Legionowo (dane.gov.pl)",
  przemysl: "Przemyśl (dane.gov.pl)",
};

export function distance(m?: number): string {
  if (m === undefined) return "";
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

const DAY_PL: Record<string, string> = { Mo: "pn", Tu: "wt", We: "śr", Th: "czw", Fr: "pt", Sa: "sob", Su: "nd", PH: "święta" };

export function hoursPl(oh: string): string {
  if (!oh) return "Brak danych o godzinach";
  if (oh.trim() === "24/7") return "Całodobowo (24/7)";
  return oh
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => DAY_PL[d] ?? d)
    .replace(/\boff\b/g, "nieczynne")
    .replace(/;\s*/g, " · ");
}
