"""Generates the reference data model deliverables from schema/aed_schema.yaml.

    python -m aed.build_schema

Outputs (schema/out/):
  wzorcowy_zakres_danych_AED.xlsx  – the contest deliverable (description, field table,
                                     dictionaries, example rows, fill-in template with dropdowns)
  aed.tableschema.json             – Frictionless Table Schema (machine-readable)
  aed.schema.json                  – JSON Schema for one record
  szablon_aed.csv                  – empty CSV template (header only)
  przyklad_aed.csv                 – example file that passes validation
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

from .schema import REQUIRED_LABELS, ROOT, TYPE_LABELS, Schema, load_schema

OUT = ROOT / "schema" / "out"

RED = "C8102E"
NAVY = "0B3D91"
LIGHT = "F3F5F8"
REQ_FILL = {"O": "FDE8EA", "Z": "E8EEF9", "F": "FFFFFF"}
THIN = Side(style="thin", color="C9CED6")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

TABLESCHEMA_TYPES = {"string": "string", "number": "number", "integer": "integer",
                     "boolean": "boolean", "date": "date", "datetime": "datetime"}

EXAMPLE_ROWS = [
    {
        "id_aed": "UM-LEG-001", "nazwa": "Urząd Miasta Legionowo",
        "szerokosc_geograficzna": 52.395198, "dlugosc_geograficzna": 20.931382,
        "wojewodztwo": "mazowieckie", "kod_teryt_gminy": "1408011", "miejscowosc": "Legionowo",
        "kod_simc": "0920806", "ulica": "ul. Piłsudskiego", "nr_budynku": "41", "kod_pocztowy": "05-120",
        "lokalizacja_opis": "Parter, hol główny, na ścianie po lewej od wejścia", "kondygnacja": 0,
        "wewnatrz_budynku": "tak", "dostepnosc": "ograniczony", "godziny_dostepnosci": "Mo 08:00-18:00; Tu-Fr 08:00-16:00",
        "szafka_zamknieta": "nie", "instrukcja_dostepu": "", "dostosowanie_dla_wozkow": "tak",
        "status": "aktywny", "producent": "Philips", "model": "HeartStart FRx", "tryb_pediatryczny": "tak",
        "data_ostatniego_przegladu": "2026-05-14", "data_waznosci_elektrod": "2028-01-31",
        "data_waznosci_baterii": "2029-06-30", "dysponent_nazwa": "Gmina Miasto Legionowo",
        "dysponent_regon": "013268657", "kontakt_telefon": "+48 22 766 40 00", "kontakt_email": "aed@legionowo.example.pl",
        "data_weryfikacji": "2026-10-02", "data_aktualizacji": "2026-10-02T12:00:00+02:00",
        "zdjecie_url": "", "uwagi": "",
    },
    {
        "id_aed": "UM-LEG-002", "nazwa": "Arena Legionowo",
        "szerokosc_geograficzna": 52.400177, "dlugosc_geograficzna": 20.917295,
        "wojewodztwo": "mazowieckie", "kod_teryt_gminy": "1408011", "miejscowosc": "Legionowo",
        "kod_simc": "0920806", "ulica": "ul. Chrobrego", "nr_budynku": "50B", "kod_pocztowy": "05-120",
        "lokalizacja_opis": "Na zewnątrz, szafka na elewacji przy wejściu głównym", "kondygnacja": "",
        "wewnatrz_budynku": "nie", "dostepnosc": "publiczny", "godziny_dostepnosci": "24/7",
        "szafka_zamknieta": "nie", "instrukcja_dostepu": "Szafka z alarmem dźwiękowym – otwiera się bez klucza",
        "dostosowanie_dla_wozkow": "tak", "status": "aktywny", "producent": "ZOLL", "model": "AED Plus",
        "tryb_pediatryczny": "nie", "data_ostatniego_przegladu": "2026-03-01", "data_waznosci_elektrod": "2027-11-30",
        "data_waznosci_baterii": "", "dysponent_nazwa": "Gmina Miasto Legionowo", "dysponent_regon": "013268657",
        "kontakt_telefon": "+48 22 766 40 00", "kontakt_email": "aed@legionowo.example.pl",
        "data_weryfikacji": "2026-09-20", "data_aktualizacji": "2026-09-20T09:30:00+02:00",
        "zdjecie_url": "", "uwagi": "",
    },
    {
        "id_aed": "SZK-SP3-01", "nazwa": "Szkoła Podstawowa nr 3",
        "szerokosc_geograficzna": 52.401135, "dlugosc_geograficzna": 20.940969,
        "wojewodztwo": "mazowieckie", "kod_teryt_gminy": "1408011", "miejscowosc": "Legionowo",
        "kod_simc": "0920806", "ulica": "ul. Kościuszki", "nr_budynku": "8A", "kod_pocztowy": "05-120",
        "lokalizacja_opis": "I piętro, pokój nauczycielski, szafka przy drzwiach", "kondygnacja": 1,
        "wewnatrz_budynku": "tak", "dostepnosc": "prywatny", "godziny_dostepnosci": "Mo-Fr 07:00-17:00",
        "szafka_zamknieta": "tak", "instrukcja_dostepu": "Klucz w sekretariacie (parter, pok. 2)",
        "dostosowanie_dla_wozkow": "ograniczone", "status": "serwis", "producent": "", "model": "",
        "tryb_pediatryczny": "tak", "data_ostatniego_przegladu": "2025-11-10", "data_waznosci_elektrod": "",
        "data_waznosci_baterii": "", "dysponent_nazwa": "Szkoła Podstawowa nr 3 w Legionowie",
        "dysponent_regon": "", "kontakt_telefon": "", "kontakt_email": "",
        "data_weryfikacji": "2026-06-30", "data_aktualizacji": "2026-11-02T08:00:00+01:00",
        "zdjecie_url": "", "uwagi": "Przegląd zaplanowany na grudzień",
    },
]


def _style_header(ws, row: int, ncols: int, fill: str = NAVY) -> None:
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=fill)
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        cell.border = BORDER


def _constraint_text(f, schema: Schema) -> str:
    parts = []
    c = f.constraints or {}
    if "pattern" in c:
        parts.append(f"wzorzec: {c['pattern']}")
    if "minimum" in c or "maximum" in c:
        parts.append(f"zakres: {c.get('minimum', '…')} – {c.get('maximum', '…')}")
    if "maxLength" in c:
        parts.append(f"maks. {c['maxLength']} znaków")
    if f.enum:
        parts.append("słownik: " + " / ".join(schema.enum_values(f.enum)))
    if f.format:
        parts.append(f"format: {f.format}")
    return "; ".join(parts)


def build_xlsx(schema: Schema, path: Path) -> None:
    groups = {g["key"]: g["label"] for g in schema.raw["groups"]}
    wb = Workbook()

    # --- 1. Opis ------------------------------------------------------------
    ws = wb.active
    ws.title = "Opis"
    ws["A1"] = schema.raw["title"]
    ws["A1"].font = Font(bold=True, size=16, color=RED)
    ws["A2"] = f"Wersja {schema.version} · akcja „GdzieAED” · {schema.raw['title_en']}"
    ws["A2"].font = Font(italic=True, color="555555")
    ws["A4"] = schema.raw["description"]
    ws["A4"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[4].height = 48
    ws["A6"] = "Zasady publikacji danych w portalu dane.gov.pl"
    ws["A6"].font = Font(bold=True, size=12, color=NAVY)
    r = 7
    for i, rule in enumerate(schema.raw["publishing_rules"], 1):
        ws.cell(row=r, column=1, value=f"{i}. {rule}").alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[r].height = 32
        r += 1
    r += 1
    ws.cell(row=r, column=1, value="Wymagalność pól").font = Font(bold=True, size=12, color=NAVY)
    for code, label in REQUIRED_LABELS.items():
        r += 1
        cell = ws.cell(row=r, column=1, value=f"{code} – {label}")
        cell.fill = PatternFill("solid", fgColor=REQ_FILL[code])
    r += 2
    ws.cell(row=r, column=1, value="Arkusze").font = Font(bold=True, size=12, color=NAVY)
    for name, desc in [
        ("Zakres danych", "opis wszystkich pól (nazwa, typ, wymagalność, format, przykład, odpowiednik w OpenStreetMap)"),
        ("Słowniki", "dozwolone wartości pól słownikowych"),
        ("Przykład", "przykładowe poprawne rekordy"),
        ("Szablon", "pusty arkusz do wypełnienia – z listami rozwijanymi; zapisz jako CSV UTF-8"),
        ("Metadane zbioru", "zalecane metadane zbioru danych w dane.gov.pl"),
    ]:
        r += 1
        ws.cell(row=r, column=1, value=f"• {name} – {desc}")
    ws.column_dimensions["A"].width = 130

    # --- 2. Zakres danych ---------------------------------------------------
    ws = wb.create_sheet("Zakres danych")
    headers = ["Lp.", "Grupa", "Nazwa pola", "Etykieta", "Opis", "Typ danych", "Wymagalność",
               "Format / ograniczenia", "Przykład", "Odpowiednik OSM"]
    ws.append(headers)
    _style_header(ws, 1, len(headers))
    for i, f in enumerate(schema.fields, 1):
        ws.append([i, groups[f.group], f.name, f.label, f.description, TYPE_LABELS[f.type],
                   f"{f.required} – {REQUIRED_LABELS[f.required]}", _constraint_text(f, schema),
                   str(f.example), f.osm])
        row = ws.max_row
        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=row, column=c)
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            cell.border = BORDER
            cell.fill = PatternFill("solid", fgColor=REQ_FILL[f.required])
        ws.cell(row=row, column=3).font = Font(bold=True, name="Consolas")
    for col, w in zip("ABCDEFGHIJ", [5, 14, 28, 30, 60, 18, 16, 38, 28, 26]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "D2"
    ws.auto_filter.ref = f"A1:J{ws.max_row}"
    r = ws.max_row + 2
    ws.cell(row=r, column=3, value="Pola dodawane przez agregator (zbiór ogólnopolski)").font = Font(bold=True, color=NAVY)
    for a in schema.aggregate_fields:
        r += 1
        ws.cell(row=r, column=3, value=a["name"]).font = Font(name="Consolas")
        ws.cell(row=r, column=4, value=a["label"])
        ws.cell(row=r, column=5, value=a["description"]).alignment = Alignment(wrap_text=True)
        ws.cell(row=r, column=6, value=TYPE_LABELS[a["type"]])

    # --- 3. Słowniki --------------------------------------------------------
    ws = wb.create_sheet("Słowniki")
    ws.append(["Słownik", "Wartość", "Znaczenie", "Odpowiednik OSM"])
    _style_header(ws, 1, 4)
    for name, values in schema.enums.items():
        for v in values:
            ws.append([name, v["value"], v.get("label", v["value"]), v.get("osm", "")])
            for c in range(1, 5):
                ws.cell(row=ws.max_row, column=c).border = BORDER
    for col, w in zip("ABCD", [22, 22, 70, 24]):
        ws.column_dimensions[col].width = w

    # hidden lists sheet used by data validation
    lists = wb.create_sheet("_listy")
    list_ranges: dict[str, str] = {}
    for ci, (name, values) in enumerate(schema.enums.items(), 1):
        col = get_column_letter(ci)
        lists.cell(row=1, column=ci, value=name)
        for ri, v in enumerate(values, 2):
            lists.cell(row=ri, column=ci, value=str(v["value"]))
        list_ranges[name] = f"_listy!${col}$2:${col}${len(values) + 1}"
    lists.sheet_state = "hidden"

    # --- 4. Przykład / 5. Szablon -------------------------------------------
    for title, rows in (("Przykład", EXAMPLE_ROWS), ("Szablon", [])):
        ws = wb.create_sheet(title)
        ws.append(schema.field_names)
        _style_header(ws, 1, len(schema.fields), fill=RED)
        ws.append([f.label for f in schema.fields])
        for c, f in enumerate(schema.fields, 1):
            cell = ws.cell(row=2, column=c)
            cell.font = Font(italic=True, size=9, color="555555")
            cell.fill = PatternFill("solid", fgColor=REQ_FILL[f.required])
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            ws.column_dimensions[get_column_letter(c)].width = max(14, min(36, len(f.name) + 4))
        for row in rows:
            ws.append([row.get(n, "") for n in schema.field_names])
        ws.freeze_panes = "C3"
        if title == "Szablon":
            for c, f in enumerate(schema.fields, 1):
                if f.enum:
                    dv = DataValidation(type="list", formula1=list_ranges[f.enum], allow_blank=not f.mandatory,
                                        showErrorMessage=True, errorTitle="Niedozwolona wartość",
                                        error=f"Wybierz wartość ze słownika „{f.enum}”.")
                    ws.add_data_validation(dv)
                    col = get_column_letter(c)
                    dv.add(f"{col}3:{col}2000")
            ws.cell(row=3, column=1).value = None

    # --- 6. Metadane zbioru -------------------------------------------------
    ws = wb.create_sheet("Metadane zbioru")
    ws.append(["Element metadanych", "Zalecana wartość"])
    _style_header(ws, 1, 2)
    md = schema.raw["dataset_metadata"]
    for k, label in [("title", "Tytuł zbioru"), ("notes", "Opis"), ("category", "Kategoria (kod)"),
                     ("keywords", "Słowa kluczowe"), ("update_frequency", "Częstotliwość aktualizacji"),
                     ("license", "Licencja")]:
        v = md[k]
        ws.append([label, ", ".join(v) if isinstance(v, list) else v])
    ws.append(["Format zasobu", "CSV (UTF-8) + opcjonalnie GeoJSON/JSON; zasób z automatyczną aktualizacją pod stałym URL"])
    ws.append(["Schemat", "Wskazanie na aed.tableschema.json (Frictionless Table Schema) w opisie zasobu"])
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            cell.border = BORDER
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 100

    wb.move_sheet("_listy", offset=10)
    wb.save(path)


def build_tableschema(schema: Schema) -> dict:
    fields = []
    for f in schema.fields:
        d = {"name": f.name, "title": f.label, "description": f.description,
             "type": TABLESCHEMA_TYPES[f.type], "constraints": {}}
        if f.type == "boolean":
            d["trueValues"], d["falseValues"] = ["tak"], ["nie"]
        if f.format:
            d["format"] = f.format
        if f.mandatory:
            d["constraints"]["required"] = True
        for k, v in (f.constraints or {}).items():
            d["constraints"][k] = v
        if f.enum and f.type != "boolean":
            d["constraints"]["enum"] = schema.enum_values(f.enum)
        if not d["constraints"]:
            del d["constraints"]
        d["example"] = f.example
        fields.append(d)
    return {
        "$schema": "https://specs.frictionlessdata.io/schemas/table-schema.json",
        "name": schema.raw["id"], "title": schema.raw["title"], "version": schema.version,
        "description": schema.raw["description"],
        "fields": fields, "primaryKey": ["id_aed"], "missingValues": [""],
    }


def build_jsonschema(schema: Schema) -> dict:
    props = {}
    for f in schema.fields:
        p: dict = {"title": f.label, "description": f.description}
        t = f.type
        if t == "date":
            p.update(type="string", format="date")
        elif t == "datetime":
            p.update(type="string", format="date-time")
        elif t == "boolean":
            p.update(type="string", enum=["tak", "nie"])
        else:
            p["type"] = t
        c = f.constraints or {}
        for k in ("minimum", "maximum", "maxLength", "pattern"):
            if k in c:
                p[k] = c[k]
        if f.enum and t != "boolean":
            p["enum"] = schema.enum_values(f.enum)
        if f.format:
            p["format"] = f.format
        p["examples"] = [f.example]
        props[f.name] = p
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://gdzieaed.example/schema/aed.schema.json",
        "title": schema.raw["title"], "description": schema.raw["description"], "type": "object",
        "properties": props, "required": [f.name for f in schema.fields if f.mandatory],
        "additionalProperties": False,
    }


def main() -> None:
    schema = load_schema()
    OUT.mkdir(parents=True, exist_ok=True)
    build_xlsx(schema, OUT / "wzorcowy_zakres_danych_AED.xlsx")
    (OUT / "aed.tableschema.json").write_text(json.dumps(build_tableschema(schema), ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "aed.schema.json").write_text(json.dumps(build_jsonschema(schema), ensure_ascii=False, indent=2), encoding="utf-8")
    with open(OUT / "szablon_aed.csv", "w", newline="", encoding="utf-8") as fh:
        csv.writer(fh).writerow(schema.field_names)
    with open(OUT / "przyklad_aed.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=schema.field_names)
        w.writeheader()
        w.writerows(EXAMPLE_ROWS)
    print(f"Schema {schema.version}: {len(schema.fields)} fields → {OUT}")


if __name__ == "__main__":
    main()
