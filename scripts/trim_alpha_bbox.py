#!/usr/bin/env python3
"""按 alpha 外接矩形裁掉 PNG 多余透明边（RGBA）。"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image


def trim_rgba(im: Image.Image) -> Image.Image:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox is None:
        return im
    return im.crop(bbox)


def main() -> None:
    p = argparse.ArgumentParser(description="Trim transparent margins using alpha bbox")
    p.add_argument("path", type=Path, help="Input PNG")
    p.add_argument("-o", "--output", type=Path, help="Output (default: overwrite input)")
    args = p.parse_args()
    inp = args.path
    if not inp.is_file():
        print(f"not found: {inp}", flush=True)
        sys.exit(1)
    im = Image.open(inp)
    before = im.size
    out = trim_rgba(im)
    dest = args.output or inp
    out.save(dest, optimize=True)
    print(f"{inp} -> {dest}  {before} -> {out.size}", flush=True)


if __name__ == "__main__":
    main()
