import { AED_API_URL, fetchWithTimeout } from '@/constants/config';
import { toAedItem } from './normalize';
import type { AedItem, Coords } from './types';

type ApiAed = {
  id: string;
  nazwa: string;
  szerokosc_geograficzna: number;
  dlugosc_geograficzna: number;
  ulica: string;
  nr_budynku: string;
  miejscowosc: string;
  lokalizacja_opis: string;
  godziny_dostepnosci: string;
  dostepnosc: string;
  dostep_24h: string;
  otwarte_teraz: boolean | null;
  odleglosc_m: number;
  czas_dojscia_min: number;
};

/** GET /api/aed/nearest from the GdzieAED backend. Throws on network error or timeout. */
export async function fetchNearest({ latitude, longitude }: Coords, k = 10): Promise<AedItem[]> {
  const url = `${AED_API_URL}/api/aed/nearest?lat=${latitude}&lon=${longitude}&k=${k}`;
  const res = await fetchWithTimeout(url, {}, 4000);
  if (!res.ok) throw new Error(`GdzieAED API ${res.status}`);
  const json: { data: ApiAed[] } = await res.json();
  return json.data.map((r) =>
    toAedItem({
      id: r.id,
      latitude: r.szerokosc_geograficzna,
      longitude: r.dlugosc_geograficzna,
      nazwa: r.nazwa,
      adres: [r.ulica, r.nr_budynku].filter(Boolean).join(' '),
      miejscowosc: r.miejscowosc,
      opis: r.lokalizacja_opis,
      godziny: r.godziny_dostepnosci,
      dostepnosc: r.dostepnosc,
      dostep_24h: r.dostep_24h,
      openNow: r.otwarte_teraz,
      distanceM: r.odleglosc_m,
      walkMin: r.czas_dojscia_min,
    }),
  );
}
