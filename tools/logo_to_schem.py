#!/usr/bin/env python3
"""Turn the ESA logo into a WorldEdit schematic for the spawn build.

    python3 tools/logo_to_schem.py                    # 100 wide, 2 deep
    python3 tools/logo_to_schem.py --width 120 --depth 3

Writes assets/esa.schem (Sponge schematic v2, which WorldEdit reads) and
assets/esa-schem-preview.png (the front face, one pixel per block, scaled up).
Needs Pillow: pip install pillow.

The letters stand upright. They read correctly from the SOUTH, looking north
(front face is the +Z side). The paste origin is the bottom centre of the
front face, so stand where that should be and run '//paste -a'.
Rotate first with '//rotate 90' (etc.) to face another way.

Blocks are concrete plus honeycomb blocks for the amber end: bright, not
flammable, no gravity.
"""
import argparse
import colorsys
import gzip
import io
import struct
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
DATA_VERSION = 3955  # 1.21.1; WorldEdit upgrades older data to the running version

# Blocks in gradient order, with the hue (degrees) where each band starts.
# The logo runs purple (~300) -> pink -> red (~0) -> orange -> amber (~32).
# Hues past 360 wrap, so red..amber are written as 350..395. All are bright,
# not flammable and not affected by gravity.
BANDS = [
    (0, "minecraft:purple_concrete"),
    (312, "minecraft:magenta_concrete"),
    (332, "minecraft:pink_concrete"),
    (347, "minecraft:red_concrete"),
    (368, "minecraft:orange_concrete"),
    (388, "minecraft:honeycomb_block"),
]
# For the preview only (approximate average texture colour).
PREVIEW_RGB = {
    "minecraft:purple_concrete": (100, 31, 156),
    "minecraft:magenta_concrete": (169, 48, 159),
    "minecraft:pink_concrete": (213, 101, 142),
    "minecraft:red_concrete": (142, 32, 32),
    "minecraft:orange_concrete": (224, 97, 0),
    "minecraft:honeycomb_block": (229, 148, 29),
}


def block_for(rgb):
    hue = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))[0] * 360
    if hue < 180:
        hue += 360
    return [name for start, name in BANDS if hue >= start][-1]


def logo_grid(path, width):
    """Return rows (top to bottom) of block names, or None for background.

    Each block covers a box of logo pixels. It is solid if most of the box is
    logo (saturated; the background is flat grey), and its colour is the
    average of only the logo pixels, so grey edges do not tint it.
    """
    img = Image.open(path).convert("RGB")
    sat = img.convert("HSV").getchannel("S")
    height = round(width * img.height / img.width)
    sx, sy = img.width / width, img.height / height
    grid = []
    for by in range(height):
        row = []
        for bx in range(width):
            total, fg = 0, [0, 0, 0, 0]
            for y in range(int(by * sy), int((by + 1) * sy)):
                for x in range(int(bx * sx), int((bx + 1) * sx)):
                    total += 1
                    if sat.getpixel((x, y)) > 60:
                        r, g, b = img.getpixel((x, y))
                        fg[0] += r; fg[1] += g; fg[2] += b; fg[3] += 1
            if fg[3] * 2 >= total:
                row.append(block_for([c / fg[3] for c in fg[:3]]))
            else:
                row.append(None)
        grid.append(row)
    return grid


# --- minimal NBT writer (big-endian, gzipped), enough for a Sponge schematic ---
TAG_INT, TAG_SHORT, TAG_BYTE_ARRAY, TAG_LIST, TAG_COMPOUND, TAG_INT_ARRAY = 3, 2, 7, 9, 10, 11


class Short(int):
    pass


class ByteArray(bytes):
    pass


class IntArray(list):
    pass


def _name(s):
    b = s.encode()
    return struct.pack(">H", len(b)) + b


