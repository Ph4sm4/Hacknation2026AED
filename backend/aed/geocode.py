"""Reverse geocoding with GUGiK (state address register PRG / EMUiA and administrative boundaries).

Two public, free services of Główny Urząd Geodezji i Kartografii:
- UUG  GetAddressReverse – nearest address point (street, number, postcode, SIMC) within RADIUS_M,
- ULDK GetCommuneByXY    – gmina containing the point (7-digit TERYT), from PRG boundaries.

Results are cached in data/sources/gugik_geokodowanie.json, so `make data` stays offline and reproducible.
Fill / refresh the cache (network, ~2 requests per AED, already cached points are skipped):

    python -m aed.geocode
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from .schema import ROOT

CACHE_PATH = ROOT / "data" / "sources" / "gugik_geokodowanie.json"
EXTENTS_PATH = ROOT / "data" / "sources" / "gugik_gminy_obrysy.json"
UUG = "https://services.gugik.gov.pl/uug/"
ULDK = "https://uldk.gugik.gov.pl/"
RADIUS_M = 100  # nearest address point farther than this is not treated as the AED's address
WORKERS = 6
UA = "GdzieAED/1.0 (HackNation 2026; open data aggregator)"
SOURCE_LABEL = "PRG GUGiK"


def key(lat: float, lon: float) -> str:
    return f"{lat:.6f},{lon:.6f}"


def load_cache() -> dict[str, dict]:
    if not CACHE_PATH.exists():
        return {}
    return json.loads(CACHE_PATH.read_text(encoding="utf-8")).get("points", {})


def save_cache(points: dict[str, dict]) -> None:
    CACHE_PATH.write_text(json.dumps({
        "source": "GUGiK: UUG GetAddressReverse (PRG punkty adresowe), ULDK GetCommuneByXY (PRG granice gmin)",
        "radius_m": RADIUS_M,
        "points": dict(sorted(points.items())),
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def _get(url: str, retries: int = 3) -> str:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.read().decode("utf-8")
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
    return ""


def reverse_address(lat: float, lon: float) -> dict | None:
    q = urllib.parse.urlencode({"request": "GetAddressReverse", "location": f"POINT({lon} {lat})",
                                "srid": 4326, "radius": RADIUS_M})
    data = json.loads(_get(f"{UUG}?{q}"))
    res = (data.get("results") or {}).get("1")
    if not res:
        return None
    return {
        "ulica": res.get("street") or "",
        "nr_budynku": res.get("number") or "",
        "miejscowosc": res.get("city") or "",
        "kod_pocztowy": res.get("code") or "",
        "kod_simc": res.get("simc") or "",
        "odleglosc_m": round(float(res.get("distance") or 0)),
    }


def commune(lat: float, lon: float) -> dict | None:
    """'0\\n146501_1|Warszawa (miasto)|powiat Warszawa|mazowieckie' → TERYT 1465011."""
    q = urllib.parse.urlencode({"request": "GetCommuneByXY", "xy": f"{lon},{lat},4326",
                                "result": "teryt,commune,county,voivodeship"})
    lines = _get(f"{ULDK}?{q}").strip().splitlines()
    if len(lines) < 2 or lines[0].strip() != "0":
        return None
    teryt, name, county, woj = (lines[1].split("|") + ["", "", "", ""])[:4]
    return {"teryt": teryt.replace("_", ""), "gmina": name, "powiat": county, "wojewodztwo": woj}


def lookup(lat: float, lon: float) -> dict:
    return {"adres": reverse_address(lat, lon), "gmina": commune(lat, lon)}


def fill_cache(coords: list[tuple[float, float]]) -> None:
    points = load_cache()
    todo = sorted({key(a, b): (a, b) for a, b in coords if key(a, b) not in points}.items())
    print(f"{len(coords)} punktów, w cache {len(coords) - len(todo)}, do pobrania {len(todo)}")
    done = errors = 0
    with ThreadPoolExecutor(WORKERS) as pool:
        futures = {pool.submit(lookup, *c): k for k, c in todo}
        for f in as_completed(futures):
            try:
                points[futures[f]] = f.result()
            except Exception:
                errors += 1  # left out of the cache – retried on the next run
            done += 1
            if done % 500 == 0:
                save_cache(points)
                print(f"  {done}/{len(todo)} (błędy: {errors})", flush=True)
    save_cache(points)
    print(f"Gotowe: {done - errors} nowych, błędy: {errors}")


def apply(records: list[dict]) -> None:
    """Fill missing address / TERYT from the cache. Never overwrites data that came from a source."""
    points = load_cache()
    for r in records:
        r["adres_zrodlo"] = "źródło rekordu" if (r["ulica"] or r["miejscowosc"]) else ""
        g = points.get(key(r["szerokosc_geograficzna"], r["dlugosc_geograficzna"]))
        if not g:
            continue
        gm = g.get("gmina")
        if gm:
            r["_gmina_teryt"] = gm["teryt"]  # always from PRG boundaries – used by the coverage ranking
            if not r.get("kod_teryt_gminy"):
                r["kod_teryt_gminy"] = gm["teryt"]
            if not r["wojewodztwo"]:
                r["wojewodztwo"] = gm["wojewodztwo"]
        a = g.get("adres")
        if a and not r["ulica"] and not r["miejscowosc"]:
            for f in ("ulica", "nr_budynku", "miejscowosc", "kod_pocztowy", "kod_simc"):
                if not r.get(f):
                    r[f] = a[f]
            r["adres_zrodlo"] = f"{SOURCE_LABEL} – najbliższy punkt adresowy ({a['odleglosc_m']} m)"


def commune_extent(teryt: str) -> list[float] | None:
    """Bounding box [lon_min, lat_min, lon_max, lat_max] of a gmina (ULDK GetCommuneById)."""
    q = urllib.parse.urlencode({"request": "GetCommuneById", "id": teryt, "result": "geom_extent", "srid": 4326})
    lines = _get(f"{ULDK}?{q}").strip().splitlines()
    if len(lines) < 2 or lines[0].strip() != "0":
        return None
    return [round(float(x), 5) for x in lines[1].split(",")]


def load_extents() -> dict[str, list[float]]:
    return json.loads(EXTENTS_PATH.read_text(encoding="utf-8")) if EXTENTS_PATH.exists() else {}


def fill_extents(teryts: list[str]) -> None:
    ext = load_extents()
    todo = [t for t in teryts if t not in ext]
    print(f"Obrysy gmin: {len(teryts)}, do pobrania {len(todo)}")
    with ThreadPoolExecutor(WORKERS) as pool:
        for t, bbox in zip(todo, pool.map(lambda x: _safe(commune_extent, x), todo)):
            if bbox:
                ext[t] = bbox
    EXTENTS_PATH.write_text(json.dumps(dict(sorted(ext.items())), separators=(",", ":")), encoding="utf-8")


def _safe(fn, *args):
    try:
        return fn(*args)
    except Exception:  # noqa: BLE001 – retried on the next run
        return None


def main() -> None:
    src = ROOT / "data" / "out" / "aed_polska.json"
    rows = json.loads(src.read_text(encoding="utf-8"))["data"]
    fill_cache([(r["szerokosc_geograficzna"], r["dlugosc_geograficzna"]) for r in rows])
    from .gus import load_gminy
    fill_extents(sorted(load_gminy()))


if __name__ == "__main__":
    main()
