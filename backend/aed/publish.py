"""Publication metadata for dane.gov.pl.

* harvester_xml()  – XML in the official dane.gov.pl import format (urn:otwarte-dane:harvester:1.13),
                     validated against the XSD shipped in the portal's source code (vendor/dane-gov-pl).
                     A provider registers this URL once in dane.gov.pl and the portal keeps the dataset
                     and its resources in sync automatically.
* dcat_jsonld()    – the same catalogue as DCAT-AP (JSON-LD) for EU-style harvesters.
"""
from __future__ import annotations

from datetime import datetime
from xml.sax.saxutils import escape

from . import normalize as N

NS = "urn:otwarte-dane:harvester:1.13"
LICENSE_XML = {"CC0-1.0": "CC0 1.0", "CC-BY-4.0": "CC BY 4.0"}
LICENSE_URI = {"CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
               "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
               "ODbL-1.0": "https://opendatacommons.org/licenses/odbl/1-0/"}
FREQ_DCAT = {"daily": "DAILY", "weekly": "WEEKLY", "monthly": "MONTHLY", "quarterly": "QUARTERLY",
             "everyHalfYear": "BIENNIAL", "yearly": "ANNUAL", "irregular": "IRREG", "notPlanned": "NEVER"}


def _t(tag: str, pl: str, en: str = "") -> str:
    en_xml = f"<english>{escape(en)}</english>" if en else ""
    return f"<{tag}><polish>{escape(pl)}</polish>{en_xml}</{tag}>"


def _now() -> str:
    return datetime.now(N.TZ).astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")[:-2] + ":00"


def dataset_xml(*, ext_id: str, title_pl: str, title_en: str, desc_pl: str, desc_en: str, landing: str,
                license: str, frequency: str, resources: list[dict], tags: list[str], teryt: list[str] | None = None,
                last_update: str | None = None) -> str:
    lic = LICENSE_XML.get(license, "CC BY 4.0")
    res_xml = []
    for r in resources:
        regions = "".join(f"<terytIdent>{escape(t)}</terytIdent>" for t in (teryt or []))
        res_xml.append(
            f'<resource status="published"><extIdent>{escape(r["ext_id"])}</extIdent><url>{escape(r["url"])}</url>'
            f'{_t("title", r["title_pl"], r.get("title_en", ""))}{_t("description", r["desc_pl"], r.get("desc_en", ""))}'
            f'<availability>remote</availability><dataDate>{r.get("data_date", _now()[:10])}</dataDate>'
            f'<lastUpdateDate>{r.get("last_update", _now())}</lastUpdateDate>'
            f'<hasDynamicData>false</hasDynamicData><hasHighValueData>false</hasHighValueData>'
            f'<hasHighValueDataFromEuropeanCommissionList>false</hasHighValueDataFromEuropeanCommissionList>'
            f'<hasResearchData>false</hasResearchData><containsProtectedData>false</containsProtectedData>'
            f'{"<regions>" + regions + "</regions>" if regions else ""}'
            f'</resource>')
    tags_xml = "".join(f'<tag lang="pl">{escape(t)}</tag>' for t in tags)
    return (
        f'<dataset status="published"><extIdent>{escape(ext_id)}</extIdent>'
        f'{_t("title", title_pl, title_en)}{_t("description", desc_pl, desc_en)}'
        f'<url>{escape(landing)}</url><updateFrequency>{frequency}</updateFrequency>'
        f'<hasDynamicData>false</hasDynamicData><hasHighValueData>false</hasHighValueData>'
        f'<hasHighValueDataFromEuropeanCommissionList>false</hasHighValueDataFromEuropeanCommissionList>'
        f'<hasResearchData>false</hasResearchData>'
        f'<categories><category>HEAL</category></categories>'
        f'<conditions><source>true</source><modification>true</modification>'
        f'<dbOrCopyrighted>Warunek wymagany</dbOrCopyrighted><dbOrCopyrightedLicenseChosen>{lic}</dbOrCopyrightedLicenseChosen>'
        f'</conditions>'
        f'<resources>{"".join(res_xml)}</resources><tags>{tags_xml}</tags>'
        f'<lastUpdateDate>{last_update or _now()}</lastUpdateDate></dataset>'
    )


def wrap(datasets: list[str]) -> str:
    return (f"<?xml version='1.0' encoding='UTF-8'?>\n"
            f'<ns2:datasets xmlns:ns2="{NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
            f'{"".join(datasets)}</ns2:datasets>')


TAGS = ["AED", "defibrylator", "ratownictwo", "pierwsza pomoc", "zdrowie", "GdzieAED"]


