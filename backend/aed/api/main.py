"""GdzieAED – REST API (FastAPI).

    uvicorn aed.api.main:app --reload        (from backend/)

OpenAPI docs: /api/docs
"""
from __future__ import annotations

import json
import os
import re
import secrets
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .. import publish
from ..build_schema import build_jsonschema, build_tableschema
from ..pipeline import OUT
from ..schema import ROOT
from ..validator import records_to_csv, validate_file
from . import auth, db
from .store import schema, store, to_csv, to_geojson

app = FastAPI(
    title="GdzieAED – API",
    description="Otwarte API ogólnopolskiego zbioru defibrylatorów AED oraz narzędzia dla dysponentów danych.",
    version=schema.version,
    docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

FRONTEND = Path(os.environ.get("AED_FRONTEND", ROOT / "frontend" / "dist"))
MAX_UPLOAD = 10 * 1024 * 1024


@app.on_event("startup")
def _startup() -> None:
    db.init()
    store.load()


def base_url(request: Request) -> str:
    return os.environ.get("PUBLIC_BASE_URL") or str(request.base_url).rstrip("/")


# ============================================================================ public data
@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok", "records": len(store.records), "schema_version": schema.version}


@app.get("/api/stats", tags=["dane"], summary="Statystyki zbioru i jakości danych")
def stats():
    with db.connect() as c:
        reports = c.execute("SELECT COUNT(*) FROM reports").fetchone()[0]
        holders = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        subs = c.execute("SELECT COUNT(*), COALESCE(SUM(records),0) FROM submissions").fetchone()
    return {**store.stats, "reports": reports, "holders": holders, "submissions": subs[0], "submitted_records": subs[1]}


@app.get("/api/sources", tags=["dane"], summary="Katalog źródeł danych")
def sources():
    return {"sources": store.stats.get("sources", []), "pending": store.stats.get("pending_sources", [])}


@app.get("/api/aed/points", tags=["dane"], summary="Wszystkie punkty w formie kompaktowej (dla mapy)")
def points():
    return {"fields": ["id", "lat", "lon", "flags", "quality"],
            "flags": {"1": "24/7", "2": "publiczny", "4": "dane dysponenta", "8": "prywatny"},
            "data": store.points()}


@app.get("/api/aed/nearest", tags=["dane"], summary="Najbliższe AED od wskazanego punktu")
def nearest(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180),
            k: int = Query(10, ge=1, le=50), open_now: bool = False, public_only: bool = False):
    return {"data": store.nearest(lat, lon, k=k, open_now=open_now, public_only=public_only)}


@app.get("/api/aed", tags=["dane"], summary="Wyszukiwanie i filtrowanie AED (JSON / GeoJSON / CSV)")
def list_aed(q: str = "", wojewodztwo: str = "", dostepnosc: str = "", h24: bool = False, open_now: bool = False,
             zrodlo: str = "", min_jakosc: int = Query(0, ge=0, le=100),
             bbox: str | None = Query(None, description="minLon,minLat,maxLon,maxLat"),
             limit: int = Query(50, ge=1, le=20000), offset: int = Query(0, ge=0),
             format: Literal["json", "geojson", "csv"] = "json"):
    bb = None
    if bbox:
        try:
            bb = tuple(float(x) for x in bbox.split(","))
            assert len(bb) == 4
        except (ValueError, AssertionError):
            raise HTTPException(400, "bbox: minLon,minLat,maxLon,maxLat")
    rows = store.filter(q=q, woj=wojewodztwo, access=dostepnosc, h24=h24, open_now=open_now, source=zrodlo,
                        min_quality=min_jakosc, bbox=bb)
    total = len(rows)
    page = [store.with_live(r) for r in rows[offset: offset + limit]]
    if format == "csv":
        return PlainTextResponse(to_csv(page, schema.aggregate_field_names), media_type="text/csv; charset=utf-8")
    if format == "geojson":
        return JSONResponse(to_geojson(page), media_type="application/geo+json")
    return {"total": total, "limit": limit, "offset": offset, "data": page}


