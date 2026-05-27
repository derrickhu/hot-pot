#!/usr/bin/env python3
"""从 2×2 合图按格重切指定素材：可调扩边/内缩，抠图后取最大连通块。"""
from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
RAW_DIR = Path("/Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2/raw_v2_bad")
FINAL_DIR = Path("/Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2/final_v2_bad")
REMBG = Path.home() / ".cursor/skills/remove-background/scripts/rembg_single.py"
ALPHA_THRESH = 8
PAD = 6

# fruit_id -> (sheet_a, sheet_b, row, col, expand_px, inset_px)
# row/col: 0-based in 2×2 grid, 行优先编号 0=TL 1=TR 2=BL 3=BR
FIXES: dict[str, tuple[str, str, int, int, int, int]] = {
    "banana_2": ("apple", "banana", 1, 1, 28, 0),
    # 蓝莓在合图下行（切半），上行是黑加仑串
    "blueberry_1": ("blackcurrant", "blueberry", 1, 0, 36, 0),
    "blueberry_2": ("blackcurrant", "blueberry", 1, 1, 36, 0),
    "honeydew_1": ("honeydew", "kiwi", 0, 0, 20, 14),
    "honeydew_2": ("honeydew", "kiwi", 0, 1, 20, 14),
    "kiwi_1": ("honeydew", "kiwi", 1, 0, 52, 0),
    "kiwi_2": ("honeydew", "kiwi", 1, 1, 36, 0),
    "passionfruit_2": ("passionfruit", "persimmon", 0, 1, 24, 12),
    "persimmon_1": ("passionfruit", "persimmon", 1, 0, 32, 0),
    "persimmon_2": ("passionfruit", "persimmon", 1, 1, 32, 0),
    "red_date_1": ("red_date", "starfruit", 0, 0, 16, 18),
    "starfruit_1": ("red_date", "starfruit", 1, 0, 32, 0),
    "starfruit_2": ("red_date", "starfruit", 1, 1, 32, 0),
    "watermelon_2": ("watermelon", "young_coconut", 0, 1, 20, 0),
    "lime_1": ("grapefruit", "lime", 1, 0, 44, 0),
    "lime_2": ("grapefruit", "lime", 1, 1, 40, 0),
}


def cell_rect(w: int, h: int, row: int, col: int, expand: int, inset: int) -> tuple[int, int, int, int]:
    mx, my = w // 2, h // 2
    x0, x1 = (0, mx) if col == 0 else (mx, w)
    y0, y1 = (0, my) if row == 0 else (my, h)
    if expand:
        x0 = max(0 if col == 0 else mx - expand, x0 - expand)
        x1 = min(mx + expand if col == 0 else w, x1 + expand)
        y0 = max(0 if row == 0 else my - expand, y0 - expand)
        y1 = min(my + expand if row == 0 else h, y1 + expand)
    if inset:
        x0 += inset
        y0 += inset
        x1 -= inset
        y1 -= inset
    return x0, y0, max(x0 + 8, x1), max(y0 + 8, y1)


def largest_component(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    a = im.split()[3]
    mask = a.point(lambda p: 255 if p > ALPHA_THRESH else 0)
    bbox = mask.getbbox()
    if not bbox:
        return im
    # 简单：整图 trim；若需去底部碎屑，用 getbbox 已够（碎屑若连着会保留）
    # 对分离碎屑：扫描连通域取最大
    try:
        import numpy as np
        from scipy import ndimage

        arr = np.array(mask)
        labeled, n = ndimage.label(arr > 0)
        if n <= 1:
            return trim_rgba(im)
        sizes = ndimage.sum(arr > 0, labeled, range(1, n + 1))
        keep = int(sizes.argmax()) + 1
        sel = labeled == keep
        out = im.copy()
        alpha = np.array(out.split()[3])
        alpha[~sel] = 0
        out.putalpha(Image.fromarray(alpha))
        return trim_rgba(out)
    except ImportError:
        return trim_rgba(im)


def trim_rgba(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    a = im.split()[3]
    bbox = a.point(lambda p: 255 if p > ALPHA_THRESH else 0).getbbox()
    if not bbox:
        return im
    w, h = im.size
    x0, y0, x1, y1 = bbox
    return im.crop(
        (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD), min(h, y1 + PAD)),
    )


def process_one(fid: str, expand: int, inset: int, row: int, col: int, a: str, b: str) -> None:
    raw = RAW_DIR / f"duo_{a}__{b}_v2.png"
    if not raw.is_file():
        raise FileNotFoundError(raw)
    out_dir = FINAL_DIR / f"{a}__{b}"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_png = out_dir / f"{fid}.png"

    im = Image.open(raw).convert("RGBA")
    w, h = im.size
    box = cell_rect(w, h, row, col, expand, inset)
    cell = im.crop(box)

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        crop = td / "crop.png"
        nobg = td / "nobg.png"
        cell.save(crop)
        subprocess.run(
            [sys.executable, str(REMBG), str(crop), "-o", str(nobg), "-m", "birefnet-general"],
            check=True,
        )
        out = largest_component(Image.open(nobg))
        out.save(out_png, "PNG", optimize=True)
    print(f"{fid} <- {raw.name} cell({row},{col}) expand={expand} inset={inset} -> {out_png} {out.size}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", action="append", help="fruit id, default all FIXES")
    args = ap.parse_args()
    ids = args.id or list(FIXES.keys())
    for fid in ids:
        if fid not in FIXES:
            print(f"unknown id {fid}", file=sys.stderr)
            continue
        a, b, row, col, expand, inset = FIXES[fid]
        process_one(fid, expand, inset, row, col, a, b)


if __name__ == "__main__":
    main()