def national_harvester_xml(base: str, stats: dict) -> str:
    """Catalogue of the official (CC-licensed) national AED dataset produced by the aggregator."""
    fmt = [("csv", "CSV", "Plik CSV (UTF-8, separator przecinek) zgodny z wzorcowym zakresem danych."),
           ("geojson", "GeoJSON", "Punkty AED w formacie GeoJSON (WGS84)."),
           ("json", "JSON", "Rekordy AED w formacie JSON wraz z metadanymi.")]
    resources = [{
        "ext_id": f"gdzieaed-oficjalne-{k}", "url": f"{base}/api/download/oficjalne.{k}",
        "title_pl": f"Defibrylatory AED – dane dysponentów ({label})", "title_en": f"AED defibrillators – holders' data ({label})",
        "desc_pl": d + f" Rekordów: {stats.get('official_records', 0)}. Schemat: {base}/api/schema/tableschema.json",
        "desc_en": "AED locations published by data holders, normalised to the reference data model.",
    } for k, label, d in fmt]
    ds = dataset_xml(
        ext_id="gdzieaed-polska", title_pl="Defibrylatory AED w Polsce – zbiór zintegrowany (GdzieAED)",
        title_en="AED defibrillators in Poland – integrated dataset",
        desc_pl="Ogólnopolski zbiór lokalizacji, dostępności i stanu automatycznych defibrylatorów zewnętrznych (AED), "
                "zintegrowany z danych publikowanych przez dysponentów w jednolitym, wzorcowym zakresie danych akcji „GdzieAED”.",
        desc_en="National dataset of AED locations, availability and status integrated from data holders.",
        landing=f"{base}/dane", license="CC-BY-4.0", frequency="daily", resources=resources, tags=TAGS)
    return wrap([ds])


def holder_harvester_xml(base: str, sub: dict, user: dict) -> str:
    resources = [{
        "ext_id": f"gdzieaed-{sub['id']}-csv", "url": f"{base}/api/holder/submissions/{sub['id']}/data.csv",
        "title_pl": f"{sub['title']} (CSV)", "title_en": "AED defibrillators (CSV)",
        "desc_pl": f"Lokalizacje AED dysponenta {user['organization']} w wzorcowym zakresie danych. Rekordów: {sub['records']}.",
        "desc_en": "AED locations in the reference data model.",
    }]
    ds = dataset_xml(
        ext_id=f"gdzieaed-dysponent-{user['id']}", title_pl=sub["title"], title_en="AED defibrillators",
        desc_pl=f"Defibrylatory AED udostępniane przez: {user['organization']}. Dane zgodne z wzorcowym zakresem danych akcji „GdzieAED”.",
        desc_en="AED defibrillators published in the reference data model.",
        landing=f"{base}/dane", license=sub["license"], frequency=sub["update_frequency"], resources=resources, tags=TAGS)
    return wrap([ds])


def dcat_jsonld(base: str, stats: dict) -> dict:
    def dist(fmt: str, media: str, path: str, title: str, lic: str) -> dict:
        return {"@type": "dcat:Distribution", "dct:title": title, "dcat:accessURL": {"@id": f"{base}{path}"},
                "dcat:downloadURL": {"@id": f"{base}{path}"}, "dcat:mediaType": media, "dct:format": fmt,
                "dct:license": {"@id": LICENSE_URI[lic]},
                "dct:conformsTo": {"@id": f"{base}/api/schema/tableschema.json"}}
    return {
        "@context": {"dcat": "http://www.w3.org/ns/dcat#", "dct": "http://purl.org/dc/terms/",
                     "foaf": "http://xmlns.com/foaf/0.1/", "vcard": "http://www.w3.org/2006/vcard/ns#"},
        "@id": f"{base}/api/dcat.jsonld", "@type": "dcat:Catalog",
        "dct:title": "GdzieAED – katalog danych o defibrylatorach",
        "dct:description": "Katalog zbiorów danych o automatycznych defibrylatorach zewnętrznych (AED) w Polsce.",
        "dct:language": {"@id": "http://publications.europa.eu/resource/authority/language/POL"},
        "dcat:dataset": [
            {"@id": f"{base}/dane#oficjalne", "@type": "dcat:Dataset",
             "dct:title": "Defibrylatory AED – dane dysponentów", "dct:identifier": "gdzieaed-polska",
             "dct:description": "Dane AED publikowane przez dysponentów, ujednolicone do wzorcowego zakresu.",
             "dcat:keyword": TAGS, "dcat:theme": {"@id": "http://publications.europa.eu/resource/authority/data-theme/HEAL"},
             "dct:accrualPeriodicity": {"@id": f"http://publications.europa.eu/resource/authority/frequency/{FREQ_DCAT['daily']}"},
             "dct:spatial": {"@id": "http://publications.europa.eu/resource/authority/country/POL"},
             "dct:modified": stats.get("generated_at"),
             "dcat:distribution": [dist("CSV", "text/csv", "/api/download/oficjalne.csv", "CSV", "CC-BY-4.0"),
                                   dist("GeoJSON", "application/geo+json", "/api/download/oficjalne.geojson", "GeoJSON", "CC-BY-4.0")]},
            {"@id": f"{base}/dane#pelny", "@type": "dcat:Dataset",
             "dct:title": "Defibrylatory AED – zbiór zintegrowany (z OpenStreetMap)", "dct:identifier": "gdzieaed-pelny",
             "dct:description": "Pełny zbiór: dane dysponentów + OpenStreetMap, z oceną jakości. Licencja ODbL.",
             "dcat:keyword": TAGS, "dcat:theme": {"@id": "http://publications.europa.eu/resource/authority/data-theme/HEAL"},
             "dct:modified": stats.get("generated_at"),
             "dcat:distribution": [dist("CSV", "text/csv", "/api/download/aed_polska.csv", "CSV", "ODbL-1.0"),
                                   dist("GeoJSON", "application/geo+json", "/api/download/aed_polska.geojson", "GeoJSON", "ODbL-1.0"),
                                   dist("XLSX", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                        "/api/download/aed_polska.xlsx", "XLSX", "ODbL-1.0")]},
        ],
    }
