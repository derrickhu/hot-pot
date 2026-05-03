#!/usr/bin/env python3
"""
按逻辑分辨率 750 宽为基准，将贴图降到「屏上够用、2x 内仍清晰」的上限，覆盖写回原路径。
运行：python3 scripts/downscale_game_textures.py
依赖：Pillow
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

# 路径（相对项目根）→ 约束：max_width 或 max_side（长边，用于小水果）
SPECS: dict[str, dict[str, int]] = {
    "assets/images/home_bg_summer.jpg": {"max_width": 900},
    "assets/images/game_logo_title.png": {"max_width": 900},
    "assets/images/home_play_btn.png": {"max_width": 900},
    "assets/images/home_footer_buttons.png": {"max_width": 900},
    "assets/images/settings_btn.png": {"max_side": 256},
    "subpackages/bowl_game/assets/images/bowl_tool_panels.png": {"max_width": 1000},
    "subpackages/bowl_game/assets/images/bowl_plates.png": {"max_width": 1000},
    "subpackages/bowl_game/assets/images/bowl_tool_buttons.png": {"max_width": 900},
    "subpackages/bowl_game/assets/images/ui_panel_free_btn.png": {"max_width": 640},
    "subpackages/bowl_game/assets/images/bowl_soup_milk.png": {"max_width": 420},
}


def resize_max_width(im: Image.Image, max_w: int) -> Image.Image:
    w, h = im.size
    if w <= max_w:
        return im
    nh = max(1, round(h * (max_w / w)))
    return im.resize((max_w, nh), Image.Resampling.LANCZOS)


def resize_max_side(im: Image.Image, max_side: int) -> Image.Image:
    w, h = im.size
    side = max(w, h)
    if side <= max_side:
        return im
    scale = max_side / side
    nw = max(1, round(w * scale))
    nh = max(1, round(h * scale))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def save_png(path: Path, im: Image.Image) -> None:
    im.save(path, format="PNG", optimize=True, compress_level=9)


def save_jpeg(path: Path, im: Image.Image) -> None:
    rgb = im.convert("RGB")
    rgb.save(path, format="JPEG", quality=86, optimize=True, progressive=True)


def process_file(rel: str, spec: dict[str, int]) -> None:
    path = ROOT / rel
    if not path.is_file():
        print(f"skip missing: {rel}", flush=True)
        return
    before = path.stat().st_size
    with Image.open(path) as im0:
        im = im0.copy()
        if im.mode not in ("RGBA", "RGB", "P"):
            im = im.convert("RGBA")
        if "max_width" in spec:
            out = resize_max_width(im, spec["max_width"])
        else:
            out = resize_max_side(im, spec["max_side"])
    if out.size == im.size and before == path.stat().st_size:
        print(f"unchanged: {rel} ({im.size[0]}x{im.size[1]})", flush=True)
        return
    suf = path.suffix.lower()
    if suf in (".jpg", ".jpeg"):
        save_jpeg(path, out)
    else:
        save_png(path, out)
    after = path.stat().st_size
    print(
        f"{rel}: {im.size[0]}x{im.size[1]} → {out.size[0]}x{out.size[1]}, "
        f"{before} → {after} bytes",
        flush=True,
    )


def process_bowl_fruits() -> None:
    bowl = ROOT / "subpackages/bowl_game/assets/images/bowl"
    if not bowl.is_dir():
        return
    for path in sorted(bowl.glob("*.png")):
        rel = str(path.relative_to(ROOT))
        before = path.stat().st_size
        with Image.open(path) as im0:
            im = im0.copy()
            if im.mode != "RGBA":
                im = im.convert("RGBA")
            out = resize_max_side(im, 256)
        if out.size == im.size:
            print(f"unchanged fruit: {path.name}", flush=True)
            continue
        save_png(path, out)
        after = path.stat().st_size
        print(
            f"{rel}: {im.size[0]}x{im.size[1]} → {out.size[0]}x{out.size[1]}, "
            f"{before} → {after} bytes",
            flush=True,
        )


def main() -> None:
    for rel, spec in sorted(SPECS.items()):
        process_file(rel, spec)
    process_bowl_fruits()
    print("done.", flush=True)


if __name__ == "__main__":
    main()
