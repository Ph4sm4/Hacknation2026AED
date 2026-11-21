"""Builds the final GdzieAED logo family (concept D – „Tablica”) as pure-vector SVG.

    python branding/build_logo.py && node branding/render.cjs

Typeface: Inter 800 (SIL Open Font License 1.1), converted to outlines.
"""
from __future__ import annotations

from brandkit import CAP_RATIO, INK, NAVY, RED, ROOT, WHITE, svg, text, tile

# re-exported for branding/warianty/build_variants.py
from brandkit import BOLT, HEART, PIN, load_fonts  # noqa: F401

OUT = ROOT / "branding" / "out"

H = 132          # board height (= height of the horizontal logo)
GAP = 22         # board ↔ wordmark
SIZE = 74        # wordmark size → cap height ≈ 53.8, two lines fill the board height exactly


def horizontal(word1: str, word2: str, board: str, sign: str) -> str:
    cap = SIZE * CAP_RATIO
    l1, w1 = text("GDZIE", word1, H + GAP, cap, SIZE)
    l2, w2 = text("AED", word2, H + GAP, H, SIZE)
    return svg(H + GAP + max(w1, w2), H, tile(0, 0, H, board, sign) + l1 + l2)


def vertical(word1: str, word2: str, board: str, sign: str) -> str:
    size = 64
    cap = size * CAP_RATIO
    _, w1 = text("GDZIE", word1, 0, 0, size)
    _, w2 = text("AED", word2, 0, 0, size)
    space = size * 0.26
    tw = w1 + space + w2
    W = max(tw, H)
    base = H + 30 + cap
    l1, _ = text("GDZIE", word1, (W - tw) / 2, base, size)
    l2, _ = text("AED", word2, (W - tw) / 2 + w1 + space, base, size)
    return svg(W, base, tile((W - H) / 2, 0, H, board, sign) + l1 + l2)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("pokaz-aed*"):
        old.unlink()
    files = {
        "gdzieaed-logo.svg": horizontal(NAVY, RED, RED, WHITE),
        "gdzieaed-logo-pionowe.svg": vertical(NAVY, RED, RED, WHITE),
        "gdzieaed-logo-negatyw.svg": horizontal(WHITE, WHITE, WHITE, RED),
        "gdzieaed-logo-pionowe-negatyw.svg": vertical(WHITE, WHITE, WHITE, RED),
        "gdzieaed-logo-mono.svg": horizontal(INK, INK, INK, WHITE),
        "gdzieaed-znak.svg": svg(64, 64, tile(0, 0, 64)),
    }
    for name, content in files.items():
        (OUT / name).write_text(content, encoding="utf-8")
        print("✓", name)


if __name__ == "__main__":
    main()
