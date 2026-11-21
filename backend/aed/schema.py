"""Loads the reference AED data model (schema/aed_schema.yaml) – the single source of truth."""
from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "schema" / "aed_schema.yaml"

REQUIRED_LABELS = {"O": "obowiązkowe", "Z": "zalecane", "F": "fakultatywne"}
TYPE_LABELS = {
    "string": "tekst",
    "number": "liczba dziesiętna",
    "integer": "liczba całkowita",
    "boolean": "tak/nie",
    "date": "data (RRRR-MM-DD)",
    "datetime": "data i czas (ISO 8601)",
}


@dataclass
class Field:
    name: str
    group: str
    label: str
    description: str
    type: str
    required: str
    example: Any = ""
    osm: str = ""
    enum: str | None = None
    format: str | None = None
    constraints: dict = field(default_factory=dict)

    @property
    def mandatory(self) -> bool:
        return self.required == "O"


@dataclass
class Schema:
    raw: dict
    fields: list[Field]

    @property
    def version(self) -> str:
        return self.raw["version"]

    @property
    def enums(self) -> dict[str, list[dict]]:
        return self.raw["enums"]

    def enum_values(self, name: str) -> list[str]:
        return [str(e["value"]) for e in self.enums[name]]

    @property
    def field_names(self) -> list[str]:
        return [f.name for f in self.fields]

    def by_name(self, name: str) -> Field:
        return next(f for f in self.fields if f.name == name)

    @property
    def aggregate_fields(self) -> list[dict]:
        return self.raw.get("aggregate_fields", [])

    @property
    def aggregate_field_names(self) -> list[str]:
        """Column order of the national (aggregated) dataset."""
        agg = [a["name"] for a in self.aggregate_fields]
        return ["id", *self.field_names, *[a for a in agg if a != "id"]]


@lru_cache
def load_schema(path: Path = SCHEMA_PATH) -> Schema:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    fields = [Field(**f) for f in raw["fields"]]
    return Schema(raw=raw, fields=fields)
