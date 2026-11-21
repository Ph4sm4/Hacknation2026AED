# GdzieAED – project plan & architecture

Team working document (EN). Public-facing docs are in Polish (`README.md`).

## 1. The challenge in one paragraph

"Misja AED – Dane na ratunek" (Ministry of Digital Affairs, HackNation 2026). AED data in Poland is spread out, incomplete and unverified. Deliver:

1. A **reference data model** (as `.xlsx`) so every AED holder publishes on dane.gov.pl the same way.
2. A **working prototype** that integrates data from many sources into one national open dataset, recording where each record came from.
3. A **campaign** with a name, slogan, logo (jpg/png/pdf + open format) and a brand book PDF (colours, clear space, minimum size, misuse, 3–5 sentence concept).

The jury runs the prototype.

### Scoring → where effort goes

| Criterion | Weight | Our answer |
|---|---|---|
| Follows dane.gov.pl rules | **30%** | Harvester XML in the portal's own format (XSD 1.13 from its source code, tested), DCAT-AP, CC licences, HEAL category, machine-readable formats only |
| Logo + slogan | **25%** | Name **GdzieAED**, slogan "GdzieAED? Każda minuta się liczy.", holder CTA "Pokaż, gdzie jest Twój AED." Sign-board mark (concept D "Tablica": heart + bolt + "tu jest" pointer), full brand book; 6 concepts kept in `branding/warianty/` |
| Creativity | 15% | Universal validator with auto-fixes, OSM as a lead list of holders to invite, quality score, "claim your AEDs", citizen reports |
| Fits the topic | 15% | "Find nearest AED" with open-now / 24/7, exact placement, 112 strip |
| Data model | 10% | 34 fields, O/Z/F required/recommended/optional, dictionaries, OSM tag mapping, Table Schema + JSON Schema |
| Presentation | 5% | **TODO**: ≥5 slides with screenshots (`docs/screenshots/`) |

## 2. Architecture

```
data/sources/*  ──►  adapters (sources.py) ──► universal validator (validator.py) ──► normalised records
   OSM GeoJSON        Krosno CSV · Marki CSV (broken quoting, swapped lat/lon)
   Legionowo CSV      Przemyśl GML · OSM tags
                                   │
                                   ▼
                     pipeline.py: merge official ↔ OSM (60 m), voivodeship (point-in-polygon),
                     24/7 flag, quality score 0–100 + problem list, stable IDs AED-PL-<sha1>
                                   │
           ┌───────────────────────┼───────────────────────────┐
           ▼                       ▼                           ▼
  data/out/aed_oficjalne.csv   data/out/aed_polska.{csv,xlsx,json,geojson}   statystyki.json
  (CC0/CC BY → dane.gov.pl)    (ODbL, includes OSM)
                                   │
                                   ▼
             FastAPI (api/main.py): in-memory store + grid index, SQLite (users, uploads, submissions, reports)
             /api/aed · /api/aed/nearest · /api/aed/points · /api/validate · /api/holder/* ·
             /api/dane-gov-pl/harvester.xml · /api/dcat.jsonld · /api/schema/* · /api/docs
                                   │
                                   ▼
             React SPA (served by FastAPI from frontend/dist)
             /  map · /dane open data · /standard data model · /dysponent holder portal · /akcja campaign
```

### Stack (as built)

| Layer | Choice | Note |
|---|---|---|
| Data model | `schema/aed_schema.yaml` → generators | single source of truth for XLSX, Table Schema, JSON Schema, validator |
| Pipeline | Python 3.12, stdlib + openpyxl + lxml | no pandas: inputs are small, fewer dependencies for the jury |
| API | FastAPI + uvicorn | OpenAPI at `/api/docs` |
| Storage | in-memory read model + SQLite | **changed from the PostGIS proposal**: 18k points fit in RAM, nearest-search via a grid index takes milliseconds, and it runs with zero infrastructure. PostGIS is the production path |
| Frontend | React 19 + TS + Vite 7 + Tailwind 4, Leaflet + markercluster, lucide icons, Inter | |
| Branding | fontTools (wordmark → outlines), Playwright (PNG/JPG/PDF, brand book from HTML) | |
| Tests | pytest (13) | validator on real files, XSD validation, API, holder flow |

### Design system

