import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

// The app is light-only (app.json "userInterfaceStyle": "light").
export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="emergency" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="details" options={{ title: 'Wynik weryfikacji', headerBackTitle: 'Wróć' }} />
        <Stack.Screen name="errorHandler" options={{ title: 'Błąd', headerBackTitle: 'Wróć' }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
