"""Universal import + validation engine.

Takes any tabular AED file a data holder already has (CSV in any encoding/separator, XLSX,
JSON, GeoJSON), maps its columns to the reference schema, normalises values, auto-fixes
common mistakes and reports every problem per row and field.

The same engine is used to ingest the official sources found on dane.gov.pl – so the
prototype proves on real files that heterogeneous data can be brought to one standard.
"""
from __future__ import annotations

import csv
import io
import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Iterable

from openpyxl import load_workbook

from . import normalize as N
from .schema import Field, Schema, load_schema

# --------------------------------------------------------------------------- mapping
# slugged source header -> schema field (or a virtual field handled specially)
SYNONYMS: dict[str, str] = {
    # identyfikacja
    "id": "id_aed", "numer_id": "id_aed", "nr": "id_aed", "lp": "id_aed", "identyfikator": "id_aed",
    "ref": "id_aed", "kod": "id_aed", "numer": "id_aed", "id_urzadzenia": "id_aed",
    "nazwa_obiektu": "nazwa", "obiekt": "nazwa", "name": "nazwa", "miejsce": "nazwa", "nazwa_miejsca": "nazwa",
    "nazwa_placowki": "nazwa", "instytucja": "nazwa",
    # lokalizacja
    "lat": "szerokosc_geograficzna", "latitude": "szerokosc_geograficzna", "szerokosc": "szerokosc_geograficzna",
    "y": "szerokosc_geograficzna", "wsp_y": "szerokosc_geograficzna", "szer_geogr": "szerokosc_geograficzna",
    "lon": "dlugosc_geograficzna", "lng": "dlugosc_geograficzna", "longitude": "dlugosc_geograficzna",
    "dlugosc": "dlugosc_geograficzna", "x": "dlugosc_geograficzna", "wsp_x": "dlugosc_geograficzna",
    "dl_geogr": "dlugosc_geograficzna",
    "miasto": "miejscowosc", "city": "miejscowosc", "addr_city": "miejscowosc", "gmina_miejscowosc": "miejscowosc",
    "street": "ulica", "addr_street": "ulica", "nazwa_ulicy": "_nazwa_ulicy", "cecha_ulicy": "_cecha_ulicy",
    "cecha": "_cecha_ulicy",
    "numer_budynku": "nr_budynku", "nr_domu": "nr_budynku", "numer_domu": "nr_budynku", "housenumber": "nr_budynku",
    "addr_housenumber": "nr_budynku", "home_number": "nr_budynku",
    "kod": "id_aed", "kod_poczt": "kod_pocztowy", "postcode": "kod_pocztowy", "addr_postcode": "kod_pocztowy",
    "kod_terc": "kod_teryt_gminy", "teryt": "kod_teryt_gminy", "terc": "kod_teryt_gminy",
    "simc": "kod_simc",
    "adres": "_adres", "address": "_adres", "adres_pelny": "_adres",
    "lokalizacja": "lokalizacja_opis", "opis_lokalizacji": "lokalizacja_opis", "miejsce_umieszczenia": "lokalizacja_opis",
    "defibrillator_location": "lokalizacja_opis", "umiejscowienie": "lokalizacja_opis", "lokalizacja_aed": "lokalizacja_opis",
    "pietro": "kondygnacja", "level": "kondygnacja", "poziom": "kondygnacja",
    "indoor": "wewnatrz_budynku", "wewnatrz": "wewnatrz_budynku", "w_budynku": "wewnatrz_budynku",
    "wojewodztwo_nazwa": "wojewodztwo",
    # dostępność
    "access": "dostepnosc", "dostep": "dostepnosc", "rodzaj_dostepu": "dostepnosc",
    "opening_hours": "godziny_dostepnosci", "godziny": "godziny_dostepnosci", "godziny_otwarcia": "godziny_dostepnosci",
    "dostepny_w_godzinach": "godziny_dostepnosci",
    "locked": "szafka_zamknieta", "zamkniety": "szafka_zamknieta", "szafka": "szafka_zamknieta",
    "wheelchair": "dostosowanie_dla_wozkow",
    # urządzenie
    "manufacturer": "producent", "marka": "producent", "typ": "model",
    "pediatric": "tryb_pediatryczny", "elektrody_pediatryczne": "tryb_pediatryczny",
    "check_date": "data_weryfikacji", "data_przegladu": "data_ostatniego_przegladu", "przeglad": "data_ostatniego_przegladu",
    # dysponent
    "operator": "dysponent_nazwa", "dysponent": "dysponent_nazwa", "wlasciciel": "dysponent_nazwa",
    "zarzadca": "dysponent_nazwa", "regon": "dysponent_regon",
    "phone": "kontakt_telefon", "telefon": "kontakt_telefon", "tel": "kontakt_telefon",
    "email": "kontakt_email", "e_mail": "kontakt_email", "mail": "kontakt_email",
    # meta
    "image": "zdjecie_url", "zdjecie": "zdjecie_url", "foto": "zdjecie_url", "url_zdjecia": "zdjecie_url",
    "description": "uwagi", "opis": "uwagi", "note": "uwagi", "notatka": "uwagi",
    "data_modyfikacji": "data_aktualizacji", "aktualizacja": "data_aktualizacji",
}
NAME_LIKE = {"nazwa"}


