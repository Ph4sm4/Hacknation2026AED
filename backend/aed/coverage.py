"""AED coverage per gmina and powiat – the "white spots" map and municipal ranking for the campaign.

Denominator: GUS population per gmina (aed.gus). Assignment of an AED to a gmina: TERYT from PRG boundaries
(GUGiK ULDK, aed.geocode) or the 7-digit TERYT given by the source.
Outputs: data/out/pokrycie_gmin.{json,csv} and data/out/pokrycie_powiatow.geojson (choropleth).
"""
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict

from . import gus
from .geo import voivodeship
from .geocode import load_extents
from .schema import ROOT

OUT = ROOT / "data" / "out"
GMINA_FIELDS = ["teryt", "gmina", "rodzaj", "powiat", "wojewodztwo", "ludnosc", "powierzchnia_km2",
                "aed", "aed_24h", "aed_publiczne", "aed_na_10_tys", "mieszkancow_na_aed", "lat", "lon"]


def _gmina_of(r: dict) -> str:
    t = r.get("_gmina_teryt") or ""
    if not t and len(r.get("kod_teryt_gminy") or "") == 7:
        t = r["kod_teryt_gminy"]
    return t


def _rate(aed: int, pop: int) -> float:
    return round(aed / pop * 10_000, 2) if pop else 0.0


def build(records: list[dict]) -> dict:
    gminy = gus.load_gminy()
    if not gminy:
        return {}
    counts: dict[str, dict] = defaultdict(lambda: {"aed": 0, "aed_24h": 0, "aed_publiczne": 0})
    unassigned = 0
    for r in records:
        t = _gmina_of(r)
        if t not in gminy:
            unassigned += 1
            continue
        c = counts[t]
        c["aed"] += 1
        c["aed_24h"] += r.get("dostep_24h") == "tak"
        c["aed_publiczne"] += r.get("dostepnosc") == "publiczny"

    extents = load_extents()
    rows = []
    for t, g in gminy.items():
        c = counts.get(t, {"aed": 0, "aed_24h": 0, "aed_publiczne": 0})
        e = extents.get(t)
        rows.append({
            "teryt": t, "gmina": g["gmina"], "rodzaj": g["rodzaj"], "powiat": g["powiat"],
            "wojewodztwo": g["wojewodztwo"], "ludnosc": g["ludnosc"], "powierzchnia_km2": g["powierzchnia_km2"],
            **c,
            "aed_na_10_tys": _rate(c["aed"], g["ludnosc"]),
            "mieszkancow_na_aed": round(g["ludnosc"] / c["aed"]) if c["aed"] else None,
            # approximate centre (bounding box of PRG boundary) – for the "gminas without AED" markers
            "lat": round((e[1] + e[3]) / 2, 4) if e else None,
            "lon": round((e[0] + e[2]) / 2, 4) if e else None,
        })
    rows.sort(key=lambda x: (-x["aed_na_10_tys"], -x["aed"]))

    pop = sum(g["ludnosc"] for g in gminy.values())
    assigned = sum(c["aed"] for c in counts.values())
    no_aed = [r for r in rows if r["aed"] == 0]
    per_woj: dict[str, dict] = defaultdict(lambda: {"ludnosc": 0, "aed": 0, "gminy": 0, "gminy_bez_aed": 0})
    for r in rows:
        w = per_woj[r["wojewodztwo"]]
        w["ludnosc"] += r["ludnosc"]
        w["aed"] += r["aed"]
        w["gminy"] += 1
        w["gminy_bez_aed"] += r["aed"] == 0
    summary = {
        "zrodlo_ludnosci": gus.SOURCE,
        "gminy": len(rows),
        "gminy_bez_aed": len(no_aed),
        "ludnosc_w_gminach_bez_aed": sum(r["ludnosc"] for r in no_aed),
        "ludnosc": pop,
        "aed_przypisane": assigned,
        "aed_bez_gminy": unassigned,
        "aed_na_10_tys": _rate(assigned, pop),
        "wojewodztwa": sorted(
            ({"wojewodztwo": k, **v, "aed_na_10_tys": _rate(v["aed"], v["ludnosc"])} for k, v in per_woj.items()),
            key=lambda x: -x["aed_na_10_tys"]),
    }
    _export(rows, summary)
    return summary


# ------------------------------------------------------------------ powiat choropleth
# boundary file predates the 2021 rename of powiat jeleniogórski → karkonoski
RENAMED = {"powiat jeleniogórski": "powiat karkonoski"}


def _norm(s: str) -> str:
    n = re.sub(r"\s+", " ", s.lower().replace("powiat m. ", "powiat ").strip())
    return RENAMED.get(n, n)


def _inner_point(geom: dict) -> tuple[float, float]:
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    ring = max((p[0] for p in polys), key=len)
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    return sum(ys) / len(ys), sum(xs) / len(xs)


def _powiaty_geojson(rows: list[dict]) -> dict:
    per: dict[tuple[str, str], dict] = {}
    for r in rows:
        k = (r["wojewodztwo"], _norm(r["powiat"]))
        p = per.setdefault(k, {"powiat": r["powiat"], "wojewodztwo": r["wojewodztwo"], "teryt": r["teryt"][:4],
                               "ludnosc": 0, "aed": 0, "gminy": 0, "gminy_bez_aed": 0})
        p["ludnosc"] += r["ludnosc"]
        p["aed"] += r["aed"]
        p["gminy"] += 1
        p["gminy_bez_aed"] += r["aed"] == 0
    geo = json.loads((ROOT / "data" / "boundaries" / "powiaty.geojson").read_text(encoding="utf-8"))
    feats = []
    for f in geo["features"]:
        lat, lon = _inner_point(f["geometry"])
        p = per.get((voivodeship(lat, lon), _norm(f["properties"]["nazwa"])))
        if not p:
            continue
        feats.append({"type": "Feature", "geometry": f["geometry"],
                      "properties": {**p, "aed_na_10_tys": _rate(p["aed"], p["ludnosc"])}})
    return {"type": "FeatureCollection", "features": feats}


def _export(rows: list[dict], summary: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    gj = _powiaty_geojson(rows)
    summary["powiaty_na_mapie"] = len(gj["features"])
    (OUT / "pokrycie_gmin.json").write_text(json.dumps({"podsumowanie": summary, "gminy": rows}, ensure_ascii=False),
                                            encoding="utf-8")
    with open(OUT / "pokrycie_gmin.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=GMINA_FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    (OUT / "pokrycie_powiatow.geojson").write_text(json.dumps(gj, ensure_ascii=False, separators=(",", ":")),
                                                  encoding="utf-8")
