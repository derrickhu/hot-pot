#!/usr/bin/env python3
"""Bowl 水果放大重生 v2：2×2 合图 = 两种水果 × 各 2 张；或单果单独生成。"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
BOWL = PROJECT / "subpackages/bowl_core/assets/images/bowl"
ASSETS = Path("/Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2")
THRESHOLD = 130

# 用芒果参考学「立体感画法」，不用碗截图（碗图会带来盘子/落地阴影）
STYLE_REF = PROJECT / "subpackages/bowl_core/assets/images/bowl/mango_2.png"

STYLE = """\
Recreate game fruit/topping ingredients from reference image(s), only sharper, larger, and richer.

The STYLE reference (mango) is ONLY for rendering technique: gradients, highlights, outline weight.
Do NOT copy any bowl, plate, tray, table, scene, or shadow from it.

Volume & color (required):
- Rich smooth gradients inside each piece (light → mid → dark), NOT flat single-fill.
- Bright glossy highlights on upper-left surfaces.
- Deeper saturated tones on sides / undersides / crevices to show thickness.
- Slight 3/4 top-down perspective so cut faces show depth.

Detail (required):
- Keep characteristic textures from each fruit reference (segment lines, seeds, rind, etc.).
- Outline = dark saturated version of THAT ingredient's color (NOT generic brown/black).

STRICT — background & isolation (critical for cutout):
- ONE isolated ingredient floating alone per cell.
- NO bowl, NO plate, NO dish, NO tray, NO saucer, NO cup, NO packaging.
- NO drop shadow, NO contact shadow, NO oval gray blob, NO ground shadow, NO glow on background.
- Pure flat #FFFFFF white background only. All shading must stay INSIDE the ingredient silhouette.
- Keep the SAME cut shape as each ingredient reference (do not change slice type).
"""

TOPPING_EXTRA = """\
TOPPING rules (extra strict):
- Dessert topping floats alone like the small refs — NEVER put it on a plate/tray/dish.
- NO green square tray, NO ceramic plate, NO bowl rim visible.
"""

# 2×2 = 两种水果，每种 2 张（占满 4 格）
GRID_2X2_DUO = """\
Output ONE square sprite sheet: 2 columns × 2 rows = 4 equal cells, wide WHITE gutters.

Layout (4 DIFFERENT ingredients — two fruit types, two variants each):
- TOP-LEFT: Fruit A variant 1 — match reference A1 exactly, larger and sharper.
- TOP-RIGHT: Fruit A variant 2 — match reference A2 exactly (different cut/angle from A1).
- BOTTOM-LEFT: Fruit B variant 1 — match reference B1 exactly.
- BOTTOM-RIGHT: Fruit B variant 2 — match reference B2 exactly.