@app.get("/api/aed/{aed_id}", tags=["dane"], summary="Szczegóły AED")
def get_aed(aed_id: str):
    r = store.by_id.get(aed_id)
    if not r:
        raise HTTPException(404, "Nie znaleziono AED")
    with db.connect() as c:
        reps = [dict(x) for x in c.execute(
            "SELECT kind, comment, status, created_at FROM reports WHERE aed_id=? ORDER BY id DESC LIMIT 20", (aed_id,))]
    return {**store.with_live(r), "zgloszenia": reps}


class ReportIn(BaseModel):
    kind: Literal["potwierdzam", "zamkniety", "brak_urzadzenia", "uszkodzony", "bledna_lokalizacja", "inne"]
    comment: str = Field("", max_length=500)


@app.post("/api/aed/{aed_id}/reports", tags=["zgłoszenia"], status_code=201, summary="Zgłoś problem / potwierdź AED")
def report(aed_id: str, body: ReportIn):
    if aed_id not in store.by_id:
        raise HTTPException(404, "Nie znaleziono AED")
    with db.connect() as c:
        c.execute("INSERT INTO reports (aed_id, kind, comment) VALUES (?,?,?)", (aed_id, body.kind, body.comment.strip()))
    return {"ok": True}


# ============================================================================ moderation
REPORT_STATUS = Literal["nowe", "przyjete", "odrzucone"]


def _aed_summary(aed_id: str) -> dict | None:
    r = store.by_id.get(aed_id)
    if not r:
        return None
    adres = " ".join(x for x in (r["ulica"], r["nr_budynku"]) if x)
    return {
        "id": r["id"], "nazwa": r["nazwa"] or r["lokalizacja_opis"] or "Defibrylator AED",
        "adres": ", ".join(x for x in (adres, r["miejscowosc"]) if x), "lokalizacja_opis": r["lokalizacja_opis"],
        "lat": r["szerokosc_geograficzna"], "lon": r["dlugosc_geograficzna"], "wojewodztwo": r["wojewodztwo"],
        "dysponent_nazwa": r["dysponent_nazwa"], "kontakt_email": r["kontakt_email"],
        "kontakt_telefon": r["kontakt_telefon"], "zrodla": r["zrodla"], "osm_id": r["osm_id"],
    }


@app.get("/api/moderation/reports", tags=["moderacja"], summary="Kolejka zgłoszeń mieszkańców")
def moderation_queue(status: REPORT_STATUS | Literal["wszystkie"] = "nowe", limit: int = Query(100, ge=1, le=500),
                     _: dict = Depends(auth.require_moderator)):
    with db.connect() as c:
        counts = {r[0]: r[1] for r in c.execute("SELECT status, COUNT(*) FROM reports GROUP BY status")}
        where, args = ("", ()) if status == "wszystkie" else ("WHERE r.status=?", (status,))
        rows = [dict(x) for x in c.execute(
            "SELECT r.id, r.aed_id, r.kind, r.comment, r.status, r.created_at, r.moderator_note, r.moderated_at, "
            "u.email AS moderated_by FROM reports r LEFT JOIN users u ON u.id = r.moderated_by "
            f"{where} ORDER BY r.id DESC LIMIT ?", (*args, limit))]
        pending = {r[0]: r[1] for r in c.execute(
            "SELECT aed_id, COUNT(*) FROM reports WHERE status='nowe' GROUP BY aed_id")}
    for r in rows:
        r["aed"] = _aed_summary(r["aed_id"])
        r["inne_nowe_dla_aed"] = max(0, pending.get(r["aed_id"], 0) - (r["status"] == "nowe"))
    return {"counts": {k: counts.get(k, 0) for k in ("nowe", "przyjete", "odrzucone")}, "data": rows}


class ModerationIn(BaseModel):
    status: REPORT_STATUS
    note: str = Field("", max_length=500)


