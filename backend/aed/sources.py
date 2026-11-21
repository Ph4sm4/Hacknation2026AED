"""Catalogue of AED data sources and their adapters.

Every adapter returns records in the reference schema (schema/aed_schema.yaml) – official
files go through the same universal validator a data holder uses in the portal.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from lxml import etree

from . import normalize as N
from .schema import ROOT
from .validator import validate_file, validate_rows

SRC = ROOT / "data" / "sources"


@dataclass
class Source:
    key: str
    name: str
    publisher: str
    kind: str                     # oficjalne | spolecznosciowe
    license: str                  # CC0-1.0 | CC-BY-4.0 | ODbL-1.0
    url: str                      # landing page
    download_url: str
    file: str
    snapshot_date: str            # date of the file we hold / resource modification on dane.gov.pl
    teryt: str = ""
    adapter: Callable[["Source"], list[dict]] | None = None
    notes: list[str] = field(default_factory=list)
    stats: dict = field(default_factory=dict)

    def public(self) -> dict:
        return {k: getattr(self, k) for k in ("key", "name", "publisher", "kind", "license", "url", "download_url",
                                              "file", "snapshot_date", "teryt", "notes", "stats")}


# --------------------------------------------------------------------------- adapters
def _official_csv(src: Source, *, name_from_location: bool = False) -> list[dict]:
    res = validate_file((SRC / src.file).read_bytes(), src.file, strict=False, defaults={
        "dysponent_nazwa": src.publisher, "status": "aktywny",
        "data_aktualizacji": f"{src.snapshot_date}T00:00:00+01:00",
    })
    src.stats = {"rows": res.summary["rows"], "fixes": res.summary["fixes"],
                 "mapping": [f"{m.source} → {m.target or '—'}" for m in res.mapping]}
    missing = sorted({i.field for i in res.issues if i.row == 0 and "brak kolumny" in i.message})
    if missing:
        src.notes.append("brak pól obowiązkowych w źródle: " + ", ".join(missing))
    src.notes.extend(sorted({i.message for i in res.issues if i.level == "fix" and i.row == 0}))
    fixes = sorted({i.message for i in res.issues if i.level == "fix" and i.row > 0})
    src.notes.extend(f"auto-poprawka: {m}" for m in fixes)
    out = []
    for i, rec in enumerate(res.records, 1):
        if name_from_location and N.slug(rec["nazwa"]) in {"defibrylator", "aed", ""}:
            rec["nazwa"] = rec["lokalizacja_opis"] or rec["nazwa"]
        if not rec["id_aed"]:
            rec["id_aed"] = f"{src.key}-{i:03d}"
        out.append(rec)
    return out


def adapter_krosno(src: Source) -> list[dict]:
    return _official_csv(src, name_from_location=True)


def adapter_marki(src: Source) -> list[dict]:
    return _official_csv(src, name_from_location=True)


def adapter_legionowo(src: Source) -> list[dict]:
    recs = _official_csv(src)
    for r in recs:
        if not r["lokalizacja_opis"]:
            r["lokalizacja_opis"] = ""
    return recs


def adapter_przemysl(src: Source) -> list[dict]:
    """GML 2 feature collection exported from the city's CMS."""
    tree = etree.parse(str(SRC / src.file))
    ns = {"gml": "http://www.opengis.net/gml"}
    headers = ["id", "nazwa", "lat", "lon", "miejscowosc", "ulica", "nr_budynku", "kod_pocztowy", "zdjecie"]
    rows = []
    for fm in tree.findall(".//gml:featureMember", ns):
        def t(tag: str) -> str:
            el = fm.find(f"gml:{tag}", ns)
            return (el.text or "").strip() if el is not None and el.text else ""
        pos = t("Point/gml:pos").split()
        lat, lon = (pos + ["", ""])[:2]
        img = fm.find(".//gml:gallery-item/gml:url", ns)
        street = t("street")
        rows.append([t("id"), t("name"), lat, lon, t("city"), f"ul. {street}" if street else "", t("home_number"),
                     t("postcode"), img.text if img is not None else ""])
    res = validate_rows(headers, rows, strict=False, defaults={
        "dysponent_nazwa": src.publisher, "status": "aktywny", "data_aktualizacji": f"{src.snapshot_date}T00:00:00+01:00"})
    src.stats = {"rows": len(rows), "fixes": res.summary["fixes"], "mapping": ["GML featureMember → rekord"]}
    missing = sorted({i.field for i in res.issues if i.row == 0 and "brak kolumny" in i.message})
    src.notes = ["format GML 2 (XML) – przekształcony do wzorcowego zakresu"] + (
        ["brak pól obowiązkowych w źródle: " + ", ".join(missing)] if missing else [])
    out = []
    for r in res.records:
        name = r["nazwa"]
        # "Defibrylator (AED 9485) w ADM Centrum" -> place name + location
        if " w " in name:
            r["lokalizacja_opis"] = name
            r["nazwa"] = name.split(" w ", 1)[1].strip()
        r["id_aed"] = f"przemysl-{r['id_aed']}"
        out.append(r)
    return out


