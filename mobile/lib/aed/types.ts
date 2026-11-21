export type Coords = { latitude: number; longitude: number };

export type AedItem = {
  id: string;
  latitude: number;
  longitude: number;
  /** Display name: holder's name, else placement description, else "Defibrylator AED". */
  title: string;
  /** Street + building number and town, may be empty (many OSM records have no address). */
  address: string;
  /** Where exactly the device hangs ("przy portierni, parter"). Empty when it equals the title. */
  placement: string;
  /** Raw opening hours (OSM opening_hours syntax), may be empty. */
  hours: string;
  /** publiczny | ograniczony | prywatny | "" */
  access: string;
  is24h: boolean;
  /** Computed by the API; null when unknown (offline mode or no hours). */
  openNow: boolean | null;
  distanceM: number;
  walkMin: number;
};

export type DataSource = 'live' | 'offline';
