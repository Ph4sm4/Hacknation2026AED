import { walkMinutes } from './geo';
import type { AedItem } from './types';

type Raw = {
  id: string;
  latitude: number;
  longitude: number;
  nazwa?: string;
  adres?: string;
  miejscowosc?: string;
  opis?: string;
  godziny?: string;
  dostepnosc?: string;
  dostep_24h?: string;
  openNow?: boolean | null;
  distanceM: number;
  walkMin?: number;
};

const clean = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Shared by the live API and the offline snapshot, so both render identically. */
export function toAedItem(r: Raw): AedItem {
  const name = clean(r.nazwa);
  const placement = clean(r.opis);
  const title = name || placement || 'Defibrylator AED';
  const hours = clean(r.godziny);
  const is24h = r.dostep_24h === 'tak' || hours === '24/7';
  return {
    id: r.id,
    latitude: r.latitude,
    longitude: r.longitude,
    title,
    address: [clean(r.adres), clean(r.miejscowosc)].filter(Boolean).join(', '),
    placement: placement && placement !== title ? placement : '',
    hours,
    access: clean(r.dostepnosc),
    is24h,
    openNow: is24h ? true : r.openNow ?? null,
    distanceM: Math.round(r.distanceM),
    walkMin: r.walkMin ?? walkMinutes(r.distanceM),
  };
}
