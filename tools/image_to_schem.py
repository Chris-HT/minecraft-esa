"""Turn a full-colour picture into an upright WorldEdit schematic (pixel art).

    python3 tools/image_to_schem.py assets/creative.jpg --saturation 1.4 --sharp-text
    python3 tools/image_to_schem.py assets/craftship.jpg --no-flat-bg --sharp-text --text-shadow
    python3 tools/image_to_schem.py assets/committed.jpg --sharp-text

(the settings used for the pictures in assets/).

Each block is the nearest match (in CIELAB, which follows how people see
colour) from a palette of solid, non-flammable, non-valuable blocks with no
gravity. Writes <name>.schem and <name>-schem-preview.png next to the image
unless --out is given. Pastes like esa.schem: stand at the bottom centre of
the front face, '//schem load <name>', '//paste -a'; reads from the south.

Needs Pillow (pip install pillow). Shares the schematic writer with
logo_to_schem.py.
"""
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageEnhance

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logo_to_schem import build_schematic, write_nbt  # noqa: E402

# Approximate average texture colour of each block. Left out on purpose:
# wool, planks and hay (flammable), concrete powder, sand and gravel (fall),
# and gold, emerald, diamond and lapis blocks (worth stealing).
PALETTE = {
    "white_concrete": (207, 213, 214),
    "orange_concrete": (224, 97, 1),
    "magenta_concrete": (169, 48, 159),
    "light_blue_concrete": (36, 137, 199),
    "yellow_concrete": (241, 175, 21),
    "lime_concrete": (94, 169, 24),
    "pink_concrete": (214, 101, 143),
    "gray_concrete": (55, 58, 62),
    "light_gray_concrete": (125, 125, 115),
    "cyan_concrete": (21, 119, 136),
    "purple_concrete": (100, 32, 156),
    "blue_concrete": (45, 47, 143),
    "brown_concrete": (96, 60, 32),
    "green_concrete": (73, 91, 36),
    "red_concrete": (142, 33, 33),
    "black_concrete": (8, 10, 15),
    "terracotta": (152, 94, 68),
    "white_terracotta": (210, 178, 161),
    "orange_terracotta": (162, 84, 38),
    "magenta_terracotta": (150, 88, 109),
    "light_blue_terracotta": (113, 109, 138),
    "yellow_terracotta": (186, 133, 35),
    "lime_terracotta": (104, 118, 53),
    "pink_terracotta": (162, 78, 79),
    "gray_terracotta": (58, 42, 36),
    "light_gray_terracotta": (135, 107, 98),
    "cyan_terracotta": (87, 91, 91),
    "purple_terracotta": (118, 70, 86),
    "blue_terracotta": (74, 60, 91),
    "brown_terracotta": (77, 51, 36),
    "green_terracotta": (76, 83, 42),
    "red_terracotta": (143, 61, 47),
    "black_terracotta": (37, 23, 17),
    "honeycomb_block": (229, 148, 29),
    "sponge": (195, 192, 74),
    "end_stone": (219, 222, 158),
    "sandstone": (216, 203, 155),
    "bone_block": (229, 225, 207),
    "quartz_block": (236, 230, 223),
    "smooth_stone": (158, 158, 158),
    "prismarine": (99, 156, 151),
    "dark_prismarine": (51, 91, 75),
    "warped_wart_block": (22, 119, 121),
    "nether_wart_block": (115, 3, 2),
    "blackstone": (42, 35, 40),
}