OSM_ACCESS_UNKNOWN = {"unknown", ""}


def adapter_osm(src: Source) -> list[dict]:
    data = json.loads((SRC / src.file).read_text(encoding="utf-8"))
    out = []
    for f in data["features"]:
        p = f["properties"]
        lon, lat = f["geometry"]["coordinates"][:2]
        loc = p.get("defibrillator:location:pl") or p.get("defibrillator:location") or p.get("location") or ""
        name = p.get("name") or (p.get("description") if len(p.get("description", "")) < 80 else "") or p.get("operator") or ""
        street = p.get("addr:street", "")
        check, _ = N.parse_date(p.get("check_date") or p.get("survey:date") or "")
        lvl = N.parse_float((p.get("level") or "").split(";")[0])
        rec = {
            "id_aed": f"{p['@osm_type']}/{p['@osm_id']}",
            "nazwa": N.clean(name),
            "szerokosc_geograficzna": round(lat, 7), "dlugosc_geograficzna": round(lon, 7),
            "wojewodztwo": "", "kod_teryt_gminy": "",
            "miejscowosc": N.clean(p.get("addr:city") or p.get("addr:place") or ""),
            "kod_simc": N.clean(p.get("addr:city:simc", "")),
            "ulica": f"ul. {street}" if street and not street.lower().startswith(("al", "pl", "os", "ul", "rondo")) else street,
            "nr_budynku": N.clean(p.get("addr:housenumber", "")),
            "kod_pocztowy": N.clean(p.get("addr:postcode", "")),
            "lokalizacja_opis": N.clean(loc)[:500],
            "kondygnacja": int(lvl) if lvl is not None and lvl == int(lvl) else "",
            "wewnatrz_budynku": N.parse_bool(p.get("indoor", "")),
            "dostepnosc": N.norm_access(p.get("access", "")),
            "godziny_dostepnosci": N.clean(p.get("opening_hours", "")),
            "szafka_zamknieta": N.parse_bool(p.get("locked", "")),
            "instrukcja_dostepu": "",
            "dostosowanie_dla_wozkow": N.norm_wheelchair(p.get("wheelchair", "")),
            "status": "aktywny",
            "producent": N.clean(p.get("manufacturer", "")), "model": N.clean(p.get("model", "")),
            "tryb_pediatryczny": "",
            "data_ostatniego_przegladu": "", "data_waznosci_elektrod": "", "data_waznosci_baterii": "",
            "dysponent_nazwa": N.clean(p.get("operator", "")), "dysponent_regon": "",
            "kontakt_telefon": N.norm_phone(p.get("phone") or p.get("contact:phone") or p.get("emergency:phone") or ""),
            "kontakt_email": N.clean(p.get("email", "")),
            "data_weryfikacji": check, "data_aktualizacji": f"{src.snapshot_date}T00:00:00+01:00",
            "zdjecie_url": p.get("image", "") if p.get("image", "").startswith("http") else "",
            "uwagi": N.clean(p.get("note", "")),
            "_fixme": N.clean(p.get("fixme", "")),
        }
        out.append(rec)
    src.stats = {"rows": len(out), "fixes": 0, "mapping": ["tagi OSM emergency=defibrillator → pola schematu"]}
    return out


