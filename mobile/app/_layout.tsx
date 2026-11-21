import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

// defines the background location task – must run in the global scope
import { beat, isResponderEnabled } from '@/lib/aed/responder';

export const unstable_settings = {
  anchor: '(tabs)',
};

const FOREGROUND_POLL_MS = 10_000;

function openAlertFrom(response: Notifications.NotificationResponse | null) {
  const id = response?.notification.request.content.data?.alertId;
  if (typeof id === 'number') router.push({ pathname: '/alert/[id]', params: { id: String(id) } });
}

/** Tapping an alert notification opens it; while the app is on screen responders are checked more often. */
function useResponderAlerts() {
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then(openAlertFrom).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(openAlertFrom);

    let timer: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      if (!(await isResponderEnabled())) return;
      const p = await Location.getLastKnownPositionAsync({ maxAge: 60_000 }).catch(() => null);
      if (p) await beat({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }).catch(() => undefined);
    };
    const start = () => {
      if (timer) return;
      poll();
      timer = setInterval(poll, FOREGROUND_POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    start();
    const app = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => {
      sub.remove();
      app.remove();
      stop();
    };
  }, []);
}

// The app is light-only (app.json "userInterfaceStyle": "light").
export default function RootLayout() {
  useResponderAlerts();
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="emergency" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="cpr" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="alert/[id]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="responder" options={{ title: 'Tryb ratownika', headerBackTitle: 'Wróć' }} />
        <Stack.Screen name="details" options={{ title: 'Wynik weryfikacji', headerBackTitle: 'Wróć' }} />
        <Stack.Screen name="errorHandler" options={{ title: 'Błąd', headerBackTitle: 'Wróć' }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
