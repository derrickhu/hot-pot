#!/usr/bin/env python3
"""
从一张「rows × cols 严格等分」的合图按格裁切，可选 rembg 抠图 + alpha 裁边。

- 默认写入项目内 `subpackages/bowl_game/assets/images/bowl/`（与 `src/config/fruits.ts` 约定一致）。
- 指定 `--out-dir` 时写入任意目录（例如仓库外 game_assets，等你确认后再拷进游戏）。

单元格命名按行优先：--names 用逗号分隔，数量须等于 rows*cols。

示例（4 列 2 行 → 8 张）：
  python3 scripts/crop_equal_grid_to_bowl.py \\
    --raw /path/to/sheet.png --rows 2 --cols 4 \\
    --names mango_1,mango_2,banana_1,banana_2,banana_3,banana_4,apple_1,apple_2 \\
    --out-dir /path/to/game_assets/hot-pot/assets/bowl_export_xxx
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BOWL_DIR = PROJECT_ROOT / "subpackages" / "bowl_game" / "assets" / "images" / "bowl"
ALPHA_THRESH = 8
PAD = 2


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


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--raw", type=Path, required=True)
    p.add_argument("--rows", type=int, required=True)
    p.add_argument("--cols", type=int, required=True)
    p.add_argument("--names", type=str, required=True, help="comma-separated base names without .png")
    p.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="输出目录；不设则写入项目 subpackages/bowl_game/assets/images/bowl/",
    )
    p.add_argument("--skip-rembg", action="store_true")
    args = p.parse_args()

    names = [x.strip() for x in args.names.split(",") if x.strip()]
    if len(names) != args.rows * args.cols:
        print(f"names 数量 {len(names)} != rows*cols {args.rows * args.cols}", flush=True)
        sys.exit(1)

    out_dir = (args.out_dir.expanduser().resolve() if args.out_dir else DEFAULT_BOWL_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    im = Image.open(args.raw).convert("RGBA")
    w, h = im.size
    skill = Path.home() / ".cursor" / "skills" / "remove-background" / "scripts" / "rembg_single.py"
    if not args.skip_rembg and not skill.is_file():
        print(f"缺少 {skill}", flush=True)
        sys.exit(1)

    idx = 0
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        crops: list[tuple[str, Path]] = []
        for row in range(args.rows):
            y0 = row * h // args.rows
            y1 = (row + 1) * h // args.rows
            for col in range(args.cols):
                x0 = col * w // args.cols
                x1 = (col + 1) * w // args.cols
                cell = im.crop((x0, y0, x1, y1))
                name = names[idx]
                crop_path = td_path / f"{name}_crop.png"
                cell.save(crop_path, "PNG")
                crops.append((name, crop_path))
                idx += 1

        for name, crop_path in crops:
            out_png = out_dir / f"{name}.png"
            if args.skip_rembg:
                save = trim_rgba(Image.open(crop_path))
                save.save(out_png, "PNG", optimize=True)
                print(f"skip rembg {out_png} {save.size}", flush=True)
                continue
            nobg = td_path / f"{name}_nobg.png"
            subprocess.run(
                [sys.executable, str(skill), str(crop_path), "-o", str(nobg), "-m", "birefnet-general"],
                check=True,
            )
            save = trim_rgba(Image.open(nobg))
            save.save(out_png, "PNG", optimize=True)
            print(f"{out_png} {save.size}", flush=True)

    print("Done.", flush=True)


if __name__ == "__main__":
    main()
