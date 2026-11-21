# mObywatelAED (makieta mObywatela) + GdzieAED

Makieta aplikacji mObywatel (Expo SDK 58, expo-router) z modułem **GdzieAED – najbliższy defibrylator**:

- czerwony przycisk **„Nagły wypadek?”** na ekranie głównym i kafelek w zakładce **Usługi**;
- ekran alarmowy: **Zadzwoń 112**, mapa satelitarna 10 najbliższych AED, karta najbliższego urządzenia (adres, miejsce zawieszenia, dostępność 24/7) i **„Prowadź do AED”**, czyli nawigacja piesza w Google Maps;
- **prawdziwa trasa piesza** (Apple MapKit, moduł `modules/aed-routing`): aplikacja wyznacza trasy do 3 najbliższych AED, wybiera najbliższy *pieszo* (nie w linii prostej) i rysuje trasę na mapie;
- **metronom RKO**: rytm 110 uciśnięć na minutę z dźwiękiem i wibracją, licznik 30 uciśnięć, ekran nie gaśnie;
- **Przycisk czynności** (iPhone 15 Pro i nowsze): w Ustawieniach → Przycisk czynności → Skrót → mObywatelAED wybierz „Nearest AED” albo „CPR metronome”;
- **działa offline**: gdy API GdzieAED jest nieosiągalne, aplikacja korzysta z wbudowanej kopii 18 309 AED;
- **Siri** (development build): „Emergency in mObywatelAED”, „Take me to the nearest AED with mObywatelAED”;
- skaner kodów QR do weryfikacji stron (zakładka **Kod QR**).

Aplikacja korzysta z API i danych tego repozytorium (`../backend`, `../data/out`): zbiory dysponentów z dane.gov.pl oraz © współtwórcy OpenStreetMap (ODbL).

## Uruchomienie

Wymagania: Node 20+, a dla iPhone'a Xcode z platformą iOS i CocoaPods (`brew install cocoapods`).

1. Backend GdzieAED widoczny w sieci lokalnej (z katalogu głównego repo):
   ```bash
   cd backend && ../.venv/bin/uvicorn aed.api.main:app --host 0.0.0.0 --port 8000
   ```
2. Zależności aplikacji (w katalogu `mobile/`):
   ```bash
   npm install
   ```
3. **Wersja na telefon bez serwera** (kod JS wbudowany w aplikację; najlepsza do demo). iPhone podłączony kablem, odblokowany, z włączonym Trybem dewelopera:
   ```bash
   EXPO_PUBLIC_AED_API_URL=http://<IP-Maca-w-Wi-Fi>:8000 npx expo run:ios --device --configuration Release
   ```
   Przy pierwszym buildzie: Xcode → Settings → Apple Accounts (wystarczy darmowe Apple ID), a w `app.json` ustaw `ios.appleTeamId` na swój Team, a na iPhonie Ustawienia → Ogólne → VPN i urządzenia → **Ufaj**. Gdy API jest nieosiągalne, aplikacja liczy najbliższe AED z danych offline.
4. **Tryb deweloperski** (hot reload): zainstaluj development build (`npx expo run:ios --device`) i uruchom serwer na adresie Wi-Fi Maca:
   ```bash
   REACT_NATIVE_PACKAGER_HOSTNAME=<IP-Maca-w-Wi-Fi> npx expo start --dev-client
   ```
   W aplikacji wybierz serwer albo wpisz `http://<IP-Maca-w-Wi-Fi>:8081`. Telefon i Mac muszą być w tej samej sieci Wi-Fi.

Adres API w trybie deweloperskim aplikacja wykrywa sama (komputer, który serwuje bundle, port 8000). Można go nadpisać w `.env.local`:

```
EXPO_PUBLIC_AED_API_URL=https://twoj-serwer.pl
EXPO_PUBLIC_VALIDATION_API_URL=http://10.250.163.10:3000
```

## Siri

Siri wymaga kodu natywnego (App Intents w `plugins/ios/AedAppIntents.swift`). Plugin `plugins/with-aed-siri.js` dodaje go do projektu przy `prebuild`. **W Expo Go Siri nie działa**, potrzebny jest build natywny (`expo run:ios`):

1. Zainstaluj Xcode z App Store, następnie:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app
   ```
2. Podłącz iPhone'a kablem i włącz **Tryb dewelopera** (Ustawienia → Prywatność i ochrona).
3. Zbuduj i zainstaluj aplikację:
   ```bash
   npx expo run:ios --device
   ```
   Przy pierwszym buildzie wybierz w Xcode **Signing & Capabilities → Team**; wystarczy darmowe Apple ID. Na iPhonie zaufaj certyfikatowi (Ustawienia → Ogólne → VPN i urządzenia).

Frazy (Siri nie obsługuje języka polskiego, dlatego są po angielsku; iOS wymaga w nich nazwy aplikacji):

| Fraza | Działanie |
|---|---|
| „Hey Siri, emergency in mObywatelAED” / „I have an emergency in mObywatelAED” | otwiera ekran alarmowy |
| „Hey Siri, where is the nearest AED in mObywatelAED” | otwiera ekran alarmowy |
| „Hey Siri, take me to the nearest AED with mObywatelAED” | od razu uruchamia nawigację pieszą w Google Maps |
| „Hey Siri, start CPR in mObywatelAED” | uruchamia metronom RKO |

**Fraza bez nazwy aplikacji** („Hey Siri, I have an emergency”): w aplikacji **Skróty** dodaj akcję „Find the nearest AED” z mObywatelAED i nazwij skrót „I have an emergency”. Siri uruchamia skróty po ich nazwie.

Deep linki: `mobywatelaed://emergency`, `mobywatelaed://emergency?go=1` (od razu prowadzi do najbliższego AED), `mobywatelaed://cpr` (metronom RKO).

## Dane offline

`assets/data/aed-snapshot.json` (~2,3 MB) to kopia zbioru GdzieAED. Odświeżenie po `make data` w katalogu głównym repo:

```bash
node scripts/build-aed-snapshot.mjs
```

## Ograniczenia

- Siri tylko w development/release buildzie i tylko z frazami angielskimi.
- Status „dostępny teraz” liczy API. W trybie offline aplikacja pokazuje tylko 24/7 i surowe godziny.
- Trasa liczona jest w Google Maps. Aplikacja pokazuje odległość w linii prostej i szacowany czas dojścia (4,8 km/h).
- Część rekordów OSM nie ma adresu, wtedy aplikacja pokazuje opis miejsca zawieszenia albo „Defibrylator AED”.