@dataclass
class Issue:
    row: int          # 1-based data row number (0 = file level)
    field: str
    level: str        # error | warning | fix
    message: str
    value: str = ""


@dataclass
class ColumnMapping:
    source: str
    target: str | None
    method: str       # exact | synonym | derived | ignored


@dataclass
class ValidationResult:
    records: list[dict]
    issues: list[Issue] = field(default_factory=list)
    mapping: list[ColumnMapping] = field(default_factory=list)
    detected: dict = field(default_factory=dict)

    @property
    def summary(self) -> dict:
        err_rows = {i.row for i in self.issues if i.level == "error" and i.row > 0}
        file_errors = [i for i in self.issues if i.level == "error" and i.row == 0]
        n = len(self.records)
        valid = 0 if file_errors else n - len(err_rows)
        return {
            "rows": n,
            "valid_rows": valid,
            "invalid_rows": n - valid,
            "errors": sum(1 for i in self.issues if i.level == "error"),
            "warnings": sum(1 for i in self.issues if i.level == "warning"),
            "fixes": sum(1 for i in self.issues if i.level == "fix"),
            "mapped_columns": sum(1 for m in self.mapping if m.target),
            "unmapped_columns": [m.source for m in self.mapping if not m.target],
            "conformity": round(100 * valid / n) if n else 0,
        }

    def to_dict(self, preview: int | None = 50) -> dict:
        return {
            "summary": self.summary,
            "detected": self.detected,
            "mapping": [asdict(m) for m in self.mapping],
            "issues": [asdict(i) for i in self.issues[:2000]],
            "records": self.records if preview is None else self.records[:preview],
        }


# --------------------------------------------------------------------------- parsing
def _decode(data: bytes) -> tuple[str, str]:
    for enc in ("utf-8-sig", "utf-8"):
        try:
            return data.decode(enc), "UTF-8" + (" (BOM)" if data.startswith(b"\xef\xbb\xbf") else "")
        except UnicodeDecodeError:
            pass
    return data.decode("cp1250", errors="replace"), "Windows-1250"


def _parse_csv(text: str) -> tuple[list[str], list[list[str]], dict]:
    sample = text[:5000]
    try:
        delim = csv.Sniffer().sniff(sample, delimiters=",;\t|").delimiter
    except csv.Error:
        delim = ";" if sample.count(";") > sample.count(",") else ","
    rows = [r for r in csv.reader(io.StringIO(text), delimiter=delim) if any(c.strip() for c in r)]
    info = {"separator": {",": "przecinek", ";": "średnik", "\t": "tabulator", "|": "kreska pionowa"}[delim]}
    # Whole lines wrapped in quotes ("a,b,""c""") – seen in real dane.gov.pl files.
    if rows and all(len(r) == 1 for r in rows[:5]) and delim in rows[0][0]:
        rows = [next(csv.reader([r[0]], delimiter=delim, skipinitialspace=True)) for r in rows]
        info["wrapped_lines"] = True
    if not rows:
        return [], [], info
    return [h.strip() for h in rows[0]], rows[1:], info


