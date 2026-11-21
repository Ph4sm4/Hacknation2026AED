"""Population and area of gminas (GUS) – denominator for the coverage ranking.

Source: GUS, „Powierzchnia i ludność w przekroju terytorialnym w 2024 roku”, Tabl. 21
(stan na 1.01.2024). One-time extraction of the xlsx into a small CSV kept in the repo:

    python -m aed.gus path/to/powierzchnia_i_ludnosc_..._tablice.xlsx
"""
from __future__ import annotations

import csv
import re
import sys
from functools import lru_cache

from .schema import ROOT

CSV_PATH = ROOT / "data" / "sources" / "gus_gminy_2024.csv"
SOURCE = ("GUS, Powierzchnia i ludność w przekroju terytorialnym w 2024 roku, Tabl. 21 (stan na 1.01.2024), "
          "https://stat.gov.pl/obszary-tematyczne/ludnosc/ludnosc/"
          "powierzchnia-i-ludnosc-w-przekroju-terytorialnym-w-2024-roku,7,21.html")
FIELDS = ["teryt", "gmina", "rodzaj", "powiat", "wojewodztwo", "powierzchnia_km2", "ludnosc"]
RODZAJ = {"1": "miejska", "2": "wiejska", "3": "miejsko-wiejska"}

_CODE = re.compile(r"^(\d{6})\s*(\d)$")


def extract(xlsx_path: str) -> list[dict]:
    from openpyxl import load_workbook

    ws = load_workbook(xlsx_path, read_only=True)["Tabl. 21"]
    woj = powiat = ""
    out = []
    for row in ws.iter_rows(values_only=True):
        code, label = (str(row[0] or "").strip(), str(row[1] or "").strip())
        if not code:
            if label.upper().startswith("WOJ."):
                woj = label[4:].strip().lower()
            elif label.lower().startswith("powiat"):
                powiat = re.sub(r"\s*\(.*\)$", "", label).strip()
            continue
        m = _CODE.match(code)
        if not m or m.group(2) not in RODZAJ:  # skip towns / rural parts (4, 5) of urban-rural gminas
            continue
        name = re.sub(r"\s*\([a-z]{1,3}\)$", "", label.rstrip(". ").strip())  # drop footnote marks like "(a)", "(ab)"
        city_county = int(m.group(1)[2:4]) >= 61  # TERYT county codes 61+ = cities with county rights
        out.append({
            "teryt": m.group(1) + m.group(2),
            "gmina": name,
            "rodzaj": RODZAJ[m.group(2)],
            "powiat": f"powiat m. {name.removeprefix('M.st. ')}" if city_county else powiat[:1].lower() + powiat[1:],
            "wojewodztwo": woj,
            "powierzchnia_km2": row[4],
            "ludnosc": row[5],
        })
    return out


@lru_cache(maxsize=1)
def load_gminy() -> dict[str, dict]:
    """TERYT (7 digits) → gmina row. Empty when the CSV has not been extracted."""
    if not CSV_PATH.exists():
        return {}
    with open(CSV_PATH, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    for r in rows:
        r["ludnosc"] = int(r["ludnosc"])
        r["powierzchnia_km2"] = float(r["powierzchnia_km2"])
    return {r["teryt"]: r for r in rows}


def main() -> None:
    rows = extract(sys.argv[1])
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} gmin · ludność {sum(int(r['ludnosc']) for r in rows):,} → {CSV_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
