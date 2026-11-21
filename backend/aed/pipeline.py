"""Aggregation pipeline: sources → normalise → enrich → de-duplicate → score → export.

    python -m aed.pipeline
"""
from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

from . import normalize as N
from .geo import GridIndex, voivodeship
from .schema import ROOT, load_schema
from .sources import PENDING_SOURCES, SOURCES, load_all

OUT = ROOT / "data" / "out"
MATCH_RADIUS_M = 60
LICENSE_RANK = {"CC0-1.0": 0, "CC-BY-4.0": 1, "ODbL-1.0": 2}


def national_id(source_key: str, local_id: str) -> str:
    return "AED-PL-" + hashlib.sha1(f"{source_key}:{local_id}".encode()).hexdigest()[:10].upper()


def quality(rec: dict, schema) -> tuple[int, list[str]]:
    problems: list[str] = []
    mand = [f for f in schema.fields if f.mandatory]
    rec_ = [f for f in schema.fields if f.required == "Z"]
    have_m = sum(1 for f in mand if rec.get(f.name) not in ("", None))
    have_r = sum(1 for f in rec_ if rec.get(f.name) not in ("", None))
    score = 55 * have_m / len(mand) + 20 * have_r / len(rec_)
    if not rec["godziny_dostepnosci"]:
        problems.append("brak godzin dostępności")
    if not rec["dostepnosc"]:
        problems.append("brak informacji, kto może skorzystać")
    if not rec["lokalizacja_opis"]:
        problems.append("brak opisu miejsca zawieszenia")
    if not rec["dysponent_nazwa"]:
        problems.append("brak dysponenta")
    age = N.years_since(rec["data_weryfikacji"]) if rec["data_weryfikacji"] else None
    if age is None:
        problems.append("brak daty weryfikacji")
    elif age <= 1:
        score += 15
    elif age <= 2:
        score += 8
    else:
        problems.append("weryfikacja starsza niż 2 lata")
    if rec.get("liczba_zrodel", 1) >= 2:
        score += 10
    if rec.get("_fixme"):
        problems.append("OSM fixme: " + rec["_fixme"][:80])
        score -= 10
    if rec["szafka_zamknieta"] == "tak" and not rec["instrukcja_dostepu"]:
        problems.append("szafka zamknięta bez instrukcji dostępu")
    return max(0, min(100, round(score))), problems


def merge(base: dict, other: dict) -> dict:
    for k, v in other.items():
        if k.startswith("_") or k in ("id_aed",):
            continue
        if base.get(k) in ("", None) and v not in ("", None):
            base[k] = v
    return base


def run() -> dict:
    schema = load_schema()
    raw = load_all()
    src_by_key = {s.key: s for s in SOURCES}
    official: list[dict] = []
    for s in SOURCES:
        for r in raw[s.key]:
            r["_source"] = s.key
            r["_license"] = s.license
            r["id"] = national_id(s.key, str(r["id_aed"]))
    for s in SOURCES:
        if s.kind == "oficjalne":
            official.extend(raw[s.key])

    # --- de-duplicate: OSM points matched to official records within MATCH_RADIUS_M
    osm = raw.get("osm", [])
    idx = GridIndex(official)
    matched_osm: set[str] = set()
    matches = 0
    merged_official = []
    for o in official:
        rec = dict(o)
        rec["zrodla"] = [o["_source"]]
        rec["osm_id"] = ""
        merged_official.append(rec)
    off_by_id = {r["id"]: r for r in merged_official}
    for p in osm:
        hits = idx.within(p["szerokosc_geograficzna"], p["dlugosc_geograficzna"], MATCH_RADIUS_M)
        hits = [h for h in hits if not off_by_id[h[1]["id"]]["osm_id"]]
        if hits:
            target = off_by_id[hits[0][1]["id"]]
            merge(target, p)
            target["osm_id"] = p["id_aed"]
            target["zrodla"].append("osm")
            target["_license"] = max(target["_license"], "ODbL-1.0", key=LICENSE_RANK.get)
            matched_osm.add(p["id_aed"])
            matches += 1
    osm_rest = []
    for p in osm:
        if p["id_aed"] in matched_osm:
            continue
        rec = dict(p)
        rec["zrodla"] = ["osm"]
        rec["osm_id"] = p["id_aed"]
        osm_rest.append(rec)

    records = merged_official + osm_rest

    # --- enrich + score
    for r in records:
        if not r["wojewodztwo"]:
            r["wojewodztwo"] = voivodeship(r["szerokosc_geograficzna"], r["dlugosc_geograficzna"])
        r["liczba_zrodel"] = len(r["zrodla"])
        r["licencja"] = r["_license"]
        r["dostep_24h"] = "tak" if N.is_24_7(r["godziny_dostepnosci"]) else ("nie" if r["godziny_dostepnosci"] else "")
        r["wskaznik_jakosci"], probs = quality(r, schema)
        r["problemy_jakosci"] = probs
    for r in official:  # official-only export gets region + score too
        if not r["wojewodztwo"]:
            r["wojewodztwo"] = voivodeship(r["szerokosc_geograficzna"], r["dlugosc_geograficzna"])

    stats = build_stats(records, official, matches, src_by_key)
    export(records, official, stats, schema)
    return stats


