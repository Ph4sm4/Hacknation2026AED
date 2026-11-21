import { Alert, Linking } from 'react-native';

/** Walking directions in Google Maps: native app when installed, otherwise the universal link (app or browser). */
export async function openWalkingDirections(latitude: number, longitude: number) {
  const dest = `${latitude},${longitude}`;
  const app = `comgooglemaps://?daddr=${dest}&directionsmode=walking`;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=walking`;
  try {
    if (await Linking.canOpenURL(app)) {
      await Linking.openURL(app);
      return;
    }
  } catch {
    // canOpenURL can throw when the scheme is not whitelisted (e.g. Expo Go) – fall through
  }
  await Linking.openURL(web);
}

/** Walking directions to `dest`, optionally via a waypoint (e.g. pick up the AED on the way). */
export async function openWalkingRoute(dest: { lat: number; lon: number }, via?: { lat: number; lon: number }) {
  if (!via) return openWalkingDirections(dest.lat, dest.lon);
  const q = new URLSearchParams({
    api: '1',
    destination: `${dest.lat},${dest.lon}`,
    waypoints: `${via.lat},${via.lon}`,
    travelmode: 'walking',
  });
  await Linking.openURL(`https://www.google.com/maps/dir/?${q}`);
}

export async function call112() {
  try {
    await Linking.openURL('tel:112');
  } catch {
    Alert.alert('Nie można wybrać numeru', 'Zadzwoń pod numer alarmowy 112 ręcznie.');
  }
}

export const openAppSettings = () => Linking.openSettings();
