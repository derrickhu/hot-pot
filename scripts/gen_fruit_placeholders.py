from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


@dataclass(frozen=True)
class FruitSpec:
    name: str
    filename: str
    base: tuple[int, int, int]
    accent: tuple[int, int, int]


def draw_circle(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: int, fill) -> None:
    x, y = center
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def draw_gloss(draw: ImageDraw.ImageDraw, center: tuple[int, int]) -> None:
    x, y = center
    draw.ellipse((x - 22, y - 28, x + 10, y - 6), fill=(255, 255, 255, 70))


def draw_label(draw: ImageDraw.ImageDraw, text: str, center: tuple[int, int], size: int) -> None:
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", size)
    except OSError:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    draw.text((center[0] - w / 2, center[1] - h / 2), text, font=font, fill=(255, 255, 255, 220))


def make_apple(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center = (size // 2, size // 2 + 6)
    draw_circle(draw, center, 92, (235, 74, 74, 255))
    draw_circle(draw, (center[0] - 18, center[1] - 18), 18, (120, 200, 90, 255))
    draw_gloss(draw, (center[0] - 18, center[1] - 26))
    draw_label(draw, "苹", center, 64)
    return img


def make_banana(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.pieslice((60, 70, 250, 210), start=200, end=20, fill=(255, 220, 90, 255))
    draw.pieslice((70, 80, 240, 200), start=200, end=20, fill=(255, 235, 150, 255))
    draw_gloss(draw, (120, 110))
    draw_label(draw, "蕉", (size // 2, size // 2 + 10), 64)
    return img


def make_grape(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    centers = [
        (size // 2, 92),
        (size // 2 - 34, 120),
        (size // 2 + 34, 120),
        (size // 2 - 18, 150),
        (size // 2 + 18, 150),
        (size // 2, 178),
    ]
    for c in centers:
        draw_circle(draw, c, 26, (142, 90, 215, 255))
        draw_circle(draw, (c[0] - 8, c[1] - 10), 8, (255, 255, 255, 55))
    draw_label(draw, "葡", (size // 2, 210), 56)
    return img


def make_orange(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center = (size // 2, size // 2 + 6)
    draw_circle(draw, center, 92, (242, 138, 46, 255))
    for angle in range(0, 360, 30):
        import math

        rad = math.radians(angle)
        x = center[0] + math.cos(rad) * 70
        y = center[1] + math.sin(rad) * 70
        draw.line((center[0], center[1], x, y), fill=(255, 210, 150, 90), width=3)
    draw_gloss(draw, (center[0] - 18, center[1] - 26))
    draw_label(draw, "橙", center, 64)
    return img


def make_watermelon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center = (size // 2, size // 2 + 10)
    draw.pieslice((40, 40, 270, 230), start=30, end=210, fill=(84, 183, 108, 255))
    draw.pieslice((52, 52, 258, 218), start=30, end=210, fill=(255, 92, 92, 255))
    draw.pieslice((64, 64, 246, 206), start=30, end=210, fill=(255, 210, 210, 255))
    for i in range(10):
        x = center[0] - 40 + i * 9
        y = center[1] + 10 + (i % 3) * 3
        draw.ellipse((x, y, x + 3, y + 3), fill=(20, 20, 20, 160))
    draw_gloss(draw, (center[0] - 30, center[1] - 40))
    draw_label(draw, "瓜", center, 60)
    return img


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out_dir = root / "assets" / "images"
    out_dir.mkdir(parents=True, exist_ok=True)

    makers = {
        "apple.png": make_apple,
        "banana.png": make_banana,
        "grape.png": make_grape,
        "orange.png": make_orange,
        "watermelon.png": make_watermelon,
    }

    size = 512
    for filename, maker in makers.items():
        image = maker(size)
        path = out_dir / filename
        image.save(path, format="PNG")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