Keep consistent art style across all 4 cells. Each cell is exactly one ingredient.
"""

# 单果：1×2 两格（有 _1/_2 差异的果）
GRID_1X2_PAIR = """\
Output ONE wide image: 1 row × 2 columns = 2 equal cells, WHITE gutter between.
- LEFT: match reference variant 1 exactly, larger and sharper.
- RIGHT: match reference variant 2 exactly (clearly different pose/cut from left).
"""

# 单果：单格（小料 _1/_2 相同，出一张复制）
GRID_1X1_SINGLE = """\
Output ONE square image with a single centered ingredient (no grid).
Match reference exactly, larger and sharper. Generous white margin.
"""


def img_hash(p: Path) -> str:
    im = Image.open(p).convert("RGBA")
    return hashlib.md5(im.tobytes()).hexdigest()


def is_identical_pair(fid: str) -> bool:
    p1, p2 = BOWL / f"{fid}_1.png", BOWL / f"{fid}_2.png"
    if not p1.is_file() or not p2.is_file():
        return False
    return img_hash(p1) == img_hash(p2)


def needs_regen(fid: str) -> bool:
    for n in (1, 2):
        p = BOWL / f"{fid}_{n}.png"
        if p.is_file() and max(Image.open(p).size) < THRESHOLD:
            return True
    return False


def all_fruit_ids() -> list[str]:
    ids: set[str] = set()
    for p in BOWL.glob("*.png"):
        if p.stem.endswith("_1"):
            ids.add(p.stem[:-2])
        elif p.stem.endswith("_2"):
            ids.add(p.stem[:-2])
    return sorted(ids)


def build_manifest() -> dict:
    regen_pair: list[str] = []
    regen_single: list[str] = []
    skip: list[str] = []
    for fid in all_fruit_ids():
        if not needs_regen(fid):
            skip.append(fid)
            continue
        if is_identical_pair(fid):
            regen_single.append(fid)
        else:
            regen_pair.append(fid)
    duo_batches: list[list[str]] = []
    rp = regen_pair[:]
    while len(rp) >= 2:
        duo_batches.append([rp.pop(0), rp.pop(0)])
    if rp:
        duo_batches.append([rp[0]])
    single_batches: list[list[str]] = []
    rs = regen_single[:]
    while len(rs) >= 2:
        single_batches.append([rs.pop(0), rs.pop(0)])
    if rs:
        single_batches.append([rs[0]])
    return {
        "threshold": THRESHOLD,
        "regen_pair": regen_pair,
        "regen_single": regen_single,
        "skip": skip,
        "duo_batches": duo_batches,
        "single_batches": single_batches,
    }


def ref_paths(fid: str) -> list[Path]:
    return [BOWL / f"{fid}_1.png", BOWL / f"{fid}_2.png"]


def prompt_duo(a: str, b: str) -> str:
    a_label, b_label = a.replace("_", " "), b.replace("_", " ")
    lines = [STYLE, GRID_2X2_DUO, f"Fruit A = {a_label}. Fruit B = {b_label}."]
    if is_identical_pair(a) or is_identical_pair(b):
        lines.append(TOPPING_EXTRA)
    lines += [
        "Reference order for GenerateImage attachments:",
        "  1=STYLE mango (technique only, no shadow/plate)",
        f"  2={a}_1.png  3={a}_2.png  4={b}_1.png  5={b}_2.png",
    ]
    if is_identical_pair(b):
        lines.append(f"Note: {b} _1/_2 are identical in game — top row two angles of A, bottom row two angles of B; B cells same shape as {b}_1 ref.")
    if is_identical_pair(a):
        lines.append(f"Note: {a} _1/_2 identical — two angles of same topping shape.")
    return "\n".join(lines) + "\n"


def ref_paths_for_duo(a: str, b: str) -> list[Path]:
    paths = [STYLE_REF, BOWL / f"{a}_1.png", BOWL / f"{a}_2.png"]
    if is_identical_pair(b):
        paths.append(BOWL / f"{b}_1.png")
    else:
        paths.extend([BOWL / f"{b}_1.png", BOWL / f"{b}_2.png"])
    return [p for p in paths if p.is_file()]


def prompt_solo_pair(fid: str) -> str:
    label = fid.replace("_", " ")
    return f"{STYLE}\n{GRID_1X2_PAIR}\nFruit: {label}. References: {fid}_1.png and {fid}_2.png.\n"


def prompt_solo_single(fid: str) -> str:
    label = fid.replace("_", " ")
    return f"{STYLE}\n{GRID_1X1_SINGLE}\nTopping: {label}. Reference: {fid}_1.png (in-game _1 and _2 are identical).\n"


def run_crop(
    raw: Path,
    rows: int,
    cols: int,
    names: list[str],
    out_dir: Path,
    *,
    skip_rembg: bool = False,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        str(PROJECT / "scripts/crop_equal_grid_to_bowl.py"),
        "--raw",
        str(raw),
        "--rows",
        str(rows),
        "--cols",
        str(cols),
        "--names",
        ",".join(names),
        "--out-dir",
        str(out_dir),
    ]
    if skip_rembg:
        cmd.append("--skip-rembg")
    subprocess.run(cmd, check=True)


def process_duo(raw: Path, a: str, b: str, out_root: Path, *, skip_rembg: bool = False) -> None:
    names = [f"{a}_1", f"{a}_2", f"{b}_1", f"{b}_2"]
    run_crop(raw, 2, 2, names, out_root, skip_rembg=skip_rembg)
    for fid in (a, b):
        if is_identical_pair(fid):
            p1 = out_root / f"{fid}_1.png"
            if p1.is_file():
                (out_root / f"{fid}_2.png").write_bytes(p1.read_bytes())


def process_solo_pair(raw: Path, fid: str, out_dir: Path, *, skip_rembg: bool = False) -> None:
    run_crop(raw, 1, 2, [f"{fid}_1", f"{fid}_2"], out_dir, skip_rembg=skip_rembg)


def process_solo_single(raw: Path, fid: str, out_dir: Path, *, skip_rembg: bool = False) -> None:
    run_crop(raw, 1, 1, [f"{fid}_1"], out_dir, skip_rembg=skip_rembg)
    p = out_dir / f"{fid}_1.png"
    if p.is_file():
        (out_dir / f"{fid}_2.png").write_bytes(p.read_bytes())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "cmd",
        choices=["manifest", "prompt-duo", "prompt-solo", "process-duo", "process-solo-pair", "process-solo-single"],
    )
    ap.add_argument("--a", help="fruit id A")
    ap.add_argument("--b", help="fruit id B")
    ap.add_argument("--id", help="fruit id (solo)")
    ap.add_argument("--raw", type=Path)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--skip-rembg", action="store_true")
    args = ap.parse_args()

    if args.cmd == "manifest":
        m = build_manifest()
        print(json.dumps(m, indent=2, ensure_ascii=False))
        print(
            f"\n{len(m['duo_batches'])} duo sheets (pair fruits), "
            f"{len(m['single_batches'])} duo sheets (toppings), "
            f"{len(m['regen_pair']) + len(m['regen_single'])} items total",
            flush=True,
        )
        return

    if args.cmd == "prompt-duo":
        if not args.a or not args.b:
            ap.error("--a and --b required")
        print(prompt_duo(args.a, args.b))
        return

    if args.cmd == "prompt-solo":
        if not args.id:
            ap.error("--id required")
        if is_identical_pair(args.id):
            print(prompt_solo_single(args.id))
        else:
            print(prompt_solo_pair(args.id))
        return

    out = (args.out or ASSETS / "final").expanduser().resolve()
    raw = args.raw.expanduser().resolve() if args.raw else None
    if not raw or not raw.is_file():
        ap.error("--raw required and must exist")

    if args.cmd == "process-duo":
        if not args.a or not args.b:
            ap.error("--a and --b required")
        process_duo(raw, args.a, args.b, out / f"{args.a}__{args.b}", skip_rembg=args.skip_rembg)
        print(f"Done -> {out / f'{args.a}__{args.b}'}", flush=True)
        return

    if not args.id:
        ap.error("--id required")
    dest = out / args.id
    if args.cmd == "process-solo-pair":
        process_solo_pair(raw, args.id, dest, skip_rembg=args.skip_rembg)
    else:
        process_solo_single(raw, args.id, dest, skip_rembg=args.skip_rembg)
    print(f"Done -> {dest}", flush=True)


if __name__ == "__main__":
    main()
