"""Value normalisation helpers shared by source adapters and the upload validator."""
from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Warsaw")

PL_LAT = (49.0, 54.9)
PL_LON = (14.1, 24.2)


def slug(s: str) -> str:
    """'Długość geograficzna ' -> 'dlugosc_geograficzna'."""
    s = unicodedata.normalize("NFKD", str(s).replace("ł", "l").replace("Ł", "L"))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-zA-Z0-9]+", "_", s.lower()).strip("_")
    return s


def clean(v) -> str:
    if v is None:
        return ""
    s = str(v).replace(" ", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return "" if s.lower() in {"-", "—", "brak", "b/d", "bd", "null", "none", "nan", "n/a"} else s


# ----------------------------------------------------------------- coordinates
def in_poland(lat: float, lon: float) -> bool:
    return PL_LAT[0] <= lat <= PL_LAT[1] and PL_LON[0] <= lon <= PL_LON[1]


def parse_float(v) -> float | None:
    s = clean(v).replace(",", ".").replace(" ", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def fix_coordinates(lat: float | None, lon: float | None) -> tuple[float | None, float | None, str | None]:
    """Returns (lat, lon, fix_message). Detects swapped lat/lon – a common error in source files."""
    if lat is None or lon is None:
        return lat, lon, None
    if in_poland(lat, lon):
        return lat, lon, None
    if in_poland(lon, lat):
        return lon, lat, "zamieniono miejscami szerokość i długość geograficzną"
    return lat, lon, None


# ----------------------------------------------------------------- simple types
BOOL_TRUE = {"tak", "t", "yes", "y", "true", "1", "prawda"}
BOOL_FALSE = {"nie", "n", "no", "false", "0", "falsz"}


def parse_bool(v) -> str:
    s = slug(clean(v))
    if s in BOOL_TRUE:
        return "tak"
    if s in BOOL_FALSE:
        return "nie"
    return ""


DATE_PATTERNS = [
    (re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})"), ("y", "m", "d")),
    (re.compile(r"^(\d{1,2})[./-](\d{1,2})[./-](\d{4})"), ("d", "m", "y")),
    (re.compile(r"^(\d{4})[./](\d{1,2})[./](\d{1,2})"), ("y", "m", "d")),
]


def parse_date(v) -> tuple[str, bool]:
    """Returns (iso_date, was_reformatted). Empty string if unparseable."""
    s = clean(v)
    if not s:
        return "", False
    if isinstance(v, (datetime, date)):
        return (v.date() if isinstance(v, datetime) else v).isoformat(), False
    for rx, order in DATE_PATTERNS:
        m = rx.match(s)
        if m:
            parts = dict(zip(order, map(int, m.groups())))
            try:
                iso = date(parts["y"], parts["m"], parts["d"]).isoformat()
            except ValueError:
                return "", False
            return iso, iso != s
    if re.fullmatch(r"\d{4}-\d{2}", s):  # OSM check_date sometimes YYYY-MM
        return f"{s}-01", True
    return "", False


def parse_datetime(v) -> tuple[str, bool]:
    s = clean(v)
    if not s:
        return "", False
    if isinstance(v, datetime):
        dt = v if v.tzinfo else v.replace(tzinfo=TZ)
        return dt.isoformat(timespec="seconds"), False
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if not dt.tzinfo:
            dt = dt.replace(tzinfo=TZ)
        out = dt.isoformat(timespec="seconds")
        return out, out != s
    except ValueError:
        d, _ = parse_date(s)
        if d:
            return datetime.fromisoformat(d).replace(tzinfo=TZ).isoformat(timespec="seconds"), True
    return "", False


def norm_postcode(v) -> str:
    s = re.sub(r"\D", "", clean(v))
    return f"{s[:2]}-{s[2:]}" if len(s) == 5 else clean(v)


def norm_phone(v) -> str:
    s = clean(v).split(";")[0].strip()
    if s.startswith("+") and re.fullmatch(r"\+[0-9 ()-]{9,20}", s):
        return s
    digits = re.sub(r"\D", "", s)
    if len(digits) == 9:
        return f"+48 {digits[:3]} {digits[3:6]} {digits[6:]}"
    if len(digits) == 11 and digits.startswith("48"):
        d = digits[2:]
        return f"+48 {d[:3]} {d[3:6]} {d[6:]}"
    return s


ACCESS_MAP = {
    "yes": "publiczny", "permissive": "publiczny", "public": "publiczny", "publiczny": "publiczny",
    "publiczna": "publiczny", "ogolnodostepny": "publiczny", "ogolnodostepna": "publiczny",
    "customers": "ograniczony", "permit": "ograniczony", "destination": "ograniczony",
    "ograniczony": "ograniczony", "ograniczona": "ograniczony",
    "private": "prywatny", "no": "prywatny", "prywatny": "prywatny", "prywatna": "prywatny",
}


def norm_access(v) -> str:
    return ACCESS_MAP.get(slug(clean(v)), "")


WHEELCHAIR_MAP = {"yes": "tak", "tak": "tak", "limited": "ograniczone", "ograniczone": "ograniczone",
                  "no": "nie", "nie": "nie"}


def norm_wheelchair(v) -> str:
    return WHEELCHAIR_MAP.get(slug(clean(v)), "")


# ----------------------------------------------------------------- address
ADDR_RX = re.compile(
    r"^(?P<street>.*?)(?:\s+(?P<no>\d+[A-Za-z]?(?:/\d+[A-Za-z]?)?))?\s*,\s*(?P<pc>\d{2}-\d{3})\s+(?P<city>.+)$"
)


def split_address(addr: str) -> dict:
    """'ul. Stanisława Wyspiańskiego 20, 38-400 Krosno' -> ulica / nr_budynku / kod_pocztowy / miejscowosc."""
    a = clean(addr).replace("..", ".")
    m = ADDR_RX.match(a)
    if not m:
        return {}
    street = (m.group("street") or "").strip(" ,")
    return {"ulica": street, "nr_budynku": m.group("no") or "", "kod_pocztowy": m.group("pc"),
            "miejscowosc": m.group("city").strip()}


STREET_PREFIX = {"ulica": "ul.", "aleja": "al.", "plac": "pl.", "osiedle": "os.", "rondo": "rondo", "skwer": "skwer"}


def street_with_prefix(cecha: str, name: str) -> str:
    cecha, name = clean(cecha), clean(name)
    if not name:
        return ""
    p = STREET_PREFIX.get(cecha.lower(), cecha)
    return f"{p} {name}".strip()


# ----------------------------------------------------------------- opening hours
DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
_RANGE_RX = re.compile(r"^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$")


def _days(spec: str) -> set[int] | None:
    out: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if part == "PH":
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            if a not in DAYS or b not in DAYS:
                return None
            i, j = DAYS.index(a), DAYS.index(b)
            rng = range(i, j + 1) if i <= j else [*range(i, 7), *range(0, j + 1)]
            out.update(rng)
        elif part in DAYS:
            out.add(DAYS.index(part))
        else:
            return None
    return out


def parse_opening_hours(oh: str) -> dict[int, list[tuple[time, time]]] | None:
    """Subset of the OSM opening_hours grammar covering ~99% of real AED values.
    Returns {weekday: [(open, close), ...]} or None if it can't be parsed."""
    s = clean(oh)
    if not s:
        return None
    if s in {"24/7", "Mo-Su 00:00-24:00", "00:00-24:00"}:
        return {d: [(time(0), time(23, 59, 59))] for d in range(7)}
    week: dict[int, list[tuple[time, time]]] = {d: [] for d in range(7)}
    for rule in [r.strip() for r in s.split(";") if r.strip()]:
        tokens = rule.split(" ")
        if tokens[-1] == "off":
            days = _days(" ".join(tokens[:-1]).replace(" ", ""))
            if days is None:
                return None
            for d in days:
                week[d] = []
            continue
        if len(tokens) == 1:
            days, ranges = set(range(7)), tokens[0]
        else:
            days = _days("".join(tokens[:-1]))
            ranges = tokens[-1]
        if days is None:
            return None
        spans = []
        for r in ranges.split(","):
            m = _RANGE_RX.match(r.strip())
            if not m:
                return None
            h1, m1, h2, m2 = map(int, m.groups())
            if h2 == 24:
                h2, m2 = 23, 59
            if h1 > 23 or h2 > 23:
                return None
            spans.append((time(h1, m1), time(h2, m2)))
        for d in days:
            week[d] = list(spans)
    return week


def is_24_7(oh: str) -> bool:
    w = parse_opening_hours(oh)
    return bool(w) and all(spans and spans[0][0] == time(0) and spans[-1][1] >= time(23, 59) for spans in w.values())


def is_open(oh: str, at: datetime | None = None) -> bool | None:
    """True/False if known, None if hours are missing or unparseable."""
    w = parse_opening_hours(oh)
    if w is None:
        return None
    at = (at or datetime.now(TZ)).astimezone(TZ)
    t = at.time()
    for a, b in w[at.weekday()]:
        if a <= b and a <= t <= b:
            return True
        if a > b:  # overnight span e.g. 22:00-06:00
            if t >= a:
                return True
    prev = w[(at.weekday() - 1) % 7]
    return any(a > b and t <= b for a, b in prev)


OH_RX = re.compile(r"^[A-Za-z0-9:,;\-/ +]+$")


def valid_opening_hours(oh: str) -> bool:
    return parse_opening_hours(oh) is not None or bool(OH_RX.match(clean(oh)))


def today() -> date:
    return datetime.now(TZ).date()


def years_since(iso: str) -> float | None:
    try:
        return (today() - date.fromisoformat(iso[:10])) / timedelta(days=365.25)
    except (ValueError, TypeError):
        return None
