#!/usr/bin/env python3
"""Generate the MEDBAY wordmark SVG assets in public/brand/.

The supplied design SVGs (frontend/design/SVG/*LOGO*.svg) render "MEDBAY" as
<text> set in the commercial Monument Extended face. To keep the logos
self-contained (no webfont dependency in dev, SSR or the standalone Docker
image), this script bakes every glyph to a <path> using the bundled
@fontsource/unbounded woff files, at the source SVGs' exact tspan coordinates.
Accent colors come from the location palette; the "DB" pair stays white.

Usage:  python3 frontend/scripts/gen-logo-assets.py
Requires: fontTools (pip install fonttools) — already used by the icon gen.
"""
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "node_modules" / "@fontsource" / "unbounded" / "files"
OUT = ROOT / "public" / "brand"

ACCENT = {"station": "#9f00e0", "ship": "#4c00ff", "ground": "#ff8f09"}
INK = "#ffffff"

F_WORD = TTFont(str(FONTS / "unbounded-latin-800-normal.woff"))
F_SUB = TTFont(str(FONTS / "unbounded-latin-500-normal.woff"))

_cmaps = {}
def glyph(font, ch):
    if font not in _cmaps:
        _cmaps[font] = font.getBestCmap()
    gname = _cmaps[font].get(ord(ch))
    if not gname:
        return None, 0
    gs = font.getGlyphSet()
    pen = SVGPathPen(gs)
    gs[gname].draw(pen)
    return pen.getCommands(), gs[gname].width


def emit(font, size, tspans, x_off=0.0, y=0.0, sx=1.0, ink_idx=()):
    """tspans: [(text, x_local, ls_em, ink)] -> svg <path> strings."""
    upm = font["head"].unitsPerEm
    s = size / upm
    out = []
    for idx, (text, x, ls, ink) in enumerate(tspans):
        pen_x = x
        for ch in text:
            d, adv = glyph(font, ch)
            if d:
                fill = INK if ink else "A"
                out.append(
                    (fill, f'<path d="{d}" transform="translate({x_off + pen_x * sx:.2f} {y:.2f}) scale({s * sx:.6f} {-s:.6f})" fill="{fill}"/>')
                )
            pen_x += adv * s + ls * size
    return out


def svg(viewbox, paths, accent):
    body = "\n  ".join(p.replace('fill="A"', f'fill="{accent}"') for _, p in paths)
    # group paths by fill for tidier output
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" aria-label="MEDBAY">\n'
        f"  {body}\n</svg>\n"
    )


# ---- STATION (viewBox 2848.15 x 631.02) ------------------------------------
station = emit(F_WORD, 534.77, [
    ("ME", 0, 0, False), ("D", 1006.43, -0.06, True), ("B", 1475.95, -0.25, True),
    ("A", 1924.08, -0.25, False), ("Y", 2317.67, 0, False),
], y=454.55) + emit(F_SUB, 96.27, [
    ("S", 0, 1.93, False), ("T", 278.6, 1.78, False), ("A", 538.81, 1.78, False),
    ("T", 809.42, 1.98, False), ("I", 1089.46, 1.98, False), ("O", 1306.06, 1.99, False),
    ("N ", 1588.61, 2.0, False), ("C", 2112.78, 1.88, False), ("A", 2384.64, 1.97, False),
    ("R", 2673.35, 1.98, False), ("E", 2950.31, 2.0, False),
], x_off=142.11, y=576.72, sx=0.77)

# ---- SHIP (viewBox 2832.12 x 627.47) ---------------------------------------
ship = emit(F_WORD, 531.76, [
    ("ME", 0, 0, False), ("D", 1000.76, -0.06, True), ("B", 1467.64, -0.25, True),
    ("A", 1913.25, -0.25, False), ("Y", 2304.62, 0, False),
], y=451.99) + emit(F_SUB, 95.73, [
    ("S", 0, 1.99, False), ("HI", 282.29, 1.97, False), ("P ", 786.77, 2.0, False),
    ("C", 1298.99, 1.88, False), ("A", 1569.32, 1.97, False), ("R", 1856.41, 1.98, False),
    ("E", 2131.81, 2.0, False),
], x_off=448.72, y=573.47, sx=0.77)

