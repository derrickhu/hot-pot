#!/usr/bin/env python3
"""
对游戏内 PNG / JPEG 做体积优化，仅在输出更小或视觉等效时覆盖原文件。
- PNG：Pillow optimize + 最高 zlib 压缩（无损）
- JPEG：progressive + quality=85（略损，偏手机屏观感）

用法：在项目根目录执行
  python3 scripts/compress_game_images.py
"""
from __future__ import annotations

import io
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCAN_DIRS = [
    ROOT / "assets" / "images",
    ROOT / "subpackages" / "bowl_game" / "assets" / "images",
]


def _write_if_smaller(path: Path, data: bytes) -> None:
    old = path.stat().st_size
    new = len(data)
    if new < old:
        path.write_bytes(data)
        print(f"- {path.relative_to(ROOT)}  {old} → {new} bytes ({100 * new / old:.1f}%)")
    else:
        print(f"- {path.relative_to(ROOT)}  保持 {old} bytes（优化未更小则不改）")


def compress_png(path: Path) -> None:
    with Image.open(path) as im:
        im.load()
        buf = io.BytesIO()
        # 保持原模式（含 RGBA）；最高压缩等级 + optimize 预扫描
        im.save(buf, format="PNG", optimize=True, compress_level=9)
    _write_if_smaller(path, buf.getvalue())


def compress_jpeg(path: Path) -> None:
    with Image.open(path) as im:
        im.load()
        rgb = im.convert("RGB")
        buf = io.BytesIO()
        rgb.save(buf, format="JPEG", quality=85, optimize=True, progressive=True)
    _write_if_smaller(path, buf.getvalue())


def main() -> None:
    png_count = 0
    jpg_count = 0
    for base in SCAN_DIRS:
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file():
                continue
            suf = path.suffix.lower()
            if suf == ".png":
                compress_png(path)
                png_count += 1
            elif suf in (".jpg", ".jpeg"):
                compress_jpeg(path)
                jpg_count += 1
    print(f"完成：处理 PNG {png_count} 个，JPEG {jpg_count} 个。")


if __name__ == "__main__":
    main()
