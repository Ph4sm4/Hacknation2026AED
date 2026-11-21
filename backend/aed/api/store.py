"""In-memory read model of the aggregated dataset (≈18k records – fits easily, queries in ms)."""
from __future__ import annotations

import csv
import io
import json
import threading
from datetime import datetime

from .. import normalize as N
from ..geo import GridIndex
from ..pipeline import OUT, run
from ..schema import load_schema


class Store:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.records: list[dict] = []
        self.by_id: dict[str, dict] = {}
        self.stats: dict = {}
        self.index: GridIndex | None = None
        self.official: list[dict] = []
        # moderated citizen reports: aed_id -> {"problem": kind, "od": date} or {"potwierdzone": date}
        self.moderation: dict[str, dict] = {}

    def load(self, rebuild: bool = False) -> None:
        if rebuild or not (OUT / "aed_polska.json").exists() or not (OUT / "statystyki.json").exists():
            run()
        data = json.loads((OUT / "aed_polska.json").read_text(encoding="utf-8"))["data"]
        stats = json.loads((OUT / "statystyki.json").read_text(encoding="utf-8"))
        with open(OUT / "aed_oficjalne.csv", encoding="utf-8") as fh:
            official = list(csv.DictReader(fh))
        for r in data:
            r["zrodla"] = r["zrodla"].split("|") if isinstance(r["zrodla"], str) else r["zrodla"]
            r["problemy_jakosci"] = [p for p in r["problemy_jakosci"].split("|") if p] if isinstance(r["problemy_jakosci"], str) else r["problemy_jakosci"]
        with self._lock:
            self.records = data
            self.by_id = {r["id"]: r for r in data}
            self.stats = stats
            self.index = GridIndex(data)
            self.official = official
        self.load_moderation()

    def load_moderation(self) -> None:
        """Latest accepted report per AED wins: a confirmation clears an earlier accepted problem."""
        from . import db  # local import: the store is also used by the offline pipeline tests

        state: dict[str, dict] = {}
        try:
            with db.connect() as c:
                rows = c.execute("SELECT aed_id, kind, moderated_at FROM reports WHERE status='przyjete' "
                                 "ORDER BY moderated_at, id").fetchall()
        except Exception:  # noqa: BLE001 – no DB yet
            rows = []
        for r in rows:
            date = (r["moderated_at"] or "")[:10]
            state[r["aed_id"]] = {"potwierdzone": date} if r["kind"] == "potwierdzam" else {"problem": r["kind"], "od": date}
        self.moderation = state

    def missing(self, aed_id: str) -> bool:
        return self.moderation.get(aed_id, {}).get("problem") == "brak_urzadzenia"

    # ------------------------------------------------------------------ queries
    def with_live(self, r: dict, now: datetime | None = None) -> dict:
        out = dict(r)
        out["otwarte_teraz"] = N.is_open(r["godziny_dostepnosci"], now) if r["godziny_dostepnosci"] else None
        m = self.moderation.get(r["id"], {})
        out["zgloszony_problem"] = m.get("problem")
        out["potwierdzone_przez_mieszkanca"] = m.get("potwierdzone")
        if m.get("problem") in ("zamkniety", "uszkodzony", "brak_urzadzenia"):
            out["otwarte_teraz"] = False
        return out

    def filter(self, *, q: str = "", woj: str = "", access: str = "", h24: bool = False, open_now: bool = False,
               source: str = "", min_quality: int = 0, bbox: tuple[float, float, float, float] | None = None) -> list[dict]:
        ql = N.slug(q) if q else ""
        now = datetime.now(N.TZ)
        out = []
        for r in self.records:
            if bbox and not (bbox[1] <= r["szerokosc_geograficzna"] <= bbox[3] and bbox[0] <= r["dlugosc_geograficzna"] <= bbox[2]):
                continue
            if woj and r["wojewodztwo"] != woj:
                continue
            if access and r["dostepnosc"] != access:
                continue
            if h24 and r["dostep_24h"] != "tak":
                continue
            if source and source not in r["zrodla"]:
                continue
            if min_quality and r["wskaznik_jakosci"] < min_quality:
                continue
            if ql and ql not in N.slug(" ".join(str(r[k]) for k in ("nazwa", "miejscowosc", "ulica", "lokalizacja_opis", "dysponent_nazwa"))):
                continue
            if open_now and N.is_open(r["godziny_dostepnosci"], now) is not True:
                continue
            out.append(r)
        return out

    def nearest(self, lat: float, lon: float, k: int = 10, open_now: bool = False, public_only: bool = False) -> list[dict]:
        now = datetime.now(N.TZ)
        hits = self.index.nearest(lat, lon, k=k * 6 if (open_now or public_only) else k + 5)
        out = []
        for d, r in hits:
            if self.missing(r["id"]):  # confirmed by a moderator: the device is gone
                continue
            if public_only and r["dostepnosc"] == "prywatny":
                continue
            live = self.with_live(r, now)
            if open_now and live["otwarte_teraz"] is not True:
                continue
            live["odleglosc_m"] = round(d)
            live["czas_dojscia_min"] = round(d / 80, 1)   # ~4.8 km/h walking
            out.append(live)
            if len(out) >= k:
                break
        return out

    def points(self) -> list[list]:
        """Compact representation for the map: [id, lat, lon, flags, quality]. flags: bit0=24/7, bit1=public, bit2=official."""
        out = []
        for r in self.records:
            if self.missing(r["id"]):
                continue
            flags = (1 if r["dostep_24h"] == "tak" else 0) | (2 if r["dostepnosc"] == "publiczny" else 0) | \
                    (4 if any(s != "osm" for s in r["zrodla"]) else 0) | (8 if r["dostepnosc"] == "prywatny" else 0)
            out.append([r["id"], r["szerokosc_geograficzna"], r["dlugosc_geograficzna"], flags, r["wskaznik_jakosci"]])
        return out


def to_csv(rows: list[dict], cols: list[str]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore", lineterminator="\n")
    w.writeheader()
    for r in rows:
        w.writerow({k: "|".join(v) if isinstance(v, list) else v for k, v in r.items()})
    return buf.getvalue()


def to_geojson(rows: list[dict]) -> dict:
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "id": r.get("id"),
         "geometry": {"type": "Point", "coordinates": [float(r["dlugosc_geograficzna"]), float(r["szerokosc_geograficzna"])]},
         "properties": {k: v for k, v in r.items() if k not in ("szerokosc_geograficzna", "dlugosc_geograficzna")}}
        for r in rows if r.get("szerokosc_geograficzna") not in ("", None)]}


store = Store()
schema = load_schema()
