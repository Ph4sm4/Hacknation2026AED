import { requireOptionalNativeModule } from 'expo';

export type LatLng = { latitude: number; longitude: number };
export type WalkingRoute = { distance: number; duration: number; coordinates: LatLng[] };

type Native = {
  walkingRoute(fromLat: number, fromLon: number, toLat: number, toLon: number): Promise<WalkingRoute>;
};

// null in Expo Go / web – callers fall back to straight-line distance
const native = requireOptionalNativeModule<Native>('AedRouting');

export const routingAvailable = native != null;

/** Walking route from MapKit (Apple Maps). Resolves null when routing is unavailable or fails. */
export async function walkingRoute(from: LatLng, to: LatLng): Promise<WalkingRoute | null> {
  if (!native) return null;
  try {
    return await native.walkingRoute(from.latitude, from.longitude, to.latitude, to.longitude);
  } catch {
    return null;
  }
}
