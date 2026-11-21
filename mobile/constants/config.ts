import Constants from 'expo-constants';

/** IP of the machine serving the JS bundle in development (Expo Go / dev client), e.g. "192.168.1.20". */
function devServerHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri; // "192.168.1.20:8081"
  return hostUri ? hostUri.split(':')[0] : null;
}

const devHost = devServerHost();

/**
 * GdzieAED API (../backend). In development it defaults to the same machine
 * that serves the bundle, port 8000 – start the backend with `--host 0.0.0.0`.
 */
export const AED_API_URL =
  process.env.EXPO_PUBLIC_AED_API_URL ?? (devHost ? `http://${devHost}:8000` : 'http://localhost:8000');

/** Domain validation API used by the QR scanner. */
export const VALIDATION_API_URL = process.env.EXPO_PUBLIC_VALIDATION_API_URL ?? 'http://10.250.163.10:3000';

/** Abortable fetch with a timeout – network calls must never hang the UI. */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