@app.post("/api/moderation/reports/{report_id}", tags=["moderacja"], summary="Przyjmij / odrzuć zgłoszenie")
def moderate(report_id: int, body: ModerationIn, user: dict = Depends(auth.require_moderator)):
    with db.connect() as c:
        n = c.execute("UPDATE reports SET status=?, moderator_note=?, moderated_at=datetime('now'), moderated_by=? "
                      "WHERE id=?", (body.status, body.note.strip(), user["id"], report_id)).rowcount
    if not n:
        raise HTTPException(404, "Nie ma takiego zgłoszenia")
    store.load_moderation()
    return {"ok": True, "id": report_id, "status": body.status}


# ============================================================================ coverage
@app.get("/api/coverage", tags=["pokrycie"], summary="Pokrycie AED w gminach (ranking, białe plamy)")
def coverage():
    f = OUT / "pokrycie_gmin.json"
    if not f.exists():
        raise HTTPException(404, "Brak danych o pokryciu – uruchom pipeline (make data)")
    return JSONResponse(json.loads(f.read_text(encoding="utf-8")))


@app.get("/api/coverage/powiaty.geojson", tags=["pokrycie"], summary="Pokrycie AED w powiatach (mapa)")
def coverage_counties():
    f = OUT / "pokrycie_powiatow.geojson"
    if not f.exists():
        raise HTTPException(404, "Brak danych o pokryciu – uruchom pipeline (make data)")
    return FileResponse(f, media_type="application/geo+json")