def _lab(rgb):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (lin(c) for c in rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883

    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


PALETTE_LAB = {name: _lab(rgb) for name, rgb in PALETTE.items()}
BG_TOLERANCE = 10  # CIELAB distance from the corner colour still counted as background
TEXT_FRACTION = 0.4  # with --sharp-text, share of white pixels that makes a block text
SHADOW_FACTOR = 0.45  # with --text-shadow, brightness kept by the blocks behind the text


def nearest(rgb):
    L, a, b = _lab(rgb)
    return min(PALETTE_LAB, key=lambda n: (PALETTE_LAB[n][0] - L) ** 2
               + (PALETTE_LAB[n][1] - a) ** 2 + (PALETTE_LAB[n][2] - b) ** 2)


def _is_white(rgb):
    return min(rgb) >= 225 and max(rgb) - min(rgb) < 30


def _average_blocks(img, width, height, sharp_text):
    """Downscale to one pixel per block, plus which blocks are white text.

    With sharp_text, a block is text if enough of its pixels are white, and
    every other block averages only its non-white pixels, so the anti-aliased
    edges of lettering do not turn into grey fringes.
    """
    if not sharp_text:
        return img.resize((width, height), Image.Resampling.BOX), None
    small = Image.new("RGB", (width, height))
    text = [[False] * width for _ in range(height)]
    sx, sy = img.width / width, img.height / height
    for by in range(height):
        for bx in range(width):
            pixels = [img.getpixel((x, y))
                      for y in range(int(by * sy), max(int(by * sy) + 1, int((by + 1) * sy)))
                      for x in range(int(bx * sx), max(int(bx * sx) + 1, int((bx + 1) * sx)))]
            other = [p for p in pixels if not _is_white(p)]
            text[by][bx] = len(other) <= len(pixels) * (1 - TEXT_FRACTION)
            use = other or pixels
            small.putpixel((bx, by), tuple(round(sum(c) / len(use)) for c in zip(*use)))
    return small, text


def image_grid(path, width, dither, saturation=1.0, flat_bg=True, sharp_text=False, text_shadow=False):
    """Rows (top to bottom) of 'minecraft:...' block names."""
    img = Image.open(path).convert("RGB")
    height = round(width * img.height / img.width)
    small, text = _average_blocks(img, width, height, sharp_text)
    # A flat background (the corners' colour) is filled with one block, so JPEG
    # noise does not speckle it. Decided before the saturation boost below.
    # Turn it off for a patterned background.
    is_bg = [[False] * width for _ in range(height)]
    if flat_bg:
        corners = [small.getpixel(p) for p in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1))]
        bg_lab = _lab([sorted(c[i] for c in corners)[1] for i in range(3)])
        is_bg = [[sum((u - v) ** 2 for u, v in zip(_lab(small.getpixel((x, y))), bg_lab)) < BG_TOLERANCE ** 2
                  for x in range(width)] for y in range(height)]
    # Averaging dulls colours, and the block palette is duller than a screen;
    # a little extra saturation brings the picture back.
    small = ImageEnhance.Color(small).enhance(saturation)
    bg_block = nearest(small.getpixel((0, 0)))
    px = [[list(small.getpixel((x, y))) for x in range(width)] for y in range(height)]
    grid = []
    for y in range(height):
        row = []
        for x in range(width):
            if text and text[y][x]:
                row.append("minecraft:white_concrete")
                continue
            # Drop shadow: darken the block down and right of any lettering,
            # so white text still reads on a pale background.
            shade = text_shadow and text and any(
                text[y - dy][x - dx] for dx, dy in ((1, 0), (0, 1), (1, 1)) if y - dy >= 0 and x - dx >= 0)
            if is_bg[y][x] and not shade:
                row.append("minecraft:" + bg_block)
                continue
            want = [min(255, max(0, c)) for c in px[y][x]]
            if shade:
                want = [c * SHADOW_FACTOR for c in want]
            name = nearest(want)
            row.append("minecraft:" + name)
            if dither:  # Floyd-Steinberg: pass the colour error on to neighbours
                err = [w - g for w, g in zip(want, PALETTE[name])]
                for dx, dy, k in ((1, 0, 7), (-1, 1, 3), (0, 1, 5), (1, 1, 1)):
                    if 0 <= x + dx < width and y + dy < height:
                        for i in range(3):
                            px[y + dy][x + dx][i] += err[i] * k / 16
        grid.append(row)
    return grid


def write_preview(grid, path, scale=6):
    height, width = len(grid), len(grid[0])
    img = Image.new("RGB", (width, height))
    for y, row in enumerate(grid):
        for x, block in enumerate(row):
            img.putpixel((x, y), PALETTE[block.removeprefix("minecraft:")])
    img.resize((width * scale, height * scale), Image.Resampling.NEAREST).save(path)


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("image", type=Path)
    p.add_argument("--width", type=int, default=64, help="blocks wide (default 64)")
    p.add_argument("--depth", type=int, default=1, help="blocks thick (default 1)")
    p.add_argument("--saturation", type=float, default=1.0, help="colour boost, e.g. 1.3 (default 1.0)")
    p.add_argument("--dither", action="store_true", help="smoother shading, noisier up close")
    p.add_argument("--no-flat-bg", dest="flat_bg", action="store_false",
                   help="keep a patterned background instead of filling it with one block")
    p.add_argument("--sharp-text", action="store_true", help="draw white lettering crisply, without grey edges")
    p.add_argument("--text-shadow", action="store_true", help="with --sharp-text, a dark shadow down-right of the letters")
    p.add_argument("--out", type=Path, help="default: <image name>.schem beside the image")
    args = p.parse_args()

    out = args.out or args.image.with_suffix(".schem")
    grid = image_grid(args.image, args.width, args.dither, args.saturation, args.flat_bg, args.sharp_text,
                       args.text_shadow)
    write_nbt(out, "Schematic", build_schematic(grid, args.depth))
    preview = out.with_name(out.stem + "-schem-preview.png")
    write_preview(grid, preview)
    used = {b for row in grid for b in row}
    print(f"{out}: {len(grid[0])} wide, {len(grid)} tall, {args.depth} deep, {len(used)} block types")
    print(f"preview: {preview}")


if __name__ == "__main__":
    main()
