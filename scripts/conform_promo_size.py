#!/usr/bin/env python3
"""
把推广图按平台合规标准尺寸输出（中心裁剪到目标比例 + 重采样到目标尺寸 + JPG 体积控制）。

平台合规尺寸（与 `.cursor/rules/game-assets.mdc` 一致）：
- 800x800   (1:1)   朋友圈九宫格 / 1:1 推广
- 1080x1920 (9:16)  竖版宣传图 / 短视频封面
- 1920x1080 (16:9)  横版宣传图 / 视频/横幅
- 1280x720  (16:9)  横版宣传图（备选）

示例：
    python3 scripts/conform_promo_size.py \
        --input  推广/portrait_01.png \
        --output 推广/portrait_01_1080x1920.jpg \
        --target 1080x1920

    python3 scripts/conform_promo_size.py \
        --input-glob '推广/portrait_*.png' \
        --out-dir   推广/conformed/ \
        --target    1080x1920
"""
from __future__ import annotations

import argparse
import io
import sys
from glob import glob
from pathlib import Path

from PIL import Image

ALLOWED_TARGETS = {
    "800x800": (800, 800),
    "1080x1920": (1080, 1920),
    "1920x1080": (1920, 1080),
    "1280x720": (1280, 720),
    "512x512": (512, 512),
    "650x250": (650, 250),
    "540x276": (540, 276),
}


def parse_target(s: str) -> tuple[int, int]:
    if s in ALLOWED_TARGETS:
        return ALLOWED_TARGETS[s]
    if "x" in s:
        a, b = s.lower().split("x", 1)
        return (int(a), int(b))
    raise argparse.ArgumentTypeError(f"unknown target: {s}")


def center_crop_to_ratio(im: Image.Image, target_w: int, target_h: int) -> Image.Image:
    sw, sh = im.size
    target_ratio = target_w / target_h
    src_ratio = sw / sh
    if abs(src_ratio - target_ratio) < 1e-4:
        return im
    if src_ratio > target_ratio:
        new_w = int(round(sh * target_ratio))
        x0 = (sw - new_w) // 2
        return im.crop((x0, 0, x0 + new_w, sh))
    else:
        new_h = int(round(sw / target_ratio))
        y0 = (sh - new_h) // 2
        return im.crop((0, y0, sw, y0 + new_h))


def save_jpg_under_kb(im: Image.Image, out_path: Path, quality: int, max_kb: int) -> tuple[int, int]:
    """
    保存为**标准 baseline JPEG**（非 progressive，部分平台只认 baseline）。
    去掉 EXIF / ICC 等元数据，避免上传校验报错。
    """
    q = quality
    while q >= 50:
        buf = io.BytesIO()
        im.convert("RGB").save(
            buf, format="JPEG",
            quality=q, optimize=True,
            progressive=False,
            subsampling=0,
        )
        kb = len(buf.getvalue()) / 1024
        if kb <= max_kb or q == 50:
            out_path.write_bytes(buf.getvalue())
            return q, int(kb)
        q -= 5
    return q, int(kb)


def save_png_under_kb(im: Image.Image, out_path: Path, max_kb: int) -> tuple[str, int]:
    """
    PNG 输出并控 KB：
    - 优先按"标准 RGBA"保存（部分平台对 P / 8-bit colormap PNG 校验失败）
    - 超 KB 才退 RGB（无 alpha 时）；仍超才退 P(256→16) 调色板
    - 关闭 progressive / interlace（IHDR interlace=0）
    """
    has_alpha = im.mode == "RGBA" and im.split()[-1].getextrema()[0] < 255
    target_mode = "RGBA" if has_alpha else "RGB"
    base = im.convert(target_mode)

    buf = io.BytesIO()
    base.save(buf, format="PNG", optimize=True)
    if len(buf.getvalue()) / 1024 <= max_kb:
        out_path.write_bytes(buf.getvalue())
        return target_mode, int(len(buf.getvalue()) / 1024)

    if target_mode == "RGBA":
        rgb = im.convert("RGB")
        b = io.BytesIO()
        rgb.save(b, format="PNG", optimize=True)
        if len(b.getvalue()) / 1024 <= max_kb:
            out_path.write_bytes(b.getvalue())
            return "RGB", int(len(b.getvalue()) / 1024)

    last_buf = buf
    last_mode = target_mode
    for colors in (256, 128, 64, 32, 16):
        try:
            quant = im.convert("RGBA").quantize(colors=colors, method=Image.MEDIANCUT)
        except Exception:
            quant = im.convert("P", palette=Image.ADAPTIVE, colors=colors)
        b = io.BytesIO()
        quant.save(b, format="PNG", optimize=True)
        last_buf, last_mode = b, f"P({colors})"
        if len(b.getvalue()) / 1024 <= max_kb:
            break
    out_path.write_bytes(last_buf.getvalue())
    return last_mode, int(len(last_buf.getvalue()) / 1024)


