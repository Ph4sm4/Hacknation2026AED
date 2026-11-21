"""Core tests: schema deliverables, validator on real dane.gov.pl files, harvester XML vs official XSD, API."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from lxml import etree

from aed import normalize as N
from aed import publish
from aed.schema import ROOT, load_schema
from aed.validator import validate_file

SRC = ROOT / "data" / "sources"
XSD = ROOT / "vendor" / "dane-gov-pl" / "xml_import_otwarte_dane_1_13.xsd"


def test_schema_loads_and_has_mandatory_fields():
    s = load_schema()
    names = s.field_names
    for f in ("id_aed", "szerokosc_geograficzna", "dlugosc_geograficzna", "lokalizacja_opis",
              "dostepnosc", "godziny_dostepnosci", "status", "dysponent_nazwa", "data_weryfikacji"):
        assert f in names
        assert s.by_name(f).mandatory
    assert len(names) == len(set(names))


def test_example_file_is_fully_valid():
    res = validate_file((ROOT / "schema" / "out" / "przyklad_aed.csv").read_bytes(), "przyklad.csv")
    assert res.summary["conformity"] == 100, res.issues


def test_marki_wrapped_lines_and_swapped_coordinates_are_fixed():
    res = validate_file((SRC / "danegovpl_marki.csv").read_bytes(), "marki.csv", strict=False)
    assert res.detected.get("wrapped_lines")
    assert any("zamieniono miejscami" in i.message for i in res.issues)
    r = res.records[0]
    assert 52 < r["szerokosc_geograficzna"] < 53 and 21 < r["dlugosc_geograficzna"] < 22
    assert r["kod_pocztowy"] == "05-270" and r["miejscowosc"] == "Marki"


def test_legionowo_street_composition_and_teryt_warning():
    res = validate_file((SRC / "danegovpl_legionowo.csv").read_bytes(), "legionowo.csv", strict=False)
    assert res.records[0]["ulica"] == "ul. Piłsudskiego"
    assert any(i.field == "kod_teryt_gminy" and i.level == "warning" for i in res.issues)


def test_strict_mode_reports_missing_mandatory_columns():
    res = validate_file((SRC / "danegovpl_krosno.csv").read_bytes(), "krosno.csv", strict=True)
    missing = {i.field for i in res.issues if i.row == 0 and i.level == "error"}
    assert {"dostepnosc", "godziny_dostepnosci", "status"} <= missing
    assert res.summary["valid_rows"] == 0


@pytest.mark.parametrize("oh,expected", [
    ("24/7", True), ("Mo-Fr 08:00-16:00", None), ("Mo-Fr 07:30-15:30; Sa-Su, PH off", None), ("bzdura", None)])
def test_opening_hours_parser(oh, expected):
    parsed = N.parse_opening_hours(oh)
    if oh == "bzdura":
        assert parsed is None
    else:
        assert parsed is not None
    if expected is True:
        assert N.is_24_7(oh)


def test_harvester_xml_validates_against_official_xsd():
    schema = etree.XMLSchema(etree.parse(str(XSD)))
    xml = publish.national_harvester_xml("https://example.org", {"official_records": 74})
    doc = etree.fromstring(xml.encode())
    assert schema.validate(doc), schema.error_log
    sub = {"id": 1, "title": "Defibrylatory AED – Gmina Testowa", "license": "CC-BY-4.0", "update_frequency": "monthly", "records": 3}
    user = {"id": 1, "organization": "Gmina Testowa"}
    assert schema.validate(etree.fromstring(publish.holder_harvester_xml("https://example.org", sub, user).encode()))


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    import os
    os.environ["AED_DB"] = str(tmp_path_factory.mktemp("db") / "test.sqlite3")
    from importlib import reload
    from aed.api import db
    reload(db)
    from aed.api import main
    with TestClient(main.app) as c:
        yield c


def test_api_nearest_and_detail(client):
    r = client.get("/api/aed/nearest", params={"lat": 52.2289, "lon": 21.0034, "k": 3})
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) == 3 and data[0]["odleglosc_m"] <= data[1]["odleglosc_m"]
    d = client.get(f"/api/aed/{data[0]['id']}").json()
    assert d["id"] == data[0]["id"]


def test_api_formats(client):
    assert client.get("/api/aed", params={"q": "legionowo", "format": "csv"}).text.startswith("id,id_aed,")
    gj = client.get("/api/aed", params={"q": "krosno", "format": "geojson"}).json()
    assert gj["type"] == "FeatureCollection" and gj["features"]
    assert client.get("/api/dane-gov-pl/harvester.xml").headers["content-type"].startswith("application/xml")


def test_holder_flow(client):
    r = client.post("/api/auth/register", json={"email": "a@b.pl", "password": "Haslo1234", "organization": "Gmina Marki", "regon": ""})
    token = r.json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    defaults = {"dostepnosc": "publiczny", "godziny_dostepnosci": "24/7", "status": "aktywny", "data_weryfikacji": "2026-11-01"}
    v = client.post("/api/validate", headers=h, files={"file": ("marki.csv", (SRC / "danegovpl_marki.csv").read_bytes())},
                    data={"defaults": json.dumps(defaults)}).json()
    assert v["summary"]["conformity"] == 100, v["issues"][:5]
    s = client.post("/api/holder/submissions", headers=h, json={"upload_token": v["token"], "title": "Defibrylatory AED – Marki"})
    assert s.status_code == 201
    csv_text = client.get(f"/api/holder/submissions/{s.json()['id']}/data.csv").text
    assert csv_text.count("\n") == 9  # header + 8 rows
    assert client.post("/api/auth/login", json={"email": "a@b.pl", "password": "zle"}).status_code == 401


def test_moderation_flow_hides_missing_aed(client, monkeypatch):
    monkeypatch.setenv("AED_MODERATORS", "mod@gdzieaed.pl")
    # a citizen report on the nearest AED
    near = client.get("/api/aed/nearest", params={"lat": 52.2289, "lon": 21.0034, "k": 3}).json()["data"]
    target = near[0]["id"]
    assert client.post(f"/api/aed/{target}/reports", json={"kind": "brak_urzadzenia", "comment": "Szafka pusta"}).status_code == 201

    # a plain holder account cannot moderate
    holder = client.post("/api/auth/register", json={"email": "h@b.pl", "password": "Haslo1234", "organization": "Firma", "regon": ""})
    hh = {"Authorization": f"Bearer {holder.json()['token']}"}
    assert client.get("/api/moderation/reports", headers=hh).status_code == 403

    mod = client.post("/api/auth/register", json={"email": "mod@gdzieaed.pl", "password": "Haslo1234", "organization": "GdzieAED", "regon": ""})
    assert mod.json()["user"]["is_moderator"] is True
    mh = {"Authorization": f"Bearer {mod.json()['token']}"}
    queue = client.get("/api/moderation/reports", headers=mh).json()
    rep = next(r for r in queue["data"] if r["aed_id"] == target)
    assert queue["counts"]["nowe"] >= 1 and rep["aed"]["id"] == target

    assert client.post(f"/api/moderation/reports/{rep['id']}", headers=mh, json={"status": "przyjete"}).status_code == 200
    after = client.get("/api/aed/nearest", params={"lat": 52.2289, "lon": 21.0034, "k": 3}).json()["data"]
    assert target not in [a["id"] for a in after]  # confirmed missing device is no longer suggested
    assert client.get(f"/api/aed/{target}").json()["zgloszony_problem"] == "brak_urzadzenia"

    # reverting the decision brings it back
    client.post(f"/api/moderation/reports/{rep['id']}", headers=mh, json={"status": "nowe"})
    back = client.get("/api/aed/nearest", params={"lat": 52.2289, "lon": 21.0034, "k": 3}).json()["data"]
    assert target in [a["id"] for a in back]


def test_coverage_ranking(client):
    from aed import gus
    if not gus.load_gminy():
        pytest.skip("GUS population table not extracted")
    cov = client.get("/api/coverage").json()
    s = cov["podsumowanie"]
    assert s["gminy"] == len(cov["gminy"]) == 2477
    assert s["ludnosc"] == sum(g["ludnosc"] for g in cov["gminy"])
    assert s["gminy_bez_aed"] == sum(1 for g in cov["gminy"] if g["aed"] == 0)
    gj = client.get("/api/coverage/powiaty.geojson").json()
    assert gj["type"] == "FeatureCollection" and len(gj["features"]) > 300
