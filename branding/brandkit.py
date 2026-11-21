"""Shared brand geometry + vector typesetting (Inter 800 → SVG outlines) for GdzieAED."""
from __future__ import annotations

from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "frontend" / "node_modules" / "@fontsource-variable" / "inter" / "files"

RED = "#C8102E"
NAVY = "#0B3D91"
WHITE = "#FFFFFF"
INK = "#101828"

# 64×64 grid shapes
PIN = "M32 2C19.3 2 9 12.1 9 24.6 9 41.5 32 62 32 62s23-20.5 23-37.4C55 12.1 44.7 2 32 2z"
HEART = "M32 38.5S18.5 30.4 18.5 21.6c0-4.2 3.3-7.3 7.1-7.3 2.8 0 5 1.5 6.4 3.8 1.4-2.3 3.6-3.8 6.4-3.8 3.8 0 7.1 3.1 7.1 7.3 0 8.8-13.5 16.9-13.5 16.9z"
BOLT = "M34.6 17.2 27.4 27.4h4.3l-1.6 7 7.4-10.6h-4.3l1.4-6.6z"

CAP_RATIO = 0.727  # Inter 800 cap height / font size
TRACK = -0.02


def load_fonts() -> list[TTFont]:
    fonts = []
    for name in ("inter-latin-wght-normal.woff2", "inter-latin-ext-wght-normal.woff2"):
        fonts.append(instantiateVariableFont(TTFont(FONT_DIR / name), {"wght": 800}))
    return fonts


_FONTS: list[TTFont] | None = None


def fonts() -> list[TTFont]:
    global _FONTS
    if _FONTS is None:
        _FONTS = load_fonts()
    return _FONTS


def text(txt: str, colour: str, x: float, baseline: float, size: float, tracking: float = TRACK) -> tuple[str, float]:
    """Typeset `txt` as an SVG <path>. Returns (svg, advance width)."""
    pen = SVGPathPen(None)
    cursor = x
    for ch in txt:
        f = next(f for f in fonts() if ord(ch) in f.getBestCmap())
        gs = f.getGlyphSet()
        g = gs[f.getBestCmap()[ord(ch)]]
        s = size / f["head"].unitsPerEm
        rec = DecomposingRecordingPen(gs)
        g.draw(rec)
        rec.replay(TransformPen(pen, (s, 0, 0, -s, cursor, baseline)))
        cursor += g.width * s + tracking * size
    width = cursor - x - tracking * size
    return f'<path fill="{colour}" d="{pen.getCommands()}"/>', width


def heart(cx: float, cy: float, w: float, fill: str, bolt: str | None = None) -> str:
    k = w / 27
    b = f'<path fill="{bolt}" d="{BOLT}"/>' if bolt else ""
    return f'<g transform="translate({cx - 32 * k:.2f} {cy - 26.4 * k:.2f}) scale({k:.4f})"><path fill="{fill}" d="{HEART}"/>{b}</g>'


def tile(x: float, y: float, h: float, tile_c: str = RED, sign_c: str = WHITE) -> str:
    """The GdzieAED sign: square board, heart with defibrillation bolt, and a "tu jest" pointer."""
    k = h / 64
    return (f'<g transform="translate({x:.2f} {y:.2f})">'
            f'<rect width="{h:.2f}" height="{h:.2f}" rx="{2 * k:.2f}" fill="{tile_c}"/>'
            f'{heart(32 * k, 28 * k, 40 * k, sign_c, tile_c)}'
            f'<path fill="{sign_c}" d="M{26 * k:.2f} {52 * k:.2f}h{12 * k:.2f}l{-6 * k:.2f} {7 * k:.2f}z"/></g>')


def svg(w: float, h: float, body: str, bg: str | None = None, pad: float = 0, title: str = "GdzieAED") -> str:
    vb = f"{-pad:g} {-pad:g} {w + 2 * pad:.1f} {h + 2 * pad:.1f}" if pad else f"0 0 {w:.1f} {h:.1f}"
    rect = f'<rect x="{-pad:.1f}" y="{-pad:.1f}" width="{w + 2 * pad:.1f}" height="{h + 2 * pad:.1f}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w + 2 * pad:.0f}" height="{h + 2 * pad:.0f}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{rect}{body}</svg>\n')