def _tag_type(v):
    if isinstance(v, Short):
        return TAG_SHORT
    if isinstance(v, ByteArray):
        return TAG_BYTE_ARRAY
    if isinstance(v, IntArray):
        return TAG_INT_ARRAY
    if isinstance(v, int):
        return TAG_INT
    if isinstance(v, dict):
        return TAG_COMPOUND
    if isinstance(v, list):
        return TAG_LIST
    raise TypeError(type(v))


def _payload(v):
    t = _tag_type(v)
    if t == TAG_SHORT:
        return struct.pack(">h", v)
    if t == TAG_INT:
        return struct.pack(">i", v)
    if t == TAG_BYTE_ARRAY:
        return struct.pack(">i", len(v)) + bytes(v)
    if t == TAG_INT_ARRAY:
        return struct.pack(">i", len(v)) + b"".join(struct.pack(">i", i) for i in v)
    if t == TAG_LIST:
        elem = _tag_type(v[0]) if v else TAG_COMPOUND
        return struct.pack(">bi", elem, len(v)) + b"".join(_payload(i) for i in v)
    out = b""
    for k, item in v.items():
        out += struct.pack(">b", _tag_type(item)) + _name(k) + _payload(item)
    return out + b"\x00"


def write_nbt(path, root_name, root):
    raw = struct.pack(">b", TAG_COMPOUND) + _name(root_name) + _payload(root)
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", mtime=0) as gz:  # mtime=0: same input, same bytes
        gz.write(raw)
    path.write_bytes(buf.getvalue())


def varint(n):
    out = bytearray()
    while True:
        byte = n & 0x7F
        n >>= 7
        if n:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def build_schematic(grid, depth):
    height, width = len(grid), len(grid[0])
    palette = {"minecraft:air": 0}
    data = bytearray()
    # Sponge order: index = x + z*Width + y*Width*Length, y=0 at the bottom.
    for y in range(height):
        row = grid[height - 1 - y]
        for _z in range(depth):
            for x in range(width):
                block = row[x] or "minecraft:air"
                data += varint(palette.setdefault(block, len(palette)))
    return {
        "Version": 2,
        "DataVersion": DATA_VERSION,
        "Width": Short(width),
        "Height": Short(height),
        "Length": Short(depth),
        "Offset": IntArray([0, 0, 0]),
        # Paste origin: bottom centre of the front (+Z) face.
        "Metadata": {"WEOffsetX": -(width // 2), "WEOffsetY": 0, "WEOffsetZ": -(depth - 1)},
        "PaletteMax": len(palette),
        "Palette": palette,
        "BlockData": ByteArray(bytes(data)),
        "BlockEntities": [],
    }


def write_preview(grid, path, scale=6):
    height, width = len(grid), len(grid[0])
    img = Image.new("RGB", (width, height), (40, 40, 40))
    for y, row in enumerate(grid):
        for x, block in enumerate(row):
            if block:
                img.putpixel((x, y), PREVIEW_RGB[block])
    img.resize((width * scale, height * scale), Image.Resampling.NEAREST).save(path)


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--logo", type=Path, default=REPO / "assets/esa-logo.png")
    p.add_argument("--width", type=int, default=100, help="blocks wide (default 100)")
    p.add_argument("--depth", type=int, default=2, help="blocks thick (default 2)")
    p.add_argument("--out", type=Path, default=REPO / "assets/esa.schem")
    p.add_argument("--preview", type=Path, default=REPO / "assets/esa-schem-preview.png")
    args = p.parse_args()

    grid = logo_grid(args.logo, args.width)
    write_nbt(args.out, "Schematic", build_schematic(grid, args.depth))
    write_preview(grid, args.preview)

    counts = {}
    for row in grid:
        for b in row:
            if b:
                counts[b] = counts.get(b, 0) + 1
    print(f"{args.out.relative_to(REPO)}: {args.width} wide x {len(grid)} tall x {args.depth} deep")
    for name, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        print(f"  {name.split(':')[1]:<18} {n * args.depth:>6} blocks")


if __name__ == "__main__":
    main()