- White primary surface. **Medical red** `#C8102E` (brand / emergency / CTAs), **hospital navy** `#0B3D91` (information, navigation). **AED green** `#0F7B3F` only for the "available / 24/7" status.
- **Swiss / International style** (since 21.11.2026): black typography on a 12-column grid, red as the single action colour, display headlines, rules instead of shadows.
- **Soft geometry**: buttons, inputs, badges and map clusters are pill-shaped (`rounded-full`), panels and maps 12–16px. Radius scale in `frontend/src/index.css` (`--radius-*`) and `mobile/constants/aed-theme.ts` (`radius`, `pill`). This replaces the earlier 4px cap.
- Every password input has an **eye toggle** (`PasswordInput` in `components/ui.tsx`, `aria-pressed`, label "Pokaż/Ukryj hasło").
- WCAG: skip link, visible focus ring, 44px touch targets, list alternative to the map, `aria-live` results, labels on all inputs, `prefers-reduced-motion`, `lang="pl"`.

## 3. Key decisions

1. **Licensing is a feature, not a footnote.** dane.gov.pl's XSD lists only CC licences, while OSM is ODbL (share-alike). So the dataset harvested by dane.gov.pl contains holders' data only. OSM is used for cross-verification (58 of 74 official records confirmed), gap analysis, the public map, and as a **list of holders to invite** (ZUS, InPost, Tauron… with dozens of AEDs each).
2. **Don't invent data.** Official sources lack hours and access info, and we leave those fields empty with quality flags. Holders fill shared defaults once per file in the portal.
3. **One engine for everyone.** Official files and holder uploads run through the same validator, so the demo proves on real dane.gov.pl files that messy data can be normalised (Marki: wrapped CSV lines + swapped coordinates, fixed automatically).
4. **Publish via harvester, not manual upload.** Each holder submission gets a stable CSV URL + a harvester XML that dane.gov.pl can poll.

## 4. Formal deliverables checklist

- [x] Project title & description (`README.md`)
- [ ] **Presentation** (≥5 slides, screenshots, user steps, limitations). Material is ready in `README.md` + `docs/screenshots/`
- [x] Prototype (FastAPI + React, `make install schema data build`, then run the API)
- [x] Reference data model `.xlsx` (`schema/out/wzorcowy_zakres_danych_AED.xlsx`)
- [x] Source code
- [x] Logo `.jpg .png .pdf .svg` (`branding/out/`)
- [x] Brand book `.pdf` (`branding/out/gdzieaed-ksiega-znaku.pdf`)
- [x] AI usage statement (`docs/AI_USAGE.md`)

## 5. Next steps (proposed)

1. Slide deck (PL) from screenshots + README sections.
2. Deploy to a public URL (Docker image ready; set `PUBLIC_BASE_URL` so XML/DCAT links are absolute).
3. Warsaw source (dane.um.warszawa.pl API) and more city datasets as they appear on dane.gov.pl. Add the Overpass refresh script for OSM.
4. Reverse geocoding (GUGiK) for OSM records without an address and a TERYT code. Fixes the "Defibrylator AED" generic names in the list.
5. Moderation panel for citizen reports + e-mail to holder. "Claim" action that turns an OSM record into a holder record.
6. Holder identity verification (login.gov.pl), reminders for electrode/battery expiry.
7. A11y audit with axe-core in CI. Lighthouse scores for the presentation.

## 6. Repository layout

```
schema/            aed_schema.yaml (source of truth) + out/ (xlsx, tableschema, jsonschema, csv templates)
data/sources/      raw source snapshots (OSM GeoJSON, dane.gov.pl CSV/GML)
data/boundaries/   voivodeship polygons
data/out/          pipeline outputs (csv/xlsx committed; json/geojson regenerated)
backend/aed/       schema.py, normalize.py, validator.py, sources.py, geo.py, pipeline.py, publish.py, build_schema.py
backend/aed/api/   FastAPI app, auth (scrypt + HMAC tokens), SQLite, in-memory store
backend/tests/     pytest
frontend/          React app (pages: Map, Data, Standard, Holder, Campaign)
branding/          logo builder, brand book HTML, renderer, out/ (deliverables)
vendor/dane-gov-pl harvester XSD 1.13 + example (from the portal's GPLv3 source code)
scripts/           screenshots.cjs (Playwright)
docs/              PLAN.md, AI_USAGE.md, screenshots/
```
