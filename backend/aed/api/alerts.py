"""Community responder alerts: "an AED is needed here" sent to volunteers within 1 km.

Flow
1. Volunteers turn on "Tryb ratownika" in the app. The app sends heartbeats with its position
   (anonymous random device id, no account). Positions older than RESPONDER_TTL are ignored and
   deleted; opting out deletes the row immediately.
2. A person at an emergency sends an alert with their position. The server resolves the address
   (PRG GUGiK), picks the AED nearest to the casualty and counts volunteers within ALERT_RADIUS_M.
3. Each volunteer's heartbeat returns the active alerts around them with a role:
   - "przynies_aed": they are closer to the AED than to the casualty → fetch the AED, bring it;
   - "pomoz_na_miejscu": go straight to the casualty and help with CPR.
4. Volunteers answer (bringing the AED / on my way / can't); the sender sees the counts live.

Delivery today: the app checks for alerts with every heartbeat (background location updates) and shows
a local notification. With an Apple push certificate the same alert can be pushed (see README).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .. import geocode
from ..geo import haversine
from . import db
from .store import store

router = APIRouter(prefix="/api", tags=["alarmy"])

ALERT_RADIUS_M = 1000
RESPONDER_TTL = timedelta(minutes=15)
ALERT_TTL = timedelta(minutes=30)
SENDER_COOLDOWN = timedelta(minutes=3)
WALK_M_PER_MIN = 80
UTC = timezone.utc

DeviceId = Field(..., min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


def _now() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


def _ts(d: datetime) -> str:
    return d.strftime("%Y-%m-%d %H:%M:%S")


def _parse(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=UTC)


def _aed_brief(aed_id: str, lat: float, lon: float) -> dict | None:
    r = store.by_id.get(aed_id)
    if not r:
        return None
    street = " ".join(x for x in (r["ulica"], r["nr_budynku"]) if x)
    d = haversine(lat, lon, r["szerokosc_geograficzna"], r["dlugosc_geograficzna"])
    return {
        "id": r["id"],
        "nazwa": r["nazwa"] or r["lokalizacja_opis"] or "Defibrylator AED",
        "adres": ", ".join(x for x in (street, r["miejscowosc"]) if x),
        "lokalizacja_opis": r["lokalizacja_opis"],
        "godziny_dostepnosci": r["godziny_dostepnosci"],
        "dostep_24h": r["dostep_24h"],
        "lat": r["szerokosc_geograficzna"],
        "lon": r["dlugosc_geograficzna"],
        "odleglosc_od_poszkodowanego_m": round(d),
    }


def _nearest_aed(lat: float, lon: float) -> str:
    """Prefer an AED that is public and open now; fall back to the nearest one at all."""
    for kw in ({"open_now": True, "public_only": True}, {"public_only": True}, {}):
        hits = store.nearest(lat, lon, k=1, **kw)
        if hits and hits[0]["odleglosc_m"] <= 2000:
            return hits[0]["id"]
    return ""


def _counts(c, alert_id: int) -> dict:
    rows = c.execute("SELECT response, COUNT(*) FROM alert_responses WHERE alert_id=? GROUP BY response", (alert_id,))
    out = {"przynosze_aed": 0, "ide_na_miejsce": 0, "nie_moge": 0}
    out.update({r[0]: r[1] for r in rows})
    return out


def _public(alert, for_lat: float | None = None, for_lon: float | None = None, counts: dict | None = None,
            my_response: str | None = None) -> dict:
    a = dict(alert)
    aed = _aed_brief(a["aed_id"], a["lat"], a["lon"]) if a["aed_id"] else None
    out = {
        "id": a["id"], "status": a["status"], "lat": a["lat"], "lon": a["lon"], "accuracy": a["accuracy"],
        "adres": a["address"], "created_at": a["created_at"] + "Z", "expires_at": a["expires_at"] + "Z",
        "recipients": a["recipients"], "aed": aed, "odpowiedzi": counts, "moja_odpowiedz": my_response,
    }
    if for_lat is not None and for_lon is not None:
        d_victim = haversine(for_lat, for_lon, a["lat"], a["lon"])
        out["odleglosc_m"] = round(d_victim)
        if aed:
            d_aed = haversine(for_lat, for_lon, aed["lat"], aed["lon"])
            via_aed = d_aed + aed["odleglosc_od_poszkodowanego_m"]
            out["odleglosc_do_aed_m"] = round(d_aed)
            out["trasa_przez_aed_m"] = round(via_aed)
            # closer to the AED than to the casualty → the most useful thing is to bring the AED
            out["rola"] = "przynies_aed" if d_aed <= d_victim else "pomoz_na_miejscu"
            out["czas_min"] = round((via_aed if out["rola"] == "przynies_aed" else d_victim) / WALK_M_PER_MIN, 1)
        else:
            out["rola"] = "pomoz_na_miejscu"
            out["czas_min"] = round(d_victim / WALK_M_PER_MIN, 1)
    return out


# ------------------------------------------------------------------ responders
class HeartbeatIn(BaseModel):
    device_id: str = DeviceId
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    accuracy: float | None = Field(None, ge=0)


@router.post("/responders/heartbeat", summary="Ratownik: aktualna pozycja i alarmy w promieniu 1 km")
def heartbeat(body: HeartbeatIn):
    now = _now()
    with db.connect() as c:
        c.execute("INSERT INTO responders (device_id, lat, lon, accuracy, updated_at) VALUES (?,?,?,?,?) "
                  "ON CONFLICT(device_id) DO UPDATE SET lat=excluded.lat, lon=excluded.lon, "
                  "accuracy=excluded.accuracy, updated_at=excluded.updated_at",
                  (body.device_id, body.lat, body.lon, body.accuracy, _ts(now)))
        c.execute("DELETE FROM responders WHERE updated_at < ?", (_ts(now - RESPONDER_TTL),))
        rows = c.execute("SELECT * FROM alerts WHERE status='aktywny' AND expires_at > ? AND sender_device != ?",
                         (_ts(now), body.device_id)).fetchall()
        out = []
        for a in rows:
            if haversine(body.lat, body.lon, a["lat"], a["lon"]) > ALERT_RADIUS_M:
                continue
            mine = c.execute("SELECT response FROM alert_responses WHERE alert_id=? AND device_id=?",
                             (a["id"], body.device_id)).fetchone()
            out.append(_public(a, body.lat, body.lon, _counts(c, a["id"]), mine[0] if mine else None))
    out.sort(key=lambda x: x["odleglosc_m"])
    return {"alerts": out, "radius_m": ALERT_RADIUS_M}


@router.delete("/responders/{device_id}", summary="Ratownik: wyłącz tryb i usuń zapisaną pozycję")
def responder_off(device_id: str):
    with db.connect() as c:
        c.execute("DELETE FROM responders WHERE device_id=?", (device_id,))
    return {"ok": True}


# ------------------------------------------------------------------ alerts
class AlertIn(BaseModel):
    device_id: str = DeviceId
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    accuracy: float | None = Field(None, ge=0)


@router.post("/alerts", status_code=201, summary="Wezwij ratowników: potrzebny AED w tym miejscu")
def create_alert(body: AlertIn, request: Request):
    now = _now()
    with db.connect() as c:
        last = c.execute("SELECT created_at FROM alerts WHERE sender_device=? AND status='aktywny' "
                         "ORDER BY id DESC LIMIT 1", (body.device_id,)).fetchone()
        if last and _parse(last[0]) > now - SENDER_COOLDOWN:
            raise HTTPException(429, "Alarm z tego telefonu został już wysłany. Możesz go odwołać i wysłać ponownie.")
    try:
        a = geocode.reverse_address(body.lat, body.lon)
    except Exception:  # noqa: BLE001 – the alert must not depend on GUGiK being reachable
        a = None
    address = ""
    if a:
        street = " ".join(x for x in (a["ulica"], a["nr_budynku"]) if x)
        address = ", ".join(x for x in (street, a["miejscowosc"]) if x)
    aed_id = _nearest_aed(body.lat, body.lon)
    with db.connect() as c:
        c.execute("DELETE FROM responders WHERE updated_at < ?", (_ts(now - RESPONDER_TTL),))
        recipients = sum(
            1 for r in c.execute("SELECT device_id, lat, lon FROM responders WHERE device_id != ?", (body.device_id,))
            if haversine(body.lat, body.lon, r["lat"], r["lon"]) <= ALERT_RADIUS_M)
        cur = c.execute("INSERT INTO alerts (sender_device, lat, lon, accuracy, address, aed_id, recipients, created_at, "
                        "expires_at) VALUES (?,?,?,?,?,?,?,?,?)",
                        (body.device_id, body.lat, body.lon, body.accuracy, address, aed_id, recipients, _ts(now),
                         _ts(now + ALERT_TTL)))
        alert = c.execute("SELECT * FROM alerts WHERE id=?", (cur.lastrowid,)).fetchone()
        return _public(alert, counts=_counts(c, alert["id"]))


@router.get("/alerts/{alert_id}", summary="Szczegóły alarmu (opcjonalnie z rolą dla pozycji lat/lon)")
def get_alert(alert_id: int, lat: float | None = None, lon: float | None = None, device_id: str | None = None):
    with db.connect() as c:
        a = c.execute("SELECT * FROM alerts WHERE id=?", (alert_id,)).fetchone()
        if not a:
            raise HTTPException(404, "Nie ma takiego alarmu")
        mine = None
        if device_id:
            row = c.execute("SELECT response FROM alert_responses WHERE alert_id=? AND device_id=?",
                            (alert_id, device_id)).fetchone()
            mine = row[0] if row else None
        out = _public(a, lat, lon, _counts(c, alert_id), mine)
    if out["status"] == "aktywny" and _parse(a["expires_at"]) <= _now():
        out["status"] = "wygasl"
    return out


class ResponseIn(BaseModel):
    device_id: str = DeviceId
    response: Literal["przynosze_aed", "ide_na_miejsce", "nie_moge"]


@router.post("/alerts/{alert_id}/respond", summary="Ratownik: odpowiedź na alarm")
def respond(alert_id: int, body: ResponseIn):
    with db.connect() as c:
        if not c.execute("SELECT 1 FROM alerts WHERE id=? AND status='aktywny'", (alert_id,)).fetchone():
            raise HTTPException(404, "Alarm nie jest już aktywny")
        c.execute("INSERT INTO alert_responses (alert_id, device_id, response) VALUES (?,?,?) "
                  "ON CONFLICT(alert_id, device_id) DO UPDATE SET response=excluded.response, created_at=datetime('now')",
                  (alert_id, body.device_id, body.response))
        return {"ok": True, "odpowiedzi": _counts(c, alert_id)}


class CancelIn(BaseModel):
    device_id: str = DeviceId
    status: Literal["odwolany", "zakonczony"] = "odwolany"


@router.post("/alerts/{alert_id}/close", summary="Nadawca: odwołaj / zakończ alarm")
def close_alert(alert_id: int, body: CancelIn):
    with db.connect() as c:
        n = c.execute("UPDATE alerts SET status=? WHERE id=? AND sender_device=?",
                      (body.status, alert_id, body.device_id)).rowcount
    if not n:
        raise HTTPException(404, "Nie ma takiego alarmu wysłanego z tego telefonu")
    return {"ok": True, "status": body.status}