SOURCES: list[Source] = [
    Source(
        key="krosno", name="Defibrylatory zlokalizowane w Mieście Krosno", publisher="Gmina Miasto Krosno",
        kind="oficjalne", license="CC0-1.0", teryt="1861011",
        url="https://dane.gov.pl/pl/dataset/3624", download_url="https://api.dane.gov.pl/resources/54632/file",
        file="danegovpl_krosno.csv", snapshot_date="2024-02-19", adapter=adapter_krosno),
    Source(
        key="marki", name="Defibrylatory zlokalizowane na terenie Miasta Marki", publisher="Gmina Miasto Marki",
        kind="oficjalne", license="CC-BY-4.0", teryt="1434021",
        url="https://dane.gov.pl/pl/dataset/4955", download_url="https://api.dane.gov.pl/resources/68353/file",
        file="danegovpl_marki.csv", snapshot_date="2025-07-10", adapter=adapter_marki),
    Source(
        key="legionowo", name="Wykaz defibrylatorów AED wraz z ich lokalizacją w Legionowie",
        publisher="Gmina Miasto Legionowo", kind="oficjalne", license="CC0-1.0", teryt="1408011",
        url="https://dane.gov.pl/pl/dataset/40593", download_url="https://api.dane.gov.pl/resources/2625221/file",
        file="danegovpl_legionowo.csv", snapshot_date="2026-09-14", adapter=adapter_legionowo),
    Source(
        key="przemysl", name="Lokalizacje AED – Automatycznych Defibrylatorów Zewnętrznych w Przemyślu",
        publisher="Gmina Miejska Przemyśl", kind="oficjalne", license="CC0-1.0", teryt="1862011",
        url="https://dane.gov.pl/pl/dataset/4581", download_url="https://api.dane.gov.pl/resources/62424/file",
        file="danegovpl_przemysl.gml", snapshot_date="2024-11-20", adapter=adapter_przemysl),
    Source(
        key="osm", name="OpenStreetMap – emergency=defibrillator (Polska)", publisher="Społeczność OpenStreetMap",
        kind="spolecznosciowe", license="ODbL-1.0",
        url="https://www.openstreetmap.org/copyright", download_url="https://overpass-api.de/api/interpreter",
        file="osm_polska.geojson", snapshot_date="2026-11-20", adapter=adapter_osm,
        notes=["Licencja ODbL nie znajduje się na liście licencji dane.gov.pl – rekordy OSM służą do weryfikacji, "
               "wskazania luk i zaproszenia dysponentów; do dane.gov.pl trafiają dane potwierdzone przez dysponentów."]),
]

# Known but not yet integrated (documented for the jury / next steps)
PENDING_SOURCES = [
    {"name": "Lokalizacja defibrylatorów (AED) – m.st. Warszawa", "publisher": "Urząd m.st. Warszawy",
     "url": "https://dane.gov.pl/pl/dataset/39512", "reason": "zasób wskazuje na API dane.um.warszawa.pl, które było niedostępne z sieci prototypu; "
     "113 rekordów OSM ma już powiązanie ref:api-um-warszawa-pl"},
]


def load_all() -> dict[str, list[dict]]:
    out = {}
    for s in SOURCES:
        s.notes = [n for n in s.notes if not n.startswith("auto-poprawka") and "cudzysłów" not in n]
        out[s.key] = s.adapter(s)
    return out
