#!/usr/bin/env python3
"""
从 v5 合图（5 列 × 3 行）裁切前 3 列共 9 格，输出到 game_assets 工作目录，再调用 rembg 批量抠图，
按 alpha 裁掉多余透明边后写入游戏 assets/images。

原图归档目录：../game_assets/hot-pot/assets/raw/
（若 raw 中无文件，会从项目 assets/images 镜像一份。）

仅对已抠图结果做裁边（不重跑 rembg）：
  python3 scripts/export_v5_grid_fruits.py --trim-only
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GAME_ASSETS = Path(
    os.environ.get(
        "GAME_ASSETS_HOTPOT",
        PROJECT_ROOT.parent / "game_assets" / "hot-pot" / "assets",
    )
)
RAW_DIR = GAME_ASSETS / "raw"
WORK_DIR = GAME_ASSETS / "work" / "v5_grid"
CROPS_DIR = WORK_DIR / "crops"
NOBG_DIR = WORK_DIR / "crops_nobg"
GAME_IMAGES = PROJECT_ROOT / "assets" / "images"

PROJECT_V5 = PROJECT_ROOT / "assets" / "images" / "fruit_grid_3x3_test_cursor_v5_square.png"
RAW_V5 = RAW_DIR / "fruit_grid_3x3_test_cursor_v5_square.png"

COLS = 5
ROWS = 3

# 半透明边缘保留为内容；全透明裁掉
ALPHA_TRIM_THRESH = 8
# 裁完后四周留像素，避免抗锯齿贴边被切掉
TRIM_PAD = 2


def trim_rgba(im: Image.Image, thresh: int = ALPHA_TRIM_THRESH, pad: int = TRIM_PAD) -> Image.Image:
    im = im.convert("RGBA")
    alpha = im.split()[3]
    bbox = alpha.point(lambda p: 255 if p > thresh else 0).getbbox()
    if bbox is None:
        return im
    w, h = im.size
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w, x1 + pad)
    y1 = min(h, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def save_trimmed_png(src: Path, dest: Path) -> None:
    out = trim_rgba(Image.open(src))
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "PNG", optimize=True)
    print(f"trim {src.name} -> {out.size}", flush=True)


NAMES = [
    ("strawberry", "whole"),
    ("strawberry", "half_01"),
    ("strawberry", "half_02"),
    ("watermelon", "whole"),
    ("watermelon", "cube_01"),
    ("watermelon", "cube_02"),
    ("pineapple", "whole"),
    ("pineapple", "ring_01"),
    ("pineapple", "ring_02"),
]


def col_bounds(width: int, col: int) -> tuple[int, int]:
    left = col * width // COLS
    right = (col + 1) * width // COLS
    return left, right


def row_bounds(height: int, row: int) -> tuple[int, int]:
    top = row * height // ROWS
    bottom = (row + 1) * height // ROWS
    return top, bottom


def ensure_raw() -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if not RAW_V5.is_file():
        if PROJECT_V5.is_file():
            shutil.copy2(PROJECT_V5, RAW_V5)
        else:
            print(f"缺少原图：{RAW_V5} 或 {PROJECT_V5}", flush=True)
            sys.exit(1)
    return RAW_V5


def crop_cells(src: Path) -> None:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    CROPS_DIR.mkdir(parents=True, exist_ok=True)
    idx = 0
    for row in range(ROWS):
        for col in range(3):
            x0, x1 = col_bounds(w, col)
            y0, y1 = row_bounds(h, row)
            cell = im.crop((x0, y0, x1, y1))
            kind, variant = NAMES[idx]
            name = f"fruit_v5_{kind}_{variant}.png"
            out = CROPS_DIR / name
            cell.save(out, "PNG")
            print(f"crop {name} {cell.size}", flush=True)
            idx += 1


def run_rembg() -> None:
    skill = Path.home() / ".cursor" / "skills" / "remove-background" / "scripts" / "rembg_batch.py"
    if not skill.is_file():
        print(f"未找到 rembg_batch：{skill}", flush=True)
        sys.exit(1)
    if NOBG_DIR.exists():
        shutil.rmtree(NOBG_DIR)
    subprocess.run(
        [sys.executable, str(skill), str(CROPS_DIR), "-o", str(NOBG_DIR), "-m", "birefnet-general"],
        check=True,
    )


def copy_to_game() -> None:
    GAME_IMAGES.mkdir(parents=True, exist_ok=True)
    for p in sorted(NOBG_DIR.glob("fruit_v5_*.png")):
        dest = GAME_IMAGES / p.name
        save_trimmed_png(p, dest)
        print(f"game {dest.name}", flush=True)


def trim_only_game_assets() -> None:
    paths = sorted(GAME_IMAGES.glob("fruit_v5_*.png"))
    if not paths:
        print(f"未找到 {GAME_IMAGES}/fruit_v5_*.png", flush=True)
        sys.exit(1)
    for p in paths:
        save_trimmed_png(p, p)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--trim-only",
        action="store_true",
        help="只对 assets/images 下已有 fruit_v5_*.png 做透明边裁切（不重跑切图/rembg）",
    )
    args = parser.parse_args()
    if args.trim_only:
        trim_only_game_assets()
        print("Done.", flush=True)
        return

    ensure_raw()
    crop_cells(RAW_V5)
    run_rembg()
    copy_to_game()
    print("Done.", flush=True)


if __name__ == "__main__":
    main()
