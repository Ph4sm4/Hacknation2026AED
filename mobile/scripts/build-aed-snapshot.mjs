// Builds the offline AED snapshot bundled with the app (assets/data/aed-snapshot.json)
// from the GdzieAED aggregated dataset.
//
//   node scripts/build-aed-snapshot.mjs [path/to/aed_polska.json]
//
// Default input: ../data/out/aed_polska.json – the pipeline output of this repo (run `make data` in the repo root first).
import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2] ?? path.resolve('..', 'data', 'out', 'aed_polska.json');
const output = path.resolve('assets', 'data', 'aed-snapshot.json');

const src = JSON.parse(fs.readFileSync(input, 'utf8'));
const records = Array.isArray(src) ? src : src.data;

const round = (n) => Math.round(n * 1e5) / 1e5;
const str = (v, max = 160) => (v == null ? '' : String(v).trim().slice(0, max));

const rows = records
  .filter((r) => (r.status || 'aktywny') === 'aktywny')
  .map((r) => [
    r.id,
    round(r.szerokosc_geograficzna),
    round(r.dlugosc_geograficzna),
    str(r.nazwa),
    str([r.ulica, r.nr_budynku].filter(Boolean).join(' ')),
    str(r.miejscowosc, 60),
    str(r.lokalizacja_opis),
    str(r.godziny_dostepnosci, 80),
    str(r.dostepnosc, 20),
    str(r.dostep_24h, 5),
  ]);

const snapshot = {
  generatedAt: src.meta?.generated_at ?? new Date().toISOString(),
  fields: ['id', 'lat', 'lon', 'nazwa', 'adres', 'miejscowosc', 'opis', 'godziny', 'dostepnosc', 'dostep_24h'],
  data: rows,
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(snapshot));
console.log(`${rows.length} AED -> ${path.relative(process.cwd(), output)} (${(fs.statSync(output).size / 1e6).toFixed(2)} MB)`);
