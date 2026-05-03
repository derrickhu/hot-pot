#!/usr/bin/env python3
"""
处理「5 列 × 3 行」水果合图：取前 3 列共 9 格 → rembg → alpha 裁边 → 写入游戏 assets/images。

每行一种水果，列顺序对应 a / b / c（与 docs/水果素材生图提示词.md 一致）。

示例：
  python3 scripts/process_fruit_grid_sheet.py \\
    --raw /path/to/game_assets/hot-pot/assets/raw/fruit_grid_batch1.png \\
    --rows blueberry,orange,lemon

仅裁边（已有抠图 PNG）：
  python3 scripts/process_fruit_grid_sheet.py --trim-only --glob 'fruit_blueberry_*_bowl.png'

新文件名后缀（不覆盖旧图，例如水果捞小块版）：
  python3 scripts/process_fruit_grid_sheet.py --raw ... --rows a,b,c --output-suffix _bowl
  → fruit_apple_a_bowl.png
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
WORK_ROOT = GAME_ASSETS / "work" / "grid_sheets"

COLS = 5
ROWS = 3
VARIANTS = ("a", "b", "c")

ALPHA_TRIM_THRESH = 8
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


def col_bounds(width: int, col: int) -> tuple[int, int]:
    left = col * width // COLS
    right = (col + 1) * width // COLS
    return left, right


def row_bounds(height: int, row: int) -> tuple[int, int]:
    top = row * height // ROWS
    bottom = (row + 1) * height // ROWS
    return top, bottom


def crop_cells(src: Path, fruit_ids: list[str], crops_dir: Path, name_suffix: str) -> None:
    if len(fruit_ids) != 3:
        print("--rows 必须恰好 3 个水果 id，逗号分隔", flush=True)
        sys.exit(1)
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    crops_dir.mkdir(parents=True, exist_ok=True)
    idx = 0
    suf = name_suffix.strip()
    for row in range(ROWS):
        fid = fruit_ids[row]
        for col in range(3):
            x0, x1 = col_bounds(w, col)
            y0, y1 = row_bounds(h, row)
            cell = im.crop((x0, y0, x1, y1))
            var = VARIANTS[col]
            name = f"fruit_{fid}_{var}{suf}.png"
            out = crops_dir / name
            cell.save(out, "PNG")
            print(f"crop {name} {cell.size}", flush=True)
            idx += 1


def run_rembg(crops_dir: Path, nobg_dir: Path) -> None:
    skill = Path.home() / ".cursor" / "skills" / "remove-background" / "scripts" / "rembg_batch.py"
    if not skill.is_file():
        print(f"未找到 rembg_batch：{skill}", flush=True)
        sys.exit(1)
    if nobg_dir.exists():
        shutil.rmtree(nobg_dir)
    subprocess.run(
        [sys.executable, str(skill), str(crops_dir), "-o", str(nobg_dir), "-m", "birefnet-general"],
        check=True,
    )


def copy_to_game(nobg_dir: Path, game_images: Path, pattern: str = "fruit_*.png") -> None:
    game_images.mkdir(parents=True, exist_ok=True)
    for p in sorted(nobg_dir.glob(pattern)):
        if not p.name.startswith("fruit_"):
            continue
        dest = game_images / p.name
        save_trimmed_png(p, dest)
        print(f"game {dest.name}", flush=True)


def trim_only_glob(game_images: Path, glob_pat: str) -> None:
    paths = sorted(game_images.glob(glob_pat))
    if not paths:
        print(f"未找到 {game_images}/{glob_pat}", flush=True)
        sys.exit(1)
    for p in paths:
        save_trimmed_png(p, p)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", type=Path, help="合图 PNG 路径（5×3 网格，用前 3 列）")
    parser.add_argument(
        "--rows",
        type=str,
        help="三行对应的水果英文 id，逗号分隔，如 blueberry,orange,lemon",
    )
    parser.add_argument(
        "--work-subdir",
        type=str,
        default="default",
        help="work 子目录名，避免多批互相覆盖",
    )
    parser.add_argument(
        "--skip-rembg",
        action="store_true",
        help="仅切图（调试用）",
    )
    parser.add_argument(
        "--trim-only",
        action="store_true",
        help="只对 assets/images 下匹配 --glob 的文件做裁边",
    )
    parser.add_argument(
        "--glob",
        dest="glob_pat",
        default="fruit_blueberry_*.png",
        help="与 --trim-only 联用，默认 fruit_blueberry_*.png",
    )
    parser.add_argument(
        "--output-suffix",
        type=str,
        default="",
        help="输出文件名后缀，如 _bowl → fruit_apple_a_bowl.png（旧无后缀文件保留不删）",
    )
    args = parser.parse_args()

    game_images = PROJECT_ROOT / "assets" / "images"

    if args.trim_only:
        trim_only_glob(game_images, args.glob_pat)
        print("Done.", flush=True)
        return

    if not args.raw or not args.raw.is_file():
        print("请提供存在的 --raw 合图路径", flush=True)
        sys.exit(1)
    if not args.rows:
        print("请提供 --rows", flush=True)
        sys.exit(1)

    fruit_ids = [x.strip().lower() for x in args.rows.split(",") if x.strip()]
    work_dir = WORK_ROOT / args.work_subdir
    crops_dir = work_dir / "crops"
    nobg_dir = work_dir / "crops_nobg"

    crop_cells(args.raw.resolve(), fruit_ids, crops_dir, args.output_suffix)
    if args.skip_rembg:
        print("skip rembg", flush=True)
        sys.exit(0)
    run_rembg(crops_dir, nobg_dir)
    copy_to_game(nobg_dir, game_images, "fruit_*.png")
    print("Done.", flush=True)


if __name__ == "__main__":
    main()