def conform_one(src: Path, target_w: int, target_h: int, dst: Path,
                quality: int, max_kb: int, fmt: str) -> None:
    raw = Image.open(src)
    if fmt == "png":
        if raw.mode != "RGBA":
            raw = raw.convert("RGBA")
        cropped = center_crop_to_ratio(raw, target_w, target_h)
        if cropped.size != (target_w, target_h):
            cropped = cropped.resize((target_w, target_h), Image.LANCZOS)
        dst.parent.mkdir(parents=True, exist_ok=True)
        mode, kb = save_png_under_kb(cropped, dst, max_kb)
        print(f"  {src.name}  {raw.size[0]}x{raw.size[1]}  ->  {dst.name}  "
              f"{target_w}x{target_h}  mode={mode}  {kb} KB")
    else:
        im = raw.convert("RGB")
        cropped = center_crop_to_ratio(im, target_w, target_h)
        if cropped.size != (target_w, target_h):
            cropped = cropped.resize((target_w, target_h), Image.LANCZOS)
        dst.parent.mkdir(parents=True, exist_ok=True)
        q, kb = save_jpg_under_kb(cropped, dst, quality, max_kb)
        print(f"  {src.name}  {im.size[0]}x{im.size[1]}  ->  {dst.name}  "
              f"{target_w}x{target_h}  q={q}  {kb} KB")


def main() -> None:
    ap = argparse.ArgumentParser(description="Conform a promo image to a platform-allowed size + KB cap.")
    ap.add_argument("--input", help="Single source image path.")
    ap.add_argument("--input-glob", help="Glob pattern (escape with quotes).")
    ap.add_argument("--output", help="Single output path (use with --input).")
    ap.add_argument("--out-dir", help="Output directory (use with --input-glob).")
    ap.add_argument(
        "--target", required=True,
        help="Target size, e.g. 1080x1920 / 1920x1080 / 800x800 / 1280x720.",
    )
    ap.add_argument(
        "--format", default="jpg", choices=("jpg", "jpeg", "png"),
        help="Output format. Default jpg (use png for 视频号头像 / 透明图标).",
    )
    ap.add_argument("--quality", type=int, default=88, help="JPEG quality starting point. Default 88.")
    ap.add_argument("--max-kb", type=int, default=400, help="Per-file max size (KB). Default 400.")
    ap.add_argument(
        "--suffix", default="",
        help="Suffix appended before extension when using --out-dir. "
        "Defaults to '_<W>x<H>' if empty.",
    )
    args = ap.parse_args()

    target_w, target_h = parse_target(args.target)
    suffix = args.suffix or f"_{target_w}x{target_h}"
    fmt = "png" if args.format == "png" else "jpg"
    out_ext = ".png" if fmt == "png" else ".jpg"

    if args.input and args.output:
        conform_one(Path(args.input), target_w, target_h, Path(args.output),
                    args.quality, args.max_kb, fmt)
        return
    if args.input_glob and args.out_dir:
        out_dir = Path(args.out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        for sp in sorted(glob(args.input_glob)):
            src = Path(sp)
            dst = out_dir / f"{src.stem}{suffix}{out_ext}"
            conform_one(src, target_w, target_h, dst, args.quality, args.max_kb, fmt)
        return
    print("error: provide either (--input + --output) or (--input-glob + --out-dir)", file=sys.stderr)
    sys.exit(2)


if __name__ == "__main__":
    main()
