"""Logo concept variants for the „GdzieAED” name – for team selection.

    python branding/warianty/build_variants.py && node branding/warianty/render_sheet.cjs

Outputs branding/warianty/out/<variant>-{logo,negatyw,ikona}.svg and a comparison sheet.
Wordmarks are converted to outlines (Inter 800, SIL OFL) – no font needed to display them.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_logo import BOLT, HEART, PIN, load_fonts  # noqa: E402

OUT = Path(__file__).resolve().parent / "out"
RED, NAVY, WHITE, INK = "#C8102E", "#0B3D91", "#FFFFFF", "#101828"
FONTS = load_fonts()
SIZE = 100.0
TRACK = -0.02


# --------------------------------------------------------------------------- glyph helpers
def _contours(ch: str):
    f = next(f for f in FONTS if ord(ch) in f.getBestCmap())
    gs = f.getGlyphSet()
    g = f.getBestCmap()[ord(ch)]
    rec = DecomposingRecordingPen(gs)
    gs[g].draw(rec)
    contours, cur = [], []
    for op, args in rec.value:
        cur.append((op, args))
        if op in ("closePath", "endPath"):
            contours.append(cur)
            cur = []
    return contours, gs[g].width, f["head"].unitsPerEm


def _bbox(contour):
    pts = [p for _, args in contour for p in args]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def _path(contours, scale, x, baseline) -> str:
    pen = SVGPathPen(None)
    t = TransformPen(pen, (scale, 0, 0, -scale, x, baseline))
    for c in contours:
        for op, args in c:
            getattr(t, op)(*args)
    return pen.getCommands()


def heart(cx: float, cy: float, w: float, fill: str, bolt: str | None = None) -> str:
    """Heart (+ optional bolt) centred at cx,cy with width w (heart path is 27 units wide, centre 32,26.4)."""
    k = w / 27
    b = f'<path fill="{bolt}" d="{BOLT}"/>' if bolt else ""
    return f'<g transform="translate({cx - 32 * k:.2f} {cy - 26.4 * k:.2f}) scale({k:.4f})"><path fill="{fill}" d="{HEART}"/>{b}</g>'


def pin(cx: float, top: float, h: float, fill: str, heart_fill: str | None = None, bolt: str | None = None) -> str:
    k = h / 60
    inner = ""
    if heart_fill:
        inner = f'<path fill="{heart_fill}" d="{HEART}"/>' + (f'<path fill="{bolt}" d="{BOLT}"/>' if bolt else "")
    return f'<g transform="translate({cx - 32 * k:.2f} {top - 2 * k:.2f}) scale({k:.4f})"><path fill="{fill}" d="{PIN}"/>{inner}</g>'


def wordmark(parts: list[tuple[str, str]], x: float, baseline: float, size: float = SIZE, dot: dict | None = None) -> tuple[str, float]:
    """parts = [(text, colour)]. dot = {char: fn(cx, cy, d) -> svg} replaces the dot of i / ? with a symbol."""
    out, cursor = [], x
    for text, colour in parts:
        for ch in text:
            contours, adv, upm = _contours(ch)
            s = size / upm
            if dot and ch in dot:
                boxes = [_bbox(c) for c in contours]
                # the dot is the smallest contour (works for both "i" and "?")
                idx = min(range(len(contours)), key=lambda i: (boxes[i][2] - boxes[i][0]) * (boxes[i][3] - boxes[i][1]))
                x0, y0, x1, y1 = boxes[idx]
                rest = [c for i, c in enumerate(contours) if i != idx]
                out.append(f'<path fill="{colour}" d="{_path(rest, s, cursor, baseline)}"/>')
                cx, cy, d = cursor + (x0 + x1) / 2 * s, baseline - (y0 + y1) / 2 * s, (x1 - x0) * s
                out.append(dot[ch](cx, cy, d))
            else:
                out.append(f'<path fill="{colour}" d="{_path(contours, s, cursor, baseline)}"/>')
            cursor += adv * s + TRACK * size
    return "".join(out), cursor - x - TRACK * size


def svg(w: float, h: float, body: str, bg: str | None = None, x0: float = 0, y0: float = 0) -> str:
    rect = f'<rect x="{x0}" y="{y0}" width="{w:.1f}" height="{h:.1f}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {w:.1f} {h:.1f}" role="img" '
            f'aria-label="GdzieAED"><title>GdzieAED</title>{rect}{body}</svg>\n')


CAP = 72.7  # Inter 800 cap height at size 100 (approx.)


def horizontal(mark_svg: str, mark_w: float, parts, gap: float = 26, h: float = 132, dot=None) -> tuple[str, float, float]:
    base = h / 2 + CAP / 2
    wm, ww = wordmark(parts, mark_w + gap, base, dot=dot)
    return mark_svg + wm, mark_w + gap + ww, h


# --------------------------------------------------------------------------- marks (64×64 grid, scaled)
def m_pin(h, pin_c=RED, heart_c=WHITE, bolt_c=RED):
    return pin(h * 0.39, 0, h, pin_c, heart_c, bolt_c), h * 0.72


def m_lupa(h, ring=NAVY, heart_c=RED, bolt_c=WHITE, lens=WHITE):
    k = h / 64
    body = (f'<g transform="scale({k:.4f})">'
            f'<path fill="{ring}" d="M40.6 44.8 46 39.4 63 56.4 57.6 61.8z"/>'
            f'<circle cx="27" cy="27" r="21.5" fill="{lens}" stroke="{ring}" stroke-width="7"/></g>')
    return body + heart(27 * k, 27.5 * k, 25 * k, heart_c, bolt_c), h


def m_tile(h, tile=RED, heart_c=WHITE, bolt_c=RED):
    k = h / 64
    body = f'<rect width="{64 * k:.2f}" height="{64 * k:.2f}" rx="{4 * k / 2:.2f}" fill="{tile}"/>'
    body += heart(32 * k, 28 * k, 40 * k, heart_c, bolt_c)
    # location tick under the heart – "tu jest"
    body += f'<path fill="{heart_c}" d="M{26 * k:.2f} {52 * k:.2f}h{12 * k:.2f}l{-6 * k:.2f} {7 * k:.2f}z"/>'
    return body, h


def m_cel(h, ring=NAVY, heart_c=RED, bolt_c=WHITE):
    k = h / 64
    body = (f'<g transform="scale({k:.4f})"><circle cx="32" cy="32" r="21" fill="none" stroke="{ring}" stroke-width="5.5"/>'
            f'<rect x="29.25" y="0" width="5.5" height="12" fill="{ring}"/><rect x="29.25" y="52" width="5.5" height="12" fill="{ring}"/>'
            f'<rect x="0" y="29.25" width="12" height="5.5" fill="{ring}"/><rect x="52" y="29.25" width="12" height="5.5" fill="{ring}"/></g>')
    return body + heart(32 * k, 33 * k, 26 * k, heart_c, bolt_c), h


# --------------------------------------------------------------------------- variants
def build() -> list[dict]:
    OUT.mkdir(parents=True, exist_ok=True)
    variants = []

    def save(key: str, name: str, concept: str, pos: tuple, neg: tuple, neg_bg: str, icon: str):
        (OUT / f"{key}-logo.svg").write_text(svg(pos[1], pos[2], pos[0]), encoding="utf-8")
        (OUT / f"{key}-negatyw.svg").write_text(svg(neg[1] + 40, neg[2] + 40, neg[0], neg_bg, -20, -20), encoding="utf-8")
        (OUT / f"{key}-ikona.svg").write_text(icon, encoding="utf-8")
        variants.append({"key": key, "name": name, "concept": concept, "neg_bg": neg_bg})

    words = [("Gdzie", NAVY), ("AED", RED)]
    words_w = [("Gdzie", WHITE), ("AED", WHITE)]

    # A – Pinezka
    mk, mw = m_pin(132)
    mkn, _ = m_pin(132, WHITE, RED, WHITE)
    save("a-pinezka", "A · Pinezka",
         "Kontynuacja obecnego znaku: pinezka lokalizacji z sercem i błyskawicą. Najprostsza odpowiedź na pytanie „gdzie?” – tu.",
         horizontal(mk, mw, words), horizontal(mkn, mw, words_w), RED,
         svg(64, 64, '<rect width="64" height="64" rx="4" fill="#C8102E"/>' + pin(32, 7, 50, WHITE, RED, WHITE)))

    # B – Lupa
    mk, mw = m_lupa(132)
    mkn, _ = m_lupa(132, WHITE, WHITE, NAVY, NAVY)
    save("b-lupa", "B · Lupa",
         "Szkło powiększające z sercem AED w soczewce – symbol wyszukiwania. Mówi „znajdź defibrylator” i dobrze działa jako ikona aplikacji.",
         horizontal(mk, mw, words), horizontal(mkn, mw, words_w), NAVY,
         svg(64, 64, '<rect width="64" height="64" rx="4" fill="#FFFFFF"/>' + f'<g transform="translate(7 7) scale(0.78)">{m_lupa(64)[0]}</g>'))

    # C – Kropka nad i
    # pin tip sits where the dot's bottom edge was; pin is ~3× the dot height
    dot_pin = {"i": lambda cx, cy, d: pin(cx, cy + d * 0.5 - d * 3.1, d * 3.1, RED, WHITE, RED)}
    dot_pin_w = {"i": lambda cx, cy, d: pin(cx, cy + d * 0.5 - d * 3.1, d * 3.1, WHITE, RED, WHITE)}
    base = 150
    wm, ww = wordmark([("gdzie", NAVY), ("AED", RED)], 0, base, dot=dot_pin)
    wmn, _ = wordmark([("gdzie", WHITE), ("AED", WHITE)], 0, base, dot=dot_pin_w)
    save("c-kropka", "C · Kropka nad i",
         "Logotyp typograficzny: kropkę nad „i” zastępuje pinezka z sercem. Znak ukryty w nazwie – minimalistyczny, nowoczesny, łatwy do zapamiętania.",
         (wm, ww, 176), (wmn, ww, 176), RED,
         svg(64, 64, '<rect width="64" height="64" rx="4" fill="#C8102E"/>' + pin(32, 6, 52, WHITE, RED, WHITE)))

    # D – Tablica (znak informacyjny)
    mk, mw = m_tile(132)
    mkn, _ = m_tile(132, WHITE, RED, WHITE)
    stack = []
    for txt, col, y in (("GDZIE", NAVY, 58), ("AED", RED, 128)):
        p, _ = wordmark([(txt, col)], 132 + 22, y, size=74 if txt == "GDZIE" else 74)
        stack.append(p)
    stack_n = []
    for txt, y in (("GDZIE", 58), ("AED", 128)):
        p, _ = wordmark([(txt, WHITE)], 132 + 22, y, size=74)
        stack_n.append(p)
    _, gw = wordmark([("GDZIE", NAVY)], 0, 0, size=74)
    save("d-tablica", "D · Tablica",
         "Kwadratowa tablica jak oznakowanie w przestrzeni publicznej, z sercem AED i znacznikiem „tu jest”. Napis w dwóch wierszach – instytucjonalny i czytelny z daleka.",
         (mk + "".join(stack), 132 + 22 + gw, 132), (mkn + "".join(stack_n), 132 + 22 + gw, 132), NAVY,
         svg(64, 64, m_tile(64)[0]))

    # E – Celownik
    mk, mw = m_cel(132)
    mkn, _ = m_cel(132, WHITE, WHITE, NAVY)
    save("e-celownik", "E · Celownik",
         "Znacznik „jesteś tutaj” z map nawigacyjnych otacza serce AED. Kojarzy się z geolokalizacją i szybkim namierzeniem najbliższego urządzenia.",
         horizontal(mk, mw, words), horizontal(mkn, mw, words_w), NAVY,
         svg(64, 64, '<rect width="64" height="64" rx="4" fill="#FFFFFF"/>' + f'<g transform="translate(5 5) scale(0.844)">{m_cel(64)[0]}</g>'))

    # F – Pytajnik
    dot_heart = {"?": lambda cx, cy, d: heart(cx, cy, d * 1.75, RED)}
    dot_heart_w = {"?": lambda cx, cy, d: heart(cx, cy, d * 1.75, WHITE)}
    wm, ww = wordmark([("Gdzie", NAVY), ("AED", RED), ("?", RED)], 0, 104, dot=dot_heart)
    wmn, _ = wordmark([("Gdzie", WHITE), ("AED", WHITE), ("?", WHITE)], 0, 104, dot=dot_heart_w)
    icon_q, _ = wordmark([("?", WHITE)], 0, 0, size=60, dot={"?": lambda cx, cy, d: heart(cx, cy, d * 1.75, RED)})
    save("f-pytajnik", "F · Pytajnik",
         "Nazwa jako pytanie, które zadaje każdy świadek zatrzymania krążenia. Kropkę pytajnika zastępuje serce – odpowiedzią jest dostęp do danych.",
         (wm, ww, 128), (wmn, ww, 128), RED,
         svg(64, 64, f'<rect width="64" height="64" rx="4" fill="{NAVY}"/><g transform="translate(19.5 54)">{icon_q}</g>'))

    (OUT / "variants.json").write_text(json.dumps(variants, ensure_ascii=False, indent=2), encoding="utf-8")
    return variants


if __name__ == "__main__":
    for v in build():
        print("✓", v["name"])