# ---- GROUND (viewBox 2854.52 x 501.41) — already path-based in the source ---
# Geometry copied 1:1 from design/SVG/*GROUND*; only fills are rewritten.
GROUND_PATHS = [
    ("A", "M577.81,377.3h-140.14V197.81l-102.95,179.49h-91.63l-102.95-179.49v179.49H0V0H172.48l116.42,215.6L405.33,0h172.48V377.3Z"),
    ("A", "M739.5,107.8v35.04h258.72v91.63h-258.72v35.04h258.72v107.8h-398.86V0h398.86V107.8h-258.72Z"),
    ("I", "M1471.46,188.65c0,128.28-85.7,188.65-176.79,188.65h-280.28V0h280.28c91.09,0,176.79,60.37,176.79,188.65Zm-140.14,0c0-70.07-49.59-70.07-79.77-70.07h-97.02v140.14h97.02c30.18,0,79.77,0,79.77-70.07Z"),
    ("I", "M1955.48,265.73c0,61.99-37.19,111.57-122.89,111.57h-344.96V0h328.79c85.7,0,112.11,38.81,112.11,95.94,0,24.26-11.32,49.05-29.65,70.61,32.88,23.72,56.6,58.21,56.6,99.18Zm-327.71-133.13h129.36c14.01,0,31.26,0,31.26-20.48s-17.25-20.48-31.26-20.48h-129.36v40.96Zm187.57,122.35c0-19.94-17.25-19.94-31.26-19.94h-156.31v39.89h156.31c14.01,0,31.26,0,31.26-19.94Z"),
    ("A", "M2274.56,309.39h-160.62l-25.87,67.91h-154.16L2090.22,0h208.05l156.31,377.3h-154.15l-25.87-67.91Zm-36.65-97.02l-43.66-115.35-43.66,115.35h87.32Z"),
    ("A", "M2330.61,0h161.7l100.25,140.14L2692.82,0h161.7l-191.88,253.33v123.97h-140.14v-123.97L2330.61,0Z"),
    ("A", "M236.86,464.05h33.03v36.39h-9.89l-.6-10.67c-4.91,6.99-12.72,11.64-23.8,11.64-19.19,0-30.94-12.42-30.94-34.93s11.75-34.93,33.18-34.93,31.24,10.58,32.06,27.46h-13.61c-.74-5.14-4.31-12.81-18.45-12.81-17.41,0-19.79,12.52-19.79,20.67s2.45,21.06,19.79,21.06c12.94,0,18.15-7.37,18.45-12.52h-19.42v-11.35Z"),
    ("A", "M473.42,480.26l9.6,20.18h-15.77l-8.41-18.14h-21.57v18.14h-13.39v-67.92h40.91c11.83,0,19.94,9.8,19.94,24.94,0,11.06-4.31,19.21-11.31,22.8Zm-36.15-12.61h23.8c4.02,0,10.27,0,10.27-10.19s-6.25-10.29-10.27-10.29h-23.8v20.47Z"),
    ("A", "M637.16,466.38c0-22.51,9.82-34.83,32.73-34.83s32.73,12.42,32.73,34.83-9.89,35.03-32.73,35.03Zm52.07,0c0-13.78-5.36-20.18-19.34-20.18s-19.34,6.31-19.34,20.18,5.43,20.38,19.34,20.38,19.34-6.5,19.34-20.38Z"),
    ("A", "M889.35,501.41c-22.91,0-32.73-11.35-32.73-35.03v-33.86h13.39v33.86c0,9.51,2.01,20.38,19.34,20.38s19.34-10.96,19.34-20.38v-33.86h13.39v33.86c0,23.58-9.89,35.03-32.73,35.03Z"),
    ("A", "M1143.55,432.52v67.92h-18.22l-35.48-50.94v50.94h-13.39v-67.92h18.15l35.56,51.04v-51.04h13.39Z"),
    ("A", "M1361.37,466.48c0,23.09-11.83,33.96-25.29,33.96h-37.79v-67.92h37.79c13.46,0,25.29,10.87,25.29,33.96Zm-13.39,0c0-16.5-6.84-19.31-16.96-19.31h-19.34v38.62h19.34c10.12,0,16.96-2.81,16.96-19.31Z"),
    ("A", "M1730.58,431.55c20.75,0,31.17,10.29,32.51,29.89h-13.61c-1.26-10.96-7.74-15.23-18.89-15.23-13.61,0-19.34,6.31-19.34,20.18s5.8,20.38,19.34,20.38c11.08,0,17.63-4.37,18.89-15.43h13.61c-1.34,19.7-11.75,30.08-32.51,30.08-22.91,0-32.73-12.42-32.73-35.03s9.82-34.83,32.73-34.83Z"),
    ("A", "M1959.41,485.98h-31.17l-5.58,14.46h-14.73l26.85-67.92h18.08l26.93,67.92h-14.8l-5.58-14.46Zm-4.98-13l-10.56-27.56-10.64,27.56h21.2Z"),
    ("A", "M2181.32,480.26l9.6,20.18h-15.77l-8.41-18.14h-21.57v18.14h-13.39v-67.92h40.91c11.83,0,19.94,9.8,19.94,24.94,0,11.06-4.31,19.21-11.31,22.8Zm-36.15-12.61h23.8c4.02,0,10.27,0,10.27-10.19s-6.25-10.29-10.27-10.29h-23.8v20.47Z"),
    ("A", "M2359.19,446.4v13.78h41.66v12.61h-41.66v13.78h41.66v13.88h-55.05v-67.92h55.05v13.88h-41.66Z"),
]
ground = [
    (fill, f'<path d="{d}" fill="{INK if fill == "I" else "A"}"/>')
    for fill, d in GROUND_PATHS
]

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "medbay-station.svg").write_text(svg("0 0 2848.15 631.02", station, ACCENT["station"]))
(OUT / "medbay-ship.svg").write_text(svg("0 0 2832.12 627.47", ship, ACCENT["ship"]))
(OUT / "medbay-ground.svg").write_text(svg("0 0 2854.52 501.41", ground, ACCENT["ground"]))
print("wrote", *sorted(p.name for p in OUT.iterdir()))
