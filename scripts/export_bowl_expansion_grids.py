#!/usr/bin/env python3
"""
将 game_assets 下 bowl_expansion 合图切格 → rembg 批量抠图 → alpha 裁边，输出到 matte/bowl_expansion/。

- --inset-frac / --inset-frac-y：横向与纵向缩边可分开（纵向可更小，少裁上下）。
- --only-stems：只重切/重抠/重导出列出的 stem；可配合 --force-rembg。
- **rembg 默认**：与官方一致 **`post_process_mask=False`**（尽量不额外加工 mask，更接近原图、少误伤高光）。需要更「干净」硬边时可加 `--rembg-smooth-mask`。
- **可选后处理**：默认不做 straight alpha / 高光回补 / 毛边压制；需要时显式加 `--straighten-alpha`、`--highlight-restore` 或 `--fringe-suppress`。
- **去字裁切**（OpenCV）：默认 **关**；需要修合图字时再传 `--text-refine`。
- T3 为 4×4 合图，仅导出前 14 格（与 prompt 一致），后两格跳过。

示例：
  python3 scripts/export_bowl_expansion_grids.py --inset-frac 0.08 --inset-frac-y 0.035
  python3 scripts/export_bowl_expansion_grids.py --rembg-input-dir _rembg_in --force-rembg -m birefnet-general
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image

import cv2
import numpy as np

try:
    from rembg import new_session, remove as rembg_remove
except ImportError:
    new_session = None  # type: ignore
    rembg_remove = None  # type: ignore

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GAME_ASSETS = Path(
    os.environ.get(
        "GAME_ASSETS_HOTPOT",
        PROJECT_ROOT.parent / "game_assets" / "hot-pot" / "assets",
    )
).resolve()
RAW_DIR = GAME_ASSETS / "raw" / "bowl_expansion"
WORK = GAME_ASSETS / "work" / "bowl_expansion_export"
CROPS = WORK / "crops"
NOBG = WORK / "crops_nobg"
OUT_DIR = GAME_ASSETS / "matte" / "bowl_expansion"

ALPHA_THRESH = 8
TRIM_PAD = 3

REMBG_BATCH = Path.home() / ".cursor" / "skills" / "remove-background" / "scripts" / "rembg_batch.py"

# 与 rembg 官方默认一致：不对 mask 做形态学+二值化（更保高光与柔和过渡）。可加 --rembg-smooth-mask。
REMBG_POST_PROCESS_MASK_DEFAULT = False

# 仅在 BiRefNet 把邻域 specular 判空时，按原图亮度轻量拉回 alpha（默认开，尽量贴近原图色）
HIGHLIGHT_RESTORE_LUM = 235.0
HIGHLIGHT_RESTORE_ALPHA_LT = 200.0
HIGHLIGHT_RESTORE_BAND = 15

# 孔洞/暗部易被 birefnet 当背景：换插画向模型；water_chestnut 对 alpha matting 过于敏感用 u2net
REMBG_MODEL_OVERRIDES: dict[str, str] = {
    "lime_whole": "isnet-anime",
    "lotus_root": "isnet-anime",
    "water_chestnut": "u2net",
}
ALPHA_MATTING_STEMS: frozenset[str] = frozenset({"lime_whole", "lotus_root"})


def straighten_premultiplied_on_black(nobg_rgba: Image.Image) -> Image.Image:
    """
    rembg 的 naive_cutout 使用 composite(原图, 透明黑底, mask)，存盘 RGB 多为 **premultiplied**（已乘 alpha）。
    在白色/浅色底上预览会呈灰白圈边；除以 alpha 得到常规 straight RGBA。
    """
    arr = np.asarray(nobg_rgba.convert("RGBA"), dtype=np.float32)
    out = np.zeros_like(arr)
    a = arr[:, :, 3]
    m = a > 1e-3
    out[m, 3] = a[m]
    scale = 255.0 / np.maximum(a[m], 1e-3)
    out[m, :3] = np.minimum(arr[m, :3] * scale[:, np.newaxis], 255.0)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def restore_highlight_alpha(
    orig_rgba: Image.Image,
    nobg_rgba: Image.Image,
    lum_min: float = HIGHLIGHT_RESTORE_LUM,
    alpha_lt: float = HIGHLIGHT_RESTORE_ALPHA_LT,
    band: int = HIGHLIGHT_RESTORE_BAND,
) -> Image.Image:
    """
    BiRefNet 等模型易把主体 specular 判成背景。在「已识别前景」邻域内，按原图亮度把过低的 alpha 拉回，
    不碰纯黑底上的内容（底亮度极低）。
    """
    o = np.asarray(orig_rgba.convert("RGBA"), dtype=np.uint8)
    n = np.asarray(nobg_rgba.convert("RGBA"), dtype=np.uint8)
    if o.shape != n.shape:
        return Image.fromarray(n, "RGBA")
    rgb = o[:, :, :3].astype(np.float32)
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    a = n[:, :, 3].astype(np.float32)
    # 前景种子：只看模型 alpha；再膨胀一圈覆盖常被误判的亮部高光
    seed = (a > 40).astype(np.uint8) * 255
    if seed.max() == 0:
        return Image.fromarray(n, "RGBA")
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(3, band | 1), max(3, band | 1)))
    band_m = cv2.dilate(seed, k, iterations=1)
    heal = (band_m > 0) & (lum >= lum_min) & (a < alpha_lt)
    out = n.copy()
    out[heal, 3] = 255
    return Image.fromarray(out, "RGBA")


def suppress_dark_fringe(
    rgba: Image.Image,
    *,
    alpha_hi: int = 52,
    lum_hi: float = 62.0,
    dust_alpha: int = 8,
) -> Image.Image:
    """
    去掉轮廓外残留的半透明深色杂边（模型+软 mask 常见），不碰透明度较高的正常抗锯齿边。
    """
    arr = np.asarray(rgba.convert("RGBA"), dtype=np.float32)
    rgb = arr[:, :, :3]
    a = arr[:, :, 3]
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    dust = a <= float(dust_alpha)
    arr[dust, :] = 0.0
    fringe = (a > float(dust_alpha)) & (a < float(alpha_hi)) & (lum < lum_hi)
    arr[fringe, :] = 0.0
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def polish_nobg_output(
    orig_rgba: Image.Image,
    nobg_rgba: Image.Image,
    *,
    do_straighten: bool = False,
    do_highlight_restore: bool = False,
    do_fringe_suppress: bool = False,
) -> Image.Image:
    """rembg 之后：黑底预乘 → straight、可选高光回补、可选深色边压制。"""
    out = nobg_rgba
    if do_straighten:
        out = straighten_premultiplied_on_black(out)
    if do_highlight_restore:
        out = restore_highlight_alpha(orig_rgba, out)
    if do_fringe_suppress:
        out = suppress_dark_fringe(out)
    return out


def trim_rgba(
    im: Image.Image,
    thresh: int = ALPHA_THRESH,
    pad: int = TRIM_PAD,
) -> Image.Image:
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


def crop_cell(
    im: Image.Image,
    row: int,
    col: int,
    rows: int,
    cols: int,
    inset_frac_x: float,
    inset_frac_y: float,
) -> Image.Image:
    w, h = im.size
    x0 = col * w // cols
    x1 = (col + 1) * w // cols
    y0 = row * h // rows
    y1 = (row + 1) * h // rows
    if inset_frac_x > 0 or inset_frac_y > 0:
        cw, ch = x1 - x0, y1 - y0
        dx = cw * inset_frac_x
        dy = ch * inset_frac_y
        x0, x1 = int(round(x0 + dx)), int(round(x1 - dx))
        y0, y1 = int(round(y0 + dy)), int(round(y1 - dy))
        if x1 <= x0 or y1 <= y0:
            raise ValueError(f"inset too large for cell r{row}c{col}")
    return im.crop((x0, y0, x1, y1))


def _is_likely_text_component(bx: int, by: int, bw: int, bh: int, W: int, H: int, area: float) -> bool:
    """启发式：英文标签常见为横向宽条、纵向窄栏或近整格底纹。"""
    bw = max(int(bw), 1)
    bh = max(int(bh), 1)
    ar = bw / bh
    rar = bh / bw
    if bw >= 0.62 * W and bh <= 0.30 * H and ar >= 2.1:
        return True
    if bw >= 0.70 * W and bh <= 0.22 * H and ar >= 3.0:
        return True
    if bw >= 0.84 * W and bh <= 0.17 * H:
        return True
    if bh >= 0.48 * H and bw <= 0.26 * W and rar >= 1.9:
        return True
    if bw <= 0.22 * W and bh >= 0.44 * H and rar >= 2.0:
        return True
    if bw >= 0.90 * W and bh >= 0.90 * H:
        return True
    # 贴顶角的短片假名条（如缺字的 DURIAN）
    if by <= max(2, int(0.08 * H)) and bh <= int(0.22 * H) and bw >= int(0.22 * W):
        return True
    if area < max(30.0, 0.0016 * W * H):
        return True
    return False


def refine_cell_remove_embedded_labels(
    pil_rgba: Image.Image,
    stem: str | None = None,
    debug: bool = False,
) -> Image.Image:
    """
    rembg 之前：先做行/列投影去掉顶底条幅与左右「字+物」分栏，再在剩余区域做连通域合并裁切。
    """
    w, h = pil_rgba.size
    if w < 12 or h < 12:
        return pil_rgba

    arr = np.asarray(pil_rgba.convert("RGBA"), dtype=np.uint8)
    rgb = arr[:, :, :3].astype(np.float32)
    alpha = arr[:, :, 3]

    border = np.concatenate(
        [
            rgb[0, :, :].reshape(-1, 3),
            rgb[-1, :, :].reshape(-1, 3),
            rgb[:, 0, :].reshape(-1, 3),
            rgb[:, -1, :].reshape(-1, 3),
        ],
        axis=0,
    )
    bg = np.median(border, axis=0)
    dist = np.linalg.norm(rgb - bg, axis=2)

    bgr_u8 = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr_u8, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1].astype(np.float32)
    val = hsv[:, :, 2].astype(np.float32)
    gray = cv2.cvtColor(bgr_u8, cv2.COLOR_BGR2GRAY).astype(np.float32)

    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)

    v_med = float(np.median(val))
    # 略放宽，让灰字轮廓也能进掩膜，后面靠投影/形态学丢掉
    fg = (dist > 16.0) | (sat > 32.0) | (np.abs(val - v_med) > 36.0)
    fg &= alpha > 10

    sm = (fg.astype(np.uint8) * 255)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    sm = cv2.morphologyEx(sm, cv2.MORPH_CLOSE, k, iterations=2)
    sm = cv2.morphologyEx(sm, cv2.MORPH_OPEN, k, iterations=1)

    # ----- 行投影：削顶底英字条 -----
    rproj = sm.sum(axis=1).astype(np.float32)
    peak_r = max(float(rproj.max()), 1.0)
    thr_r = max(peak_r * 0.095, w * 0.016)
    y0, y1e = 0, h
    while y0 < int(0.46 * h) and rproj[y0] < thr_r:
        y0 += 1
    while y1e > int(0.54 * h) and rproj[y1e - 1] < thr_r:
        y1e -= 1
    if y1e <= y0 + 6:
        y0, y1e = 0, h

    sm_y = sm[y0:y1e, :]
    hh, ww = sm_y.shape

    # ----- 列投影：左字右图 / 左图右字 -----
    mx0, mx1e = 0, ww
    cproj = sm_y.sum(axis=0).astype(np.float32)
    if ww > 32 and float(cproj.max()) > 0:
        kc = min(25, max(3, (ww // 12) | 1))
        if kc >= 3:
            cs = cv2.GaussianBlur(cproj.reshape(1, -1), (1, kc), 0).flatten()
        else:
            cs = cproj
        lo, hi = int(0.18 * ww), int(0.82 * ww)
        if hi > lo + 10:
            imn = lo + int(np.argmin(cs[lo:hi]))
            if float(cs[imn]) < 0.32 * float(np.max(cs)):
                Lm = float(sm_y[:, :imn].sum())
                Rm = float(sm_y[:, imn:].sum())
                if Rm > Lm * 1.10:
                    mx0 = imn
                elif Lm > Rm * 1.10:
                    mx1e = imn

    if mx1e <= mx0 + 6:
        mx0, mx1e = 0, ww

    ox, oy = mx0, y0
    cw, ch = mx1e - mx0, y1e - y0
    if cw < 8 or ch < 8:
        return pil_rgba

    sm_cut = sm[oy : oy + ch, ox : ox + cw]
    mag_cut = mag[oy : oy + ch, ox : ox + cw]

    n, _, stats, _ = cv2.connectedComponentsWithStats(sm_cut, connectivity=8)
    comps: list[tuple[float, tuple[int, int, int, int], float]] = []
    for i in range(1, n):
        bx, by, bw, bh, sarea = stats[i]
        area = float(sarea)
        if area < max(32.0, 0.0016 * cw * ch):
            continue
        if _is_likely_text_component(bx, by, bw, bh, cw, ch, area):
            continue
        roi_mag = mag_cut[by : by + bh, bx : bx + bw]
        mean_mag = float(np.mean(roi_mag)) if roi_mag.size else 0.0
        if mean_mag < 3.4 and bw >= 0.40 * cw:
            continue
        comps.append((area, (bx, by, bw, bh), mean_mag))

    if not comps:
        all_c: list[tuple[float, tuple[int, int, int, int]]] = []
        for i in range(1, n):
            bx, by, bw, bh, sarea = stats[i]
            area = float(sarea)
            if area < max(22.0, 0.0010 * cw * ch):
                continue
            if bw >= 0.92 * cw and bh >= 0.92 * ch:
                continue
            all_c.append((area, (bx, by, bw, bh)))
        all_c.sort(key=lambda x: x[0], reverse=True)
        comps = [(a, b, 0.0) for a, b in all_c[:3]]

    if not comps:
        # 至少有投影裁切：只按 sm_cut 的非零外接框
        nz = cv2.findNonZero(sm_cut)
        if nz is None:
            return pil_rgba
        sx, sy, sw, sh = cv2.boundingRect(nz)
        bx0 = ox + sx
        by0 = oy + sy
        bx1 = bx0 + sw
        by1 = by0 + sh
    else:
        comps.sort(key=lambda x: x[0], reverse=True)
        chosen = comps[:3]
        bx0_l = min(c[1][0] for c in chosen)
        by0_l = min(c[1][1] for c in chosen)
        bx1_l = max(c[1][0] + c[1][2] for c in chosen)
        by1_l = max(c[1][1] + c[1][3] for c in chosen)
        pad = max(2, int(round(0.018 * min(cw, ch))))
        bx0 = ox + max(0, bx0_l - pad)
        by0 = oy + max(0, by0_l - pad)
        bx1 = ox + min(cw, bx1_l + pad)
        by1 = oy + min(ch, by1_l + pad)

    if bx1 - bx0 < 6 or by1 - by0 < 6:
        return pil_rgba
    if (bx1 - bx0) * (by1 - by0) > 0.92 * w * h:
        return pil_rgba

    out = pil_rgba.crop((bx0, by0, bx1, by1))
    if debug and stem:
        print(f"  text_refine {stem}: {w}x{h} -> {out.size[0]}x{out.size[1]}", flush=True)
    return out


def locate_stem(stem: str) -> tuple[dict, int, int] | None:
    for sheet in SHEETS:
        rows, cols = sheet["rows"], sheet["cols"]
        names: list[str | None] = sheet["names"]
        for i, n in enumerate(names):
            if n == stem:
                r, c = divmod(i, cols)
                return sheet, r, c
    return None


def rembg_one_stem(
    stem: str,
    crop_path: Path,
    out_path: Path,
    model: str,
    *,
    post_process_mask: bool = REMBG_POST_PROCESS_MASK_DEFAULT,
    do_straighten: bool = False,
    do_highlight_restore: bool = False,
    do_fringe_suppress: bool = False,
) -> None:
    """单张抠图；支持 alpha matting（若 rembg 版本支持）。"""
    if new_session is None or rembg_remove is None:
        print("需要安装 rembg：pip3 install rembg", flush=True)
        sys.exit(1)
    os.environ["OMP_NUM_THREADS"] = os.environ.get("OMP_NUM_THREADS", "8")
    providers = ["CPUExecutionProvider"]
    t0 = time.time()
    session = new_session(model, providers=providers)
    inp = Image.open(crop_path).convert("RGBA")
    use_am = stem in ALPHA_MATTING_STEMS
    kw = {"post_process_mask": post_process_mask}
    try:
        if use_am:
            out = rembg_remove(inp, session=session, alpha_matting=True, **kw)
        else:
            out = rembg_remove(inp, session=session, **kw)
    except TypeError:
        try:
            out = rembg_remove(inp, session=session, **kw)
        except TypeError:
            out = rembg_remove(inp, session=session)
    out = polish_nobg_output(
        inp,
        out,
        do_straighten=do_straighten,
        do_highlight_restore=do_highlight_restore,
        do_fringe_suppress=do_fringe_suppress,
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path, "PNG")
    print(f"rembg {stem} model={model} am={use_am} ppm={post_process_mask} {time.time() - t0:.1f}s -> {out_path.name}", flush=True)


# 每个 sheet：文件名、行列、按行优先的 stem 名（不含 .png）；None 表示跳过该格。
SHEETS: list[dict] = [
    {
        "file": "batchA_grid.png",
        "rows": 5,
        "cols": 3,
        "names": [
            "bayberry_whole", "bayberry_1", "bayberry_2",
            "blackberry_whole", "blackberry_1", "blackberry_2",
            "blackcurrant_whole", "blackcurrant_1", "blackcurrant_2",
            "cranberry_whole", "cranberry_1", "cranberry_2",
            "raspberry_whole", "raspberry_1", "raspberry_2",
        ],
    },
    {
        "file": "batchB_grid.png",
        "rows": 5,
        "cols": 3,
        "names": [
            "cantaloupe_whole", "cantaloupe_1", "cantaloupe_2",
            "honeydew_whole", "honeydew_1", "honeydew_2",
            "cucumber_whole", "cucumber_1", "cucumber_2",
            "starfruit_whole", "starfruit_1", "starfruit_2",
            "young_coconut_whole", "young_coconut_1", "young_coconut_2",
        ],
    },
    {
        "file": "batchC_grid.png",
        "rows": 5,
        "cols": 3,
        "names": [
            "kumquat_whole", "kumquat_1", "kumquat_2",
            "mandarin_whole", "mandarin_1", "mandarin_2",
            "lime_whole", "lime_1", "lime_2",
            "grapefruit_whole", "grapefruit_1", "grapefruit_2",
            "nectarine_whole", "nectarine_1", "nectarine_2",
        ],
    },
    {
        "file": "batchD_grid.png",
        "rows": 5,
        "cols": 3,
        "names": [
            "dragonfruit_whole", "dragonfruit_1", "dragonfruit_2",
            "durian_whole", "durian_1", "durian_2",
            "lychee_whole", "lychee_1", "lychee_2",
            "longan_whole", "longan_1", "longan_2",
            "passionfruit_whole", "passionfruit_1", "passionfruit_2",
        ],
    },
    {
        "file": "batchE_grid.png",
        "rows": 5,
        "cols": 3,
        "names": [
            "cherry_whole", "cherry_1", "cherry_2",
            "cherry_tomato_whole", "cherry_tomato_1", "cherry_tomato_2",
            "plum_whole", "plum_1", "plum_2",
            "persimmon_whole", "persimmon_1", "persimmon_2",
            "red_date_whole", "red_date_1", "red_date_2",
        ],
    },
    {
        "file": "batchF_grid.png",
        "rows": 5,
        "cols": 3,
        "names": [
            "gooseberry_whole", "gooseberry_1", "gooseberry_2",
            "grape_green_whole", "grape_green_1", "grape_green_2",
            "mulberry_whole", "mulberry_1", "mulberry_2",
            "sour_plum_whole", "sour_plum_1", "sour_plum_2",
            "chestnut_whole", "chestnut_1", "chestnut_2",
        ],
    },
    {
        "file": "batchT1_grid.png",
        "rows": 5,
        "cols": 2,
        "names": [
            "basil_seed", "boba_pearl",
            "coconut_jelly", "crystal_jelly",
            "grass_jelly", "mini_mochi",
            "pudding_cube", "red_bean",
            "sago", "taro_ball",
        ],
    },
    {
        "file": "batchT2_grid.png",
        "rows": 3,
        "cols": 3,
        "names": [
            "pop_boba", "cookie_crumb", "oat_flake",
            "marshmallow", "chocolate_chip", "almond_slice",
            "walnut_piece", "peanut", "snow_fungus",
        ],
    },
    {
        "file": "batchT3_grid.png",
        "rows": 4,
        "cols": 4,
        "names": [
            "black_rice", "dried_longan", "foxnut", "lily_bulb",
            "lotus_seed", "lotus_root", "peach_gum", "pumpkin_cube",
            "radish_heart", "sweet_potato", "taro_dice", "water_chestnut",
            "mint", "osmanthus",
            None,
            None,
        ],
    },
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--inset-frac",
        type=float,
        default=0.08,
        help="横向缩边占格宽比例（避开左右格线/标签）。默认 0.08",
    )
    ap.add_argument(
        "--inset-frac-y",
        type=float,
        default=None,
        help="纵向缩边占格高比例；默认 max(0.02, inset-frac * 0.55)，比横向更小以多保留上下",
    )
    ap.add_argument("--trim-pad", type=int, default=TRIM_PAD, help="抠图后 alpha 裁边额外留白像素")
    ap.add_argument(
        "--text-refine",
        action="store_true",
        help="rembg 前对单格做 OpenCV 去英文字条幅/侧栏（默认关；文字可先不修）",
    )
    ap.add_argument(
        "--highlight-restore",
        action="store_true",
        help="开启抠图后的高光 alpha 回补（默认关闭；偏后期修补）",
    )
    ap.add_argument(
        "--straighten-alpha",
        action="store_true",
        help="开启 premultiplied→straight 校正（默认关闭；偏后期修边）",
    )
    ap.add_argument(
        "--rembg-input-dir",
        type=str,
        default="",
        help="跳过切格：直接用该目录下 PNG 作为 rembg 输入；相对路径相对于 bowl_expansion_export（如 _rembg_in）",
    )
    ap.add_argument(
        "--fringe-suppress",
        action="store_true",
        help="去掉半透明深色杂边（默认关；偏「后期修边」）",
    )
    ap.add_argument(
        "--rembg-smooth-mask",
        action="store_true",
        help="开启 rembg mask 后处理（轮廓更硬、可能压高光；默认关=官方默认）",
    )
    ap.add_argument(
        "--text-refine-debug",
        action="store_true",
        help="打印每格去标签裁切前后的尺寸",
    )
    ap.add_argument(
        "--only-stems",
        type=str,
        default="",
        help="只处理这些 stem（逗号分隔）：从合图重切、重抠、写入 matte",
    )
    ap.add_argument(
        "--force-rembg",
        action="store_true",
        help="对已存在的 crops_nobg 也重新抠图（与 --only-stems 联用）",
    )
    ap.add_argument("--skip-rembg", action="store_true", help="只切格不抠图（调试）")
    ap.add_argument(
        "--resume",
        action="store_true",
        help="跳过切格与已存在的抠图；仅对 crops 中有而 crops_nobg 中缺的文件跑 rembg，再统一裁边输出",
    )
    ap.add_argument(
        "--only-trim",
        action="store_true",
        help="只把 crops_nobg 里已有 PNG 裁边写入 matte（不跑 rembg；用于抠图已在外部完成）",
    )
    ap.add_argument("-m", "--model", default="birefnet-general", help="rembg 批量默认模型")
    args = ap.parse_args()

    inset_x = args.inset_frac
    inset_y = args.inset_frac_y if args.inset_frac_y is not None else max(0.02, inset_x * 0.55)
    do_highlight_restore = args.highlight_restore
    do_straighten = args.straighten_alpha
    do_fringe_suppress = args.fringe_suppress
    post_process_mask = args.rembg_smooth_mask

    if not REMBG_BATCH.is_file():
        print(f"缺少 rembg_batch: {REMBG_BATCH}", flush=True)
        sys.exit(1)

    crop_source = CROPS
    custom_in = (args.rembg_input_dir or "").strip()
    only_list = [x.strip() for x in args.only_stems.split(",") if x.strip()]

    expected: list[str] = []

    if args.only_trim:
        NOBG.mkdir(parents=True, exist_ok=True)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        expected = sorted(p.stem for p in NOBG.glob("*.png"))
        if not expected:
            print(f"crops_nobg 为空: {NOBG}", flush=True)
            sys.exit(1)
        pad = args.trim_pad
        for stem in expected:
            nobg = NOBG / f"{stem}.png"
            final = trim_rgba(Image.open(nobg), pad=pad)
            dest = OUT_DIR / f"{stem}.png"
            dest.parent.mkdir(parents=True, exist_ok=True)
            final.save(dest, "PNG", optimize=True)
            print(f"final {dest.name} {final.size}", flush=True)
        print(f"\nDone (only-trim). {len(expected)} files -> {OUT_DIR}", flush=True)
        return

    if custom_in:
        rid = Path(custom_in)
        if not rid.is_absolute():
            rid = WORK / custom_in
        if not rid.is_dir():
            print(f"--rembg-input-dir 不是目录: {rid}", flush=True)
            sys.exit(1)
        expected = sorted(p.stem for p in rid.glob("*.png"))
        if not expected:
            print(f"{rid} 下无 PNG", flush=True)
            sys.exit(1)
        crop_source = rid.resolve()
        NOBG.mkdir(parents=True, exist_ok=True)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        print(f"抠图输入: {crop_source}（{len(expected)}），跳过切格", flush=True)
    elif only_list:
        CROPS.mkdir(parents=True, exist_ok=True)
        NOBG.mkdir(parents=True, exist_ok=True)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        sheet_cache: dict[str, Image.Image] = {}
        for stem in only_list:
            loc = locate_stem(stem)
            if loc is None:
                print(f"未知 stem（不在 SHEETS 里）: {stem}", flush=True)
                sys.exit(1)
            sheet, row, col = loc
            key = sheet["file"]
            if key not in sheet_cache:
                src = RAW_DIR / key
                if not src.is_file():
                    print(f"缺少合图: {src}", flush=True)
                    sys.exit(1)
                sheet_cache[key] = Image.open(src).convert("RGBA")
            im = sheet_cache[key]
            cell = crop_cell(im, row, col, sheet["rows"], sheet["cols"], inset_x, inset_y)
            if args.text_refine:
                cell = refine_cell_remove_embedded_labels(
                    cell, stem=stem, debug=args.text_refine_debug,
                )
            out_crop = CROPS / f"{stem}.png"
            cell.save(out_crop, "PNG")
            print(f"crop {key} -> {out_crop.name} {cell.size} inset_xy=({inset_x},{inset_y})", flush=True)
        expected = only_list
    elif args.resume:
        if not CROPS.is_dir():
            print(f"--resume 需要已有目录: {CROPS}", flush=True)
            sys.exit(1)
        crop_files = sorted(CROPS.glob("*.png"))
        if len(crop_files) < 1:
            print(f"crops 为空: {CROPS}", flush=True)
            sys.exit(1)
        expected = [p.stem for p in crop_files]
        NOBG.mkdir(parents=True, exist_ok=True)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        print(f"resume: {len(expected)} crops, existing nobg {len(list(NOBG.glob('*.png')))}", flush=True)
    else:
        if CROPS.exists():
            shutil.rmtree(CROPS)
        if NOBG.exists():
            shutil.rmtree(NOBG)
        CROPS.mkdir(parents=True, exist_ok=True)
        NOBG.mkdir(parents=True, exist_ok=True)
        OUT_DIR.mkdir(parents=True, exist_ok=True)

        for sheet in SHEETS:
            src = RAW_DIR / sheet["file"]
            if not src.is_file():
                print(f"缺少合图: {src}", flush=True)
                sys.exit(1)
            rows, cols = sheet["rows"], sheet["cols"]
            names: list[str | None] = sheet["names"]
            if len(names) != rows * cols:
                print(f"{sheet['file']}: names 数量 {len(names)} != {rows}x{cols}", flush=True)
                sys.exit(1)

            im = Image.open(src).convert("RGBA")
            idx = 0
            for row in range(rows):
                for col in range(cols):
                    stem = names[idx]
                    idx += 1
                    if stem is None:
                        continue
                    cell = crop_cell(im, row, col, rows, cols, inset_x, inset_y)
                    if args.text_refine:
                        cell = refine_cell_remove_embedded_labels(
                            cell, stem=stem, debug=args.text_refine_debug,
                        )
                    out_crop = CROPS / f"{stem}.png"
                    cell.save(out_crop, "PNG")
                    print(
                        f"crop {sheet['file']} -> {out_crop.name} {cell.size} inset_xy=({inset_x},{inset_y})",
                        flush=True,
                    )
                    expected.append(stem)

    if args.skip_rembg:
        print("skip rembg", flush=True)
        print(f"Crops only: {CROPS}", flush=True)
        return

    if args.force_rembg:
        for stem in expected:
            p = NOBG / f"{stem}.png"
            if p.is_file():
                p.unlink()
                print(f"force remove nobg {p.name}", flush=True)

    to_rembg = [stem for stem in expected if not (NOBG / f"{stem}.png").is_file()]
    if to_rembg:
        print(f"rembg 待处理: {len(to_rembg)} / {len(expected)}", flush=True)
        special_set = frozenset(REMBG_MODEL_OVERRIDES.keys()) | ALPHA_MATTING_STEMS
        special = [s for s in to_rembg if s in special_set]
        batch_stems = [s for s in to_rembg if s not in special]
        for stem in special:
            model = REMBG_MODEL_OVERRIDES.get(stem, args.model)
            rembg_one_stem(
                stem,
                crop_source / f"{stem}.png",
                NOBG / f"{stem}.png",
                model,
                post_process_mask=post_process_mask,
                do_straighten=do_straighten,
                do_highlight_restore=do_highlight_restore,
                do_fringe_suppress=do_fringe_suppress,
            )
        if batch_stems:
            tmp_in = WORK / "_rembg_staging"
            if tmp_in.exists():
                shutil.rmtree(tmp_in)
            tmp_in.mkdir(parents=True, exist_ok=True)
            for stem in batch_stems:
                shutil.copy2(crop_source / f"{stem}.png", tmp_in / f"{stem}.png")
            tmp_out = WORK / "_rembg_out"
            if tmp_out.exists():
                shutil.rmtree(tmp_out)
            tmp_out.mkdir(parents=True, exist_ok=True)
            cmd = [
                sys.executable,
                str(REMBG_BATCH),
                str(tmp_in),
                "-o",
                str(tmp_out),
                "-m",
                args.model,
            ]
            if post_process_mask:
                cmd.append("--smooth-mask")
            subprocess.run(cmd, check=True)
            for p in sorted(tmp_out.glob("*.png")):
                dest = NOBG / p.name
                if do_straighten or do_highlight_restore or do_fringe_suppress:
                    inp = Image.open(crop_source / p.name).convert("RGBA")
                    raw = Image.open(p).convert("RGBA")
                    polish_nobg_output(
                        inp,
                        raw,
                        do_straighten=do_straighten,
                        do_highlight_restore=do_highlight_restore,
                        do_fringe_suppress=do_fringe_suppress,
                    ).save(dest, "PNG")
                else:
                    shutil.copy2(p, dest)
        still = [stem for stem in expected if not (NOBG / f"{stem}.png").is_file()]
        if still:
            print(f"ERROR: rembg 后仍缺: {still}", flush=True)
            sys.exit(1)
    else:
        print("rembg 已齐全，跳过", flush=True)

    pad = args.trim_pad
    for stem in expected:
        nobg = NOBG / f"{stem}.png"
        if not nobg.is_file():
            print(f"ERROR: 缺少抠图: {nobg}", flush=True)
            sys.exit(1)
        final = trim_rgba(Image.open(nobg), pad=pad)
        dest = OUT_DIR / f"{stem}.png"
        dest.parent.mkdir(parents=True, exist_ok=True)
        final.save(dest, "PNG", optimize=True)
        print(f"final {dest.name} {final.size}", flush=True)

    print(f"\nDone. {len(expected)} files -> {OUT_DIR}", flush=True)


if __name__ == "__main__":
    main()