def _parse_xlsx(data: bytes) -> tuple[list[str], list[list[Any]], dict]:
    wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = [list(r) for r in ws.iter_rows(values_only=True) if any(c not in (None, "") for c in r)]
    if not rows:
        return [], [], {"sheet": ws.title}
    header = [str(h or "").strip() for h in rows[0]]
    body = rows[1:]
    # Our own template has a second, human-readable label row – skip it.
    schema = load_schema()
    if body and [str(c or "") for c in body[0][: len(schema.fields)]] == [f.label for f in schema.fields][: len(body[0])]:
        body = body[1:]
    return header, body, {"sheet": ws.title}


def _parse_json(text: str) -> tuple[list[str], list[list[Any]], dict]:
    data = json.loads(text)
    items: list[dict]
    info: dict = {}
    if isinstance(data, dict) and data.get("type") == "FeatureCollection":
        items = []
        for f in data.get("features", []):
            props = dict(f.get("properties") or {})
            geom = f.get("geometry") or {}
            if geom.get("type") == "Point":
                lon, lat = geom["coordinates"][:2]
                props.setdefault("szerokosc_geograficzna", lat)
                props.setdefault("dlugosc_geograficzna", lon)
            items.append(props)
        info["geojson"] = True
    elif isinstance(data, dict):
        items = next((v for v in data.values() if isinstance(v, list)), [])
    else:
        items = data
    header: list[str] = []
    for it in items:
        for k in it:
            if k not in header:
                header.append(k)
    return header, [[it.get(h) for h in header] for it in items], info


def read_table(data: bytes, filename: str) -> tuple[list[str], list[list[Any]], dict]:
    name = filename.lower()
    if name.endswith((".xlsx", ".xlsm")) or data[:2] == b"PK":
        h, r, info = _parse_xlsx(data)
        info["format"] = "XLSX"
        return h, r, info
    text, enc = _decode(data)
    if name.endswith((".json", ".geojson")) or text.lstrip()[:1] in "[{":
        h, r, info = _parse_json(text)
        info.update(format="GeoJSON" if info.get("geojson") else "JSON", encoding=enc)
        return h, r, info
    h, r, info = _parse_csv(text)
    info.update(format="CSV", encoding=enc)
    return h, r, info


# --------------------------------------------------------------------------- mapping
def map_columns(headers: Iterable[str], schema: Schema, overrides: dict[str, str] | None = None) -> list[ColumnMapping]:
    names = set(schema.field_names)
    out, used = [], set()
    overrides = overrides or {}
    for h in headers:
        s = N.slug(h)
        if h in overrides:
            tgt, method = overrides[h] or None, "manual"
        elif s in names:
            tgt, method = s, "exact"
        elif s in SYNONYMS:
            tgt, method = SYNONYMS[s], "synonym"
        else:
            tgt, method = None, "ignored"
        if tgt and not tgt.startswith("_") and tgt in used:
            tgt, method = None, "ignored"  # first wins
        if tgt:
            used.add(tgt)
        out.append(ColumnMapping(source=h, target=tgt, method="derived" if tgt and tgt.startswith("_") else method))
    return out