def build_stats(records, official, matches, src_by_key) -> dict:
    schema = load_schema()
    n = len(records)
    completeness = {f.name: round(100 * sum(1 for r in records if r.get(f.name) not in ("", None)) / n, 1)
                    for f in schema.fields}
    per_woj = Counter(r["wojewodztwo"] or "nieustalone" for r in records)
    problems = Counter(p.split(":")[0] for r in records for p in r["problemy_jakosci"])
    # Campaign leads: operators named in OSM who don't publish official data yet
    ops = Counter(r["dysponent_nazwa"] for r in records if r["zrodla"] == ["osm"] and r["dysponent_nazwa"])
    return {
        "generated_at": datetime.now(N.TZ).isoformat(timespec="seconds"),
        "total": n,
        "official_records": len(official),
        "osm_records": sum(1 for r in records if "osm" in r["zrodla"]),
        "matched_official_osm": matches,
        "multi_source": sum(1 for r in records if r["liczba_zrodel"] > 1),
        "access_24_7": sum(1 for r in records if r["dostep_24h"] == "tak"),
        "public_access": sum(1 for r in records if r["dostepnosc"] == "publiczny"),
        "missing_hours": sum(1 for r in records if not r["godziny_dostepnosci"]),
        "verified_last_year": sum(1 for r in records if r["data_weryfikacji"] and (N.years_since(r["data_weryfikacji"]) or 9) <= 1),
        "avg_quality": round(sum(r["wskaznik_jakosci"] for r in records) / n, 1),
        "per_voivodeship": dict(sorted(per_woj.items(), key=lambda t: -t[1])),
        "per_source": {k: sum(1 for r in records if k in r["zrodla"]) for k in src_by_key},
        "field_completeness": completeness,
        "problems": dict(problems.most_common()),
        "campaign_leads": [{"dysponent": k, "aed": v} for k, v in ops.most_common(30)],
        "sources": [s.public() for s in SOURCES],
        "pending_sources": PENDING_SOURCES,
    }


def _row(r: dict, cols: list[str]) -> dict:
    out = {}
    for c in cols:
        v = r.get(c, "")
        out[c] = "|".join(v) if isinstance(v, list) else v
    return out


def export(records, official, stats, schema) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    cols = schema.aggregate_field_names
    rows = [_row(r, cols) for r in records]
    # CSV (UTF-8, comma) – the primary machine-readable resource
    with open(OUT / "aed_polska.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    # JSON (records + metadata)
    (OUT / "aed_polska.json").write_text(json.dumps({
        "meta": {"title": "Ogólnopolski zbiór defibrylatorów AED", "schema_version": schema.version,
                 "generated_at": stats["generated_at"], "count": len(rows),
                 "license": "ODbL-1.0 (baza zawiera dane OpenStreetMap © współtwórcy OSM); rekordy oficjalne: zob. pole licencja"},
        "data": rows}, ensure_ascii=False), encoding="utf-8")
    # GeoJSON
    def fc(rs):
        return {"type": "FeatureCollection", "features": [
            {"type": "Feature", "id": r["id"],
             "geometry": {"type": "Point", "coordinates": [r["dlugosc_geograficzna"], r["szerokosc_geograficzna"]]},
             "properties": {k: v for k, v in r.items() if k not in ("szerokosc_geograficzna", "dlugosc_geograficzna")}}
            for r in rs]}
    (OUT / "aed_polska.geojson").write_text(json.dumps(fc(rows), ensure_ascii=False), encoding="utf-8")
    # XLSX
    wb = Workbook()
    ws = wb.active
    ws.title = "AED"
    ws.append(cols)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="0B3D91")
    for r in rows:
        ws.append([r[c] for c in cols])
    ws.freeze_panes = "B2"
    wb.save(OUT / "aed_polska.xlsx")
    # Official-only (CC0/CC BY) dataset – what can go to dane.gov.pl today
    off_cols = ["id", *schema.field_names, "licencja", "zrodla"]
    with open(OUT / "aed_oficjalne.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=off_cols, lineterminator="\n", extrasaction="ignore")
        w.writeheader()
        for r in official:
            w.writerow({**_row(r, schema.field_names), "id": r["id"], "licencja": r["_license"], "zrodla": r["_source"]})
    (OUT / "statystyki.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    s = run()
    print(f"{s['total']} AED · oficjalne {s['official_records']} · OSM {s['osm_records']} · "
          f"połączone {s['matched_official_osm']} · śr. jakość {s['avg_quality']}")
    print("Województwa:", s["per_voivodeship"])
    print("Problemy:", s["problems"])


if __name__ == "__main__":
    main()
