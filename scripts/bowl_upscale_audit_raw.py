#!/usr/bin/env python3
"""粗查 raw 合图：按文件名列出，供人工标记需重生批次。"""
from pathlib import Path

RAW = Path("/Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2/raw")
FINAL = Path("/Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2/final")

# 小料 duo 批次（易出盘子）
SINGLE_PREFIXES = (
    "almond_slice", "basil_seed", "black_rice", "boba_pearl", "chocolate_chip",
    "coconut_jelly", "cookie_crumb", "crystal_jelly", "dried_longan", "foxnut",
    "grass_jelly", "ice_cube", "lily_bulb", "lotus_root", "lotus_seed",
    "marshmallow", "mini_mochi", "mint", "oat_flake", "osmanthus", "peach_gum",
    "peanut", "pop_boba", "pudding_cube", "pumpkin_cube", "radish_heart",
    "red_bean", "sago", "snow_fungus", "sour_plum", "sweet_potato", "taro_ball",
    "taro_dice", "walnut_piece", "water_chestnut",
)

def main() -> None:
    for p in sorted(RAW.glob("duo_*_v2.png")):
        name = p.stem.replace("duo_", "").replace("_v2", "")
        a, _, b = name.partition("__")
        tag = "TOPPING" if a in SINGLE_PREFIXES or b in SINGLE_PREFIXES else "fruit"
        done = (FINAL / name.replace("__", "__") / f"{a}_1.png").parent
        out = FINAL / f"{a}__{b}"
        status = "processed" if (out / f"{a}_1.png").is_file() else "raw-only"
        print(f"{tag:7} {status:10} {p.name}")

if __name__ == "__main__":
    main()
