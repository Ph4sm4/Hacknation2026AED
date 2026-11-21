"""Builds the „Pokaż AED” logo family as pure-vector SVG (wordmark converted to outlines).

    python branding/build_logo.py

Typeface: Inter (SIL Open Font License 1.1), weight 800 – instanced from the variable font
shipped with the frontend (@fontsource-variable/inter).
"""
from __future__ import annotations

from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "branding" / "out"
FONTS = ROOT / "frontend" / "node_modules" / "@fontsource-variable" / "inter" / "files"

RED = "#C8102E"
NAVY = "#0B3D91"
WHITE = "#FFFFFF"

# Mark geometry (64×64 grid): location pin + heart + lightning bolt
PIN = "M32 2C19.3 2 9 12.1 9 24.6 9 41.5 32 62 32 62s23-20.5 23-37.4C55 12.1 44.7 2 32 2z"
HEART = "M32 38.5S18.5 30.4 18.5 21.6c0-4.2 3.3-7.3 7.1-7.3 2.8 0 5 1.5 6.4 3.8 1.4-2.3 3.6-3.8 6.4-3.8 3.8 0 7.1 3.1 7.1 7.3 0 8.8-13.5 16.9-13.5 16.9z"
BOLT = "M34.6 17.2 27.4 27.4h4.3l-1.6 7 7.4-10.6h-4.3l1.4-6.6z"


def load_fonts() -> list[TTFont]:
    fonts = []
    for name in ("inter-latin-wght-normal.woff2", "inter-latin-ext-wght-normal.woff2"):
        f = TTFont(FONTS / name)
        fonts.append(instantiateVariableFont(f, {"wght": 800}))
    return fonts


def text_path(text: str, fonts: list[TTFont], size: float, x: float, baseline: float, tracking: float = -0.02) -> tuple[str, float]:
    """Returns (svg path data, advance width) for text set at `size` px."""
    d_parts, cursor = [], x
    for ch in text:
        if ch == " ":
            f = fonts[0]
            cursor += f["hmtx"][f.getBestCmap()[32]][0] * size / f["head"].unitsPerEm
            continue
        f = next(f for f in fonts if ord(ch) in f.getBestCmap())
        gname = f.getBestCmap()[ord(ch)]
        gs = f.getGlyphSet()
        scale = size / f["head"].unitsPerEm
        pen = SVGPathPen(gs)
        tpen = TransformPen(pen, (scale, 0, 0, -scale, cursor, baseline))
        gs[gname].draw(tpen)
        d_parts.append(pen.getCommands())
        cursor += gs[gname].width * scale + tracking * size
    return " ".join(d_parts), cursor - x - tracking * size


def cap_height(fonts: list[TTFont], size: float) -> float:
    f = fonts[0]
    gs = f.getGlyphSet()
    bp = BoundsPen(gs)
    gs[f.getBestCmap()[ord("E")]].draw(bp)
    return bp.bounds[3] * size / f["head"].unitsPerEm


def mark(x: float, y: float, s: float, pin=RED, heart=WHITE, bolt=RED) -> str:
    k = s / 64
    return (f'<g transform="translate({x:.2f} {y:.2f}) scale({k:.4f})">'
            f'<path fill="{pin}" d="{PIN}"/><path fill="{heart}" d="{HEART}"/><path fill="{bolt}" d="{BOLT}"/></g>')


def svg(w: float, h: float, body: str, bg: str | None = None, title: str = "Pokaż AED") -> str:
    rect = f'<rect width="{w:.0f}" height="{h:.0f}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{rect}{body}</svg>\n')


def horizontal(fonts, *, word1=NAVY, word2=RED, pin=RED, heart=WHITE, bolt=RED, bg=None) -> str:
    size = 100
    ch = cap_height(fonts, size)
    m = 132                     # mark height
    pad = 24                    # clear space baked into the artboard = 0 (artboard is tight; clear space defined in brand book)
    tx = m * 0.78 + 26
    base = m / 2 + ch / 2 - 4
    d1, w1 = text_path("Pokaż", fonts, size, tx, base)
    d2, w2 = text_path("AED", fonts, size, tx + w1 + size * 0.24, base)
    w = tx + w1 + size * 0.24 + w2 + 2
    body = mark(-m * 0.11, 0, m, pin, heart, bolt) + f'<path fill="{word1}" d="{d1}"/><path fill="{word2}" d="{d2}"/>'
    del pad
    return svg(w, m, body, bg)


def vertical(fonts, *, word1=NAVY, word2=RED, pin=RED, heart=WHITE, bolt=RED, bg=None) -> str:
    size = 100
    ch = cap_height(fonts, size)
    d1, w1 = text_path("Pokaż", fonts, size, 0, 0)
    d2, w2 = text_path("AED", fonts, size, 0, 0)
    gap = size * 0.24
    tw = w1 + gap + w2
    m = 220
    w = max(tw, m)
    base = m + 40 + ch
    d1, _ = text_path("Pokaż", fonts, size, (w - tw) / 2, base)
    d2, _ = text_path("AED", fonts, size, (w - tw) / 2 + w1 + gap, base)
    body = mark((w - m) / 2, 0, m, pin, heart, bolt) + f'<path fill="{word1}" d="{d1}"/><path fill="{word2}" d="{d2}"/>'
    return svg(w, base + 6, body, bg)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fonts = load_fonts()
    files = {
        "pokaz-aed-logo.svg": horizontal(fonts),
        "pokaz-aed-logo-pionowe.svg": vertical(fonts),
        "pokaz-aed-logo-negatyw.svg": horizontal(fonts, word1=WHITE, word2=WHITE, pin=WHITE, heart=RED, bolt=WHITE),
        "pokaz-aed-logo-mono.svg": horizontal(fonts, word1="#101828", word2="#101828", pin="#101828", heart=WHITE, bolt="#101828"),
        "pokaz-aed-znak.svg": svg(64, 64, mark(0, 0, 64)),
    }
    for name, content in files.items():
        (OUT / name).write_text(content, encoding="utf-8")
        print("✓", name)


if __name__ == "__main__":
    main()