DOWNLOADS = {
    "aed_polska.csv": ("aed_polska.csv", "text/csv; charset=utf-8"),
    "aed_polska.xlsx": ("aed_polska.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "aed_polska.geojson": ("aed_polska.geojson", "application/geo+json"),
    "aed_polska.json": ("aed_polska.json", "application/json"),
    "oficjalne.csv": ("aed_oficjalne.csv", "text/csv; charset=utf-8"),
    "statystyki.json": ("statystyki.json", "application/json"),
    "pokrycie_gmin.csv": ("pokrycie_gmin.csv", "text/csv; charset=utf-8"),
}


@app.get("/api/download/{name}", tags=["dane"], summary="Pobierz zbiór danych")
def download(name: str):
    if name == "oficjalne.geojson":
        return JSONResponse(to_geojson(store.official), media_type="application/geo+json")
    if name == "oficjalne.json":
        return {"meta": {"license": "CC-BY-4.0 / CC0-1.0 (zob. pole licencja)", "count": len(store.official)},
                "data": store.official}
    if name not in DOWNLOADS:
        raise HTTPException(404, "Nieznany zasób")
    fname, media = DOWNLOADS[name]
    return FileResponse(OUT / fname, media_type=media, filename=fname)


# ============================================================================ schema
@app.get("/api/schema", tags=["schemat"], summary="Wzorcowy zakres danych (JSON)")
def get_schema():
    return {"version": schema.version, "title": schema.raw["title"], "description": schema.raw["description"],
            "publishing_rules": schema.raw["publishing_rules"], "groups": schema.raw["groups"],
            "enums": schema.enums, "fields": [f.__dict__ for f in schema.fields],
            "aggregate_fields": schema.aggregate_fields, "dataset_metadata": schema.raw["dataset_metadata"]}


@app.get("/api/schema/tableschema.json", tags=["schemat"], summary="Frictionless Table Schema")
def tableschema():
    return build_tableschema(schema)


@app.get("/api/schema/aed.schema.json", tags=["schemat"], summary="JSON Schema rekordu")
def jsonschema():
    return build_jsonschema(schema)


SCHEMA_FILES = {"xlsx": "wzorcowy_zakres_danych_AED.xlsx", "szablon.csv": "szablon_aed.csv", "przyklad.csv": "przyklad_aed.csv"}


@app.get("/api/schema/{kind}", tags=["schemat"], summary="Pliki wzorcowego zakresu: xlsx | szablon.csv | przyklad.csv")
def schema_file(kind: str):
    if kind not in SCHEMA_FILES:
        raise HTTPException(404)
    return FileResponse(ROOT / "schema" / "out" / SCHEMA_FILES[kind], filename=SCHEMA_FILES[kind])


# ============================================================================ dane.gov.pl
@app.get("/api/dane-gov-pl/harvester.xml", tags=["dane.gov.pl"],
         summary="Katalog w formacie harwestera XML dane.gov.pl (urn:otwarte-dane:harvester:1.13)")
def harvester(request: Request):
    return Response(publish.national_harvester_xml(base_url(request), store.stats), media_type="application/xml")


@app.get("/api/dcat.jsonld", tags=["dane.gov.pl"], summary="Katalog DCAT-AP (JSON-LD)")
def dcat(request: Request):
    return JSONResponse(publish.dcat_jsonld(base_url(request), store.stats), media_type="application/ld+json")


# ============================================================================ validator
@app.post("/api/validate", tags=["dysponent"], summary="Sprawdź plik dysponenta względem wzorcowego zakresu")
async def validate(file: UploadFile = File(...), defaults: str = Form("{}"), overrides: str = Form("{}"),
                   user: dict | None = Depends(auth.optional_user)):
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Plik większy niż 10 MB")
    try:
        d, o = json.loads(defaults or "{}"), json.loads(overrides or "{}")
    except json.JSONDecodeError:
        raise HTTPException(400, "defaults/overrides muszą być JSON")
    # The record update timestamp defaults to the moment of upload (holder confirms data as current).
    if not d.get("data_aktualizacji"):
        from datetime import datetime
        from ..normalize import TZ
        d["data_aktualizacji"] = datetime.now(TZ).isoformat(timespec="seconds")
    if user and not d.get("dysponent_nazwa"):
        d["dysponent_nazwa"] = user["organization"]
        if user.get("regon") and not d.get("dysponent_regon"):
            d["dysponent_regon"] = user["regon"]
    res = validate_file(data, file.filename or "plik.csv", defaults=d, overrides=o, strict=True)
    token = secrets.token_urlsafe(16)
    bad_rows = {i.row for i in res.issues if i.level == "error" and i.row > 0}
    file_error = any(i.level == "error" and i.row == 0 for i in res.issues)
    valid = [] if file_error else [r for n, r in enumerate(res.records, 1) if n not in bad_rows]
    with db.connect() as c:
        c.execute("INSERT INTO uploads (token, user_id, filename, summary_json, records_json) VALUES (?,?,?,?,?)",
                  (token, user["id"] if user else None, file.filename, json.dumps(res.summary),
                   json.dumps({"all": res.records, "valid": valid}, ensure_ascii=False)))
    return {"token": token, **res.to_dict(preview=20)}


def _upload(token: str) -> dict:
    with db.connect() as c:
        row = c.execute("SELECT * FROM uploads WHERE token=?", (token,)).fetchone()
    if not row:
        raise HTTPException(404, "Nie znaleziono wyniku walidacji")
    return dict(row)


@app.get("/api/validate/{token}/data.csv", tags=["dysponent"], summary="Pobierz poprawiony plik CSV w wzorcowym zakresie")
def validated_csv(token: str):
    up = _upload(token)
    name = re.sub(r"\.[^.]+$", "", up["filename"] or "aed") + "_wzorcowy.csv"
    return Response(records_to_csv(json.loads(up["records_json"])["all"]), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ============================================================================ holder accounts
class RegisterIn(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=150)
    password: str = Field(..., min_length=8, max_length=128)
    organization: str = Field(..., min_length=2, max_length=250)
    regon: str = Field("", pattern=r"^(|[0-9]{9}|[0-9]{14})$")


class LoginIn(BaseModel):
    email: str
    password: str


@app.post("/api/auth/register", tags=["konto"], status_code=201)
def register(body: RegisterIn):
    with db.connect() as c:
        if c.execute("SELECT 1 FROM users WHERE lower(email)=lower(?)", (body.email,)).fetchone():
            raise HTTPException(409, "Konto z tym adresem e-mail już istnieje")
        cur = c.execute("INSERT INTO users (email, password_hash, organization, regon) VALUES (?,?,?,?)",
                        (body.email.lower(), auth.hash_password(body.password), body.organization.strip(), body.regon))
        uid = cur.lastrowid
    return {"token": auth.make_token(uid), "user": {"id": uid, "email": body.email.lower(),
                                                    "organization": body.organization, "regon": body.regon,
                                                    "is_moderator": body.email.lower() in auth.moderator_emails()}}


@app.post("/api/auth/login", tags=["konto"])
def login(body: LoginIn):
    with db.connect() as c:
        row = c.execute("SELECT * FROM users WHERE lower(email)=lower(?)", (body.email,)).fetchone()
    if not row or not auth.verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Nieprawidłowy e-mail lub hasło")
    return {"token": auth.make_token(row["id"]),
            "user": {"id": row["id"], "email": row["email"], "organization": row["organization"], "regon": row["regon"],
                     "is_moderator": row["role"] == "moderator" or row["email"] in auth.moderator_emails()}}


@app.get("/api/auth/me", tags=["konto"])
def me(user: dict = Depends(auth.current_user)):
    return user


class SubmissionIn(BaseModel):
    upload_token: str
    title: str = Field(..., min_length=5, max_length=200)
    license: Literal["CC0-1.0", "CC-BY-4.0"] = "CC0-1.0"
    update_frequency: Literal["daily", "weekly", "monthly", "quarterly", "everyHalfYear", "yearly", "irregular"] = "monthly"


@app.post("/api/holder/submissions", tags=["dysponent"], status_code=201, summary="Przekaż dane do zbioru ogólnopolskiego")
def submit(body: SubmissionIn, user: dict = Depends(auth.current_user)):
    up = _upload(body.upload_token)
    summary = json.loads(up["summary_json"])
    if summary["valid_rows"] == 0:
        raise HTTPException(422, "Plik nie zawiera poprawnych rekordów – popraw błędy i spróbuj ponownie")
    with db.connect() as c:
        cur = c.execute("INSERT INTO submissions (user_id, upload_token, title, license, update_frequency, records, conformity) "
                        "VALUES (?,?,?,?,?,?,?)", (user["id"], body.upload_token, body.title, body.license,
                                                    body.update_frequency, summary["valid_rows"], summary["conformity"]))
        c.execute("UPDATE uploads SET user_id=? WHERE token=?", (user["id"], body.upload_token))
    return {"id": cur.lastrowid}


@app.get("/api/holder/submissions", tags=["dysponent"])
def my_submissions(user: dict = Depends(auth.current_user)):
    with db.connect() as c:
        rows = [dict(r) for r in c.execute("SELECT * FROM submissions WHERE user_id=? ORDER BY id DESC", (user["id"],))]
    return {"data": rows}


def _submission(sid: int) -> tuple[dict, dict]:
    with db.connect() as c:
        s = c.execute("SELECT * FROM submissions WHERE id=?", (sid,)).fetchone()
        if not s:
            raise HTTPException(404)
        u = c.execute("SELECT id, email, organization, regon FROM users WHERE id=?", (s["user_id"],)).fetchone()
    return dict(s), dict(u)


@app.get("/api/holder/submissions/{sid}/data.csv", tags=["dysponent"], summary="Stały URL zasobu CSV dysponenta")
def submission_csv(sid: int):
    s, _ = _submission(sid)
    up = _upload(s["upload_token"])
    return Response(records_to_csv(json.loads(up["records_json"])["valid"]), media_type="text/csv; charset=utf-8")


@app.get("/api/holder/submissions/{sid}/harvester.xml", tags=["dysponent"],
         summary="XML do automatycznego importu zbioru dysponenta w dane.gov.pl")
def submission_xml(sid: int, request: Request):
    s, u = _submission(sid)
    return Response(publish.holder_harvester_xml(base_url(request), s, u), media_type="application/xml")


@app.get("/api/holder/claim", tags=["dysponent"], summary="Znajdź AED przypisane do dysponenta w OpenStreetMap")
def claim(q: str = Query(..., min_length=3), user: dict = Depends(auth.current_user)):
    rows = store.filter(q=q, source="osm")
    return {"total": len(rows), "data": [store.with_live(r) for r in rows[:200]]}


# ============================================================================ frontend (SPA)
if FRONTEND.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = FRONTEND / path
        if path and f.is_file() and FRONTEND in f.resolve().parents:
            return FileResponse(f)
        return FileResponse(FRONTEND / "index.html")
