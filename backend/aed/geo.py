"""Small dependency-free geo helpers: distance, grid index, voivodeship lookup."""
from __future__ import annotations

import json
import math
from collections import defaultdict
from functools import lru_cache

from .schema import ROOT

R = 6371008.8


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


class GridIndex:
    """Uniform lat/lon grid (~1.1 km cells) for fast radius / nearest queries on ~20k points."""

    def __init__(self, items: list[dict], cell: float = 0.01):
        self.cell = cell
        self.grid: dict[tuple[int, int], list[dict]] = defaultdict(list)
        for it in items:
            self.grid[self._key(it["szerokosc_geograficzna"], it["dlugosc_geograficzna"])].append(it)

    def _key(self, lat: float, lon: float) -> tuple[int, int]:
        return int(math.floor(lat / self.cell)), int(math.floor(lon / self.cell))

    def within(self, lat: float, lon: float, radius_m: float) -> list[tuple[float, dict]]:
        ky, kx = self._key(lat, lon)
        r_lat = radius_m / 111_320 / self.cell
        r_lon = radius_m / (111_320 * max(0.2, math.cos(math.radians(lat)))) / self.cell
        out = []
        for y in range(ky - math.ceil(r_lat), ky + math.ceil(r_lat) + 1):
            for x in range(kx - math.ceil(r_lon), kx + math.ceil(r_lon) + 1):
                for it in self.grid.get((y, x), ()):
                    d = haversine(lat, lon, it["szerokosc_geograficzna"], it["dlugosc_geograficzna"])
                    if d <= radius_m:
                        out.append((d, it))
        out.sort(key=lambda t: t[0])
        return out

    def nearest(self, lat: float, lon: float, k: int = 10, max_m: float = 50_000) -> list[tuple[float, dict]]:
        radius = 500.0
        while radius <= max_m:
            hits = self.within(lat, lon, radius)
            if len(hits) >= k:
                return hits[:k]
            radius *= 2
        return self.within(lat, lon, max_m)[:k]


# --------------------------------------------------------------------------- voivodeships
def _point_in_ring(x: float, y: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi:
            inside = not inside
        j = i
    return inside


@lru_cache
def _voivodeships() -> list[tuple[str, list, tuple]]:
    data = json.loads((ROOT / "data" / "boundaries" / "wojewodztwa.geojson").read_text(encoding="utf-8"))
    out = []
    for f in data["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        xs = [p[0] for poly in polys for p in poly[0]]
        ys = [p[1] for poly in polys for p in poly[0]]
        out.append((f["properties"]["nazwa"], polys, (min(xs), min(ys), max(xs), max(ys))))
    return out


def voivodeship(lat: float, lon: float) -> str:
    best, best_d = "", 1e9
    for name, polys, (x0, y0, x1, y1) in _voivodeships():
        if not (x0 - 0.05 <= lon <= x1 + 0.05 and y0 - 0.05 <= lat <= y1 + 0.05):
            continue
        for poly in polys:
            if _point_in_ring(lon, lat, poly[0]) and not any(_point_in_ring(lon, lat, h) for h in poly[1:]):
                return name
        # fallback for points just outside a simplified border
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        d = (cx - lon) ** 2 + (cy - lat) ** 2
        if d < best_d:
            best, best_d = name, d
    return best