# --------------------------------------------------------------------------- validation
def _check(f: Field, raw: Any, schema: Schema, rown: int, issues: list[Issue]) -> Any:
    """Normalise one value; append issues. Returns the normalised value ('' if missing)."""
    v = N.clean(raw)
    if v == "":
        return ""
    c = f.constraints or {}
    if f.type == "number":
        x = N.parse_float(raw)
        if x is None:
            issues.append(Issue(rown, f.name, "error", "wartość nie jest liczbą", v))
            return ""
        if "," in v:
            issues.append(Issue(rown, f.name, "fix", "zamieniono przecinek dziesiętny na kropkę", v))
        return round(x, 7)
    if f.type == "integer":
        x = N.parse_float(raw)
        if x is None or x != int(x):
            issues.append(Issue(rown, f.name, "error", "wartość nie jest liczbą całkowitą", v))
            return ""
        x = int(x)
        if ("minimum" in c and x < c["minimum"]) or ("maximum" in c and x > c["maximum"]):
            issues.append(Issue(rown, f.name, "error", f"wartość spoza zakresu {c.get('minimum')}–{c.get('maximum')}", v))
            return ""
        return x
    if f.type == "boolean":
        b = N.parse_bool(raw)
        if not b:
            issues.append(Issue(rown, f.name, "error", "dozwolone wartości: tak / nie", v))
        elif b != v:
            issues.append(Issue(rown, f.name, "fix", f"ujednolicono „{v}” → „{b}”", v))
        return b
    if f.type == "date":
        d, changed = N.parse_date(raw)
        if not d:
            issues.append(Issue(rown, f.name, "error", "niepoprawna data – wymagany format RRRR-MM-DD", v))
        elif changed:
            issues.append(Issue(rown, f.name, "fix", f"zmieniono format daty na ISO 8601 ({d})", v))
        return d
    if f.type == "datetime":
        d, changed = N.parse_datetime(raw)
        if not d:
            issues.append(Issue(rown, f.name, "error", "niepoprawna data i czas – wymagany ISO 8601", v))
        elif changed:
            issues.append(Issue(rown, f.name, "fix", "uzupełniono datę do formatu ISO 8601 ze strefą czasową", v))
        return d
    # strings
    if f.name == "dostepnosc":
        a = N.norm_access(v)
        if not a:
            issues.append(Issue(rown, f.name, "error", "dozwolone: publiczny / ograniczony / prywatny", v))
        elif a != v:
            issues.append(Issue(rown, f.name, "fix", f"ujednolicono „{v}” → „{a}”", v))
        return a
    if f.name == "dostosowanie_dla_wozkow":
        a = N.norm_wheelchair(v)
        if not a:
            issues.append(Issue(rown, f.name, "warning", "dozwolone: tak / ograniczone / nie", v))
        return a
    if f.name == "kod_pocztowy":
        v2 = N.norm_postcode(v)
        if v2 != v:
            issues.append(Issue(rown, f.name, "fix", f"ujednolicono kod pocztowy → {v2}", v))
        v = v2
    if f.name == "kontakt_telefon":
        v2 = N.norm_phone(v)
        if v2 != v:
            issues.append(Issue(rown, f.name, "fix", "ujednolicono numer telefonu do formatu +48", v))
        v = v2
    if f.name == "kod_teryt_gminy" and re.fullmatch(r"\d{6}", v):
        issues.append(Issue(rown, f.name, "warning", "kod TERC ma 6 cyfr – brakuje cyfry rodzaju gminy (7. znak)", v))
        return ""
    if f.name == "kod_simc" and re.fullmatch(r"\d{6}", v):
        v = v.zfill(7)
    if f.enum:
        allowed = schema.enum_values(f.enum)
        match = next((a for a in allowed if N.slug(a) == N.slug(v)), None)
        if match is None:
            issues.append(Issue(rown, f.name, "error", "wartość spoza słownika: " + ", ".join(allowed), v))
            return ""
        if match != v:
            issues.append(Issue(rown, f.name, "fix", f"ujednolicono „{v}” → „{match}”", v))
        v = match
    if "pattern" in c and not re.fullmatch(c["pattern"], v):
        issues.append(Issue(rown, f.name, "error", f"niezgodne z wzorcem {c['pattern']}", v))
        return ""
    if "maxLength" in c and len(v) > c["maxLength"]:
        issues.append(Issue(rown, f.name, "warning", f"przycięto do {c['maxLength']} znaków", v[:40] + "…"))
        v = v[: c["maxLength"]]
    if f.format == "email" and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v):
        issues.append(Issue(rown, f.name, "error", "niepoprawny adres e-mail", v))
        return ""
    if f.format == "uri" and not re.match(r"^https?://", v):
        issues.append(Issue(rown, f.name, "warning", "adres URL powinien zaczynać się od https://", v))
    if f.name == "godziny_dostepnosci" and not N.valid_opening_hours(v):
        issues.append(Issue(rown, f.name, "warning", "nie rozpoznano składni opening_hours (np. „24/7”, „Mo-Fr 08:00-16:00”)", v))
    return v


