"""Demo with a single phone: send an "AED needed" alert ~300 m from the most recently active responder.

    python -m aed.api.demo_alert            (API running on :8000, phone in "Tryb ratownika")
    python -m aed.api.demo_alert 52.2297 21.0122
"""
from __future__ import annotations

import json
import math
import sys
import time
import urllib.request

from . import db

API = "http://localhost:8000"
OFFSET_M = 300


def main() -> None:
    if len(sys.argv) == 3:
        lat, lon = float(sys.argv[1]), float(sys.argv[2])
    else:
        with db.connect() as c:
            r = c.execute("SELECT lat, lon, updated_at FROM responders ORDER BY updated_at DESC LIMIT 1").fetchone()
        if not r:
            sys.exit("Brak aktywnego ratownika – włącz w aplikacji Usługi → Tryb ratownika i spróbuj ponownie.")
        # ~300 m north-east of the responder, so the alert is clearly "nearby" but not on top of them
        d = OFFSET_M / math.sqrt(2)
        lat = r["lat"] + d / 111_320
        lon = r["lon"] + d / (111_320 * math.cos(math.radians(r["lat"])))
        print(f"Ratownik: {r['lat']:.5f}, {r['lon']:.5f} (aktualizacja {r['updated_at']} UTC)")
    body = json.dumps({"device_id": f"demo-{int(time.time())}-mac000000", "lat": lat, "lon": lon, "accuracy": 10}).encode()
    req = urllib.request.Request(f"{API}/api/alerts", data=body, method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as res:
        a = json.loads(res.read())
    aed = a["aed"]["nazwa"] if a.get("aed") else "brak"
    print(f"Alarm #{a['id']} w {lat:.5f}, {lon:.5f} · {a['adres'] or 'adres nieustalony'} · "
          f"powiadomieni: {a['recipients']} · najbliższy AED: {aed}")


if __name__ == "__main__":
    main()