def validate_rows(headers: list[str], rows: list[list[Any]], *, defaults: dict | None = None,
                  overrides: dict[str, str] | None = None, strict: bool = True,
                  schema: Schema | None = None) -> ValidationResult:
    """strict=True – holder mode: mandatory fields are errors. strict=False – aggregator mode: warnings."""
    schema = schema or load_schema()
    mapping = map_columns(headers, schema, overrides)
    defaults = {k: v for k, v in (defaults or {}).items() if N.clean(v) != ""}
    issues: list[Issue] = []
    records: list[dict] = []
    mapped_targets = {m.target for m in mapping if m.target}

    missing_cols = [f.name for f in schema.fields if f.mandatory and f.name not in mapped_targets
                    and f.name not in defaults
                    and not (f.name in {"ulica", "nr_budynku", "kod_pocztowy", "miejscowosc"} and "_adres" in mapped_targets)]
    for name in missing_cols:
        issues.append(Issue(0, name, "error" if strict else "warning",
                            f"brak kolumny obowiązkowej „{name}” – dodaj kolumnę lub ustaw wartość domyślną"))

    for idx, row in enumerate(rows, 1):
        src = {m.target: (row[i] if i < len(row) else None) for i, m in enumerate(mapping) if m.target}
        rec_issues: list[Issue] = []
        # derived/virtual columns
        if "_adres" in src:
            parts = N.split_address(N.clean(src.pop("_adres")))
            for k, v in parts.items():
                src.setdefault(k, v)
        if "_nazwa_ulicy" in src:
            src.setdefault("ulica", N.street_with_prefix(N.clean(src.pop("_cecha_ulicy", "")), N.clean(src.pop("_nazwa_ulicy"))))
        src.pop("_cecha_ulicy", None)
        for k, v in defaults.items():
            if N.clean(src.get(k)) == "":
                src[k] = v
        rec: dict[str, Any] = {}
        for f in schema.fields:
            rec[f.name] = _check(f, src.get(f.name), schema, idx, rec_issues)
        # coordinates: swapped / outside Poland
        lat, lon = rec["szerokosc_geograficzna"], rec["dlugosc_geograficzna"]
        if lat != "" and lon != "":
            lat2, lon2, fix = N.fix_coordinates(lat, lon)
            if fix:
                rec_issues.append(Issue(idx, "szerokosc_geograficzna", "fix", fix, f"{lat}, {lon}"))
                rec["szerokosc_geograficzna"], rec["dlugosc_geograficzna"] = lat2, lon2
            elif not N.in_poland(lat, lon):
                rec_issues.append(Issue(idx, "szerokosc_geograficzna", "error", "współrzędne poza granicami Polski", f"{lat}, {lon}"))
        # conditional rules
        if rec["szafka_zamknieta"] == "tak" and not rec["instrukcja_dostepu"]:
            rec_issues.append(Issue(idx, "instrukcja_dostepu", "warning", "szafka zamknięta – podaj, jak uzyskać dostęp (klucz/kod)"))
        # mandatory values
        for f in schema.fields:
            if f.mandatory and rec[f.name] == "" and f.name not in missing_cols:
                if not any(i.field == f.name and i.level == "error" for i in rec_issues):
                    rec_issues.append(Issue(idx, f.name, "error" if strict else "warning", "brak wartości obowiązkowej"))
        issues.extend(rec_issues)
        records.append(rec)
    return ValidationResult(records=records, issues=issues, mapping=mapping)


def validate_file(data: bytes, filename: str, **kw) -> ValidationResult:
    try:
        headers, rows, info = read_table(data, filename)
    except Exception as exc:  # noqa: BLE001 – report any parse problem to the user
        return ValidationResult(records=[], issues=[Issue(0, "", "error", f"nie udało się odczytać pliku: {exc}")],
                                detected={"filename": filename})
    res = validate_rows(headers, rows, **kw)
    res.detected = {"filename": filename, **info, "columns": len(headers)}
    if info.get("wrapped_lines"):
        res.issues.insert(0, Issue(0, "", "fix", "całe wiersze były ujęte w cudzysłów – poprawiono strukturę CSV"))
    if info.get("encoding") == "Windows-1250":
        res.issues.insert(0, Issue(0, "", "warning", "plik w kodowaniu Windows-1250 – dane.gov.pl wymaga UTF-8 (przekonwertowano)"))
    return res


def records_to_csv(records: list[dict], schema: Schema | None = None) -> str:
    schema = schema or load_schema()
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=schema.field_names, extrasaction="ignore", lineterminator="\n")
    w.writeheader()
    w.writerows(records)
    return buf.getvalue()
