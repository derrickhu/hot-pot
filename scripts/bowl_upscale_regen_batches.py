#!/usr/bin/env python3
"""生成 bowl 水果放大重生合图提示词（4x3，每批 6 种 x2 视角）。"""
from __future__ import annotations

STYLE = """
STYLE (match reference mango game asset exactly):
- 2D hand-painted cartoon fruit ingredient for a casual mobile fruit-bowl game.
- Thick warm dark maroon-brown outer outline, clean sharp silhouette, NO fuzzy fringe.
- Saturated juicy colors, top-left highlight, soft internal shading only.
- Slight top-down 3/4 view, ONE object centered per cell, large and crisp (~70% of cell).
- Solid pure WHITE #FFFFFF background only. NO drop shadow, NO cast shadow, NO glow outside object.
- NO text, NO watermark, NO plate, NO bowl, NO hands, NO UI.

GRID: 4 columns x 3 rows, 12 equal cells, generous gutters, objects never touch cell borders.
Each row has TWO variants of the SAME fruit (left=variant1, right=variant2) — same cut type, only rotation/angle differs.
"""

# (variant1, variant2) cut descriptions per fruit id
CUTS: dict[str, tuple[str, str]] = {
    "nectarine": (
        "small nectarine wedge, fuzzy red-orange skin rim, golden flesh, tiny pit hint",
        "same nectarine wedge, rotated ~30°",
    ),
    "chestnut": (
        "roasted chestnut piece, glossy brown shell, pale yellow flesh peeking",
        "same chestnut piece, slight tilt",
    ),
    "kumquat": (
        "thin kumquat citrus wheel slice, golden-orange pulp segments, thin rind ring",
        "same kumquat wheel slice, rotated ~30°, identical thickness",
    ),
    "blackberry": (
        "single plump blackberry, dark purple drupelets, tiny green cap",
        "same single blackberry, rotated ~30°, same scale",
    ),
    "blackcurrant": (
        "single blackcurrant berry, deep purple-black, subtle bloom",
        "same single blackcurrant, rotated ~30°, same scale",
    ),
    "raspberry": (
        "single red raspberry cone, bumpy drupelets, small green hull",
        "same single raspberry, rotated ~30°, same scale",
    ),
    "osmanthus": (
        "tiny dried osmanthus flower cluster, golden yellow petals",
        "same osmanthus cluster, looser scatter, same scale",
    ),
    "mandarin": (
        "small mandarin orange segment, bright orange pulp, white pith edge",
        "two mandarin segments, same size, different overlap angle",
    ),
    "dragonfruit": (
        "dragonfruit cube dice, white flesh, black seeds, pink skin edge",
        "same dragonfruit dice, rotated cube angle",
    ),
    "grape_green": (
        "2-3 green grape berries on short stem, translucent green",
        "4 green grapes small cluster, same style, tilted",
    ),
    "lime": (
        "thin lime citrus wheel slice, bright green pulp segments, thin rind ring",
        "same lime wheel, rotated ~25°, identical thickness",
    ),
    "bayberry": (
        "single bayberry (Chinese yangmei), bumpy red-purple sphere, tiny stem",
        "two bayberries, same size, slight angle",
    ),
    "cranberry": (
        "single cranberry, small red oval, glossy highlight",
        "two cranberries, same scale, different angle",
    ),
    "boba_pearl": (
        "single dark brown tapioca boba pearl, glossy sphere",
        "two boba pearls touching, same size, slight offset",
    ),
    "cherry": (
        "single cherry with stem, deep red, heart-shaped shine",
        "two cherries with stems, same style, crossed angle",
    ),
    "gooseberry": (
        "single green gooseberry, veined translucent green skin",
        "two gooseberries, same size, different tilt",
    ),
    "grapefruit": (
        "pink grapefruit crescent wedge, pink-red flesh with clear segment lines, white pith, orange-pink peel; SOLID flesh NO holes NO transparent gaps inside",
        "same grapefruit wedge type, rotated ~35°, closed outline, no internal holes",
    ),
    "longan": (
        "peeled longan fruit, translucent pale flesh, dark seed visible",
        "two longan fruits, same peeled style, slight angle",
    ),
    "lychee": (
        "peeled lychee, white jelly flesh, small brown seed",
        "two lychees peeled, same scale, rotated",
    ),
    "cucumber": (
        "small cucumber coin slice, green rind edge, pale green flesh",
        "angled cucumber chunk, same thickness, different rotation",
    ),
    "mulberry": (
        "single dark purple mulberry, elongated cluster shape",
        "two mulberries, same style, slight angle",
    ),
    "taro_ball": (
        "purple taro ball, soft matte lavender sphere",
        "same taro ball, highlight shifted, slight rotation",
    ),
    "sago": (
        "small pile of white sago pearls, translucent dots",
        "same sago pearl mound, different scatter angle",
    ),
    "cherry_tomato": (
        "cherry tomato round slice cross-section, red flesh, seeds visible, green calyx hint",
        "same cherry tomato round slice, rotated ~25°",
    ),
    "red_bean": (
        "small scoop sweet red bean paste, glossy red-brown",
        "same red bean paste dollop, rotated angle",
    ),
    "mini_mochi": (
        "small white mini mochi cube, soft powdery surface",
        "same mochi cube, rotated, subtle shadow only inside",
    ),
    "grass_jelly": (
        "dark brown grass jelly cube, glossy herbal jelly",
        "same grass jelly cube, rotated corner view",
    ),
    "passionfruit": (
        "passionfruit pulp spoon scoop, yellow seeds in orange jelly",
        "same passionfruit pulp, different tilt, no empty shell",
    ),
    "peanut": (
        "peanut half, tan shell, two pale nuts visible",
        "same peanut half, slight rotation, same scale",
    ),
    "red_date": (
        "dried red date (jujube), wrinkled dark red skin",
        "same red date, slight rotation, glossy wrinkle",
    ),
    "plum": (
        "small plum wedge, purple skin edge, yellow-green flesh",
        "same plum wedge, rotated angle",
    ),
    "ice_cube": (
        "single clear ice cube, blue-white internal refraction, cartoon style",
        "same ice cube, rotated 3/4 view",
    ),
    "starfruit": (
        "starfruit star slice, yellow-green, five-point star silhouette",
        "same starfruit slice, rotated ~30°",
    ),
    "pudding_cube": (
        "caramel pudding cube, golden brown, soft glossy top",
        "same pudding cube, rotated isometric angle",
    ),
    "foxnut": (
        "few white foxnut (gorgon) seeds, small oval grains",
        "same foxnut seeds, different pile angle",
    ),
    "young_coconut": (
        "young coconut meat strip, white creamy chunk, thin brown skin edge",
        "same coconut strip, rotated angle",
    ),
    "durian": (
        "durian flesh pod, creamy yellow, spiky green shell edge hint",
        "same durian pod chunk, different tilt",
    ),
    "chocolate_chip": (
        "small chocolate chip morsel, dark brown teardrop",
        "3 chocolate chips cluster, same style",
    ),
    "mint": (
        "fresh mint leaf pair, bright green veins",
        "same mint leaves, crossed angle",
    ),
    "oat_flake": (
        "small oat flakes cluster, beige tan",
        "same oat flakes, different scatter",
    ),
    "lotus_seed": (
        "lotus seed, pale beige teardrop with small brown tip",
        "two lotus seeds, same scale, angle change",
    ),
    "marshmallow": (
        "mini marshmallow cylinder, white fluffy, soft highlight",
        "same marshmallow, rotated side view",
    ),
    "lily_bulb": (
        "lily bulb petal scales, white-yellow, layered",
        "same lily bulb pieces, different fan angle",
    ),
    "persimmon": (
        "persimmon soft wedge, orange flesh, orange skin rim",
        "same persimmon wedge, rotated",
    ),
    "dried_longan": (
        "dried longan, golden-brown wrinkled ball",
        "two dried longan, same style, slight angle",
    ),
    "pop_boba": (
        "translucent pop boba sphere, orange or pink gradient inside",
        "same pop boba, highlight shift, slight rotation",
    ),
    "radish_heart": (
        "small heart-shaped radish cube, pink-white gradient",
        "same radish heart cube, rotated isometric",
    ),
    "basil_seed": (
        "basil seeds (frog egg drink pearls), tiny black dots in gel clump",
        "same basil seed clump, different blob shape",
    ),
    "cookie_crumb": (
        "cookie crumb chunks, golden brown, irregular small pieces",
        "same cookie crumbs, different scatter",
    ),
    "pumpkin_cube": (
        "orange pumpkin cube dice, smooth roasted texture",
        "same pumpkin cube, rotated angle",
    ),
    "taro_dice": (
        "purple taro dice cube, lavender flesh, soft edges",
        "same taro dice, rotated isometric",
    ),
    "black_rice": (
        "small black glutinous rice grains clump, deep purple-black",
        "same black rice clump, different angle",
    ),
    "cantaloupe": (
        "cantaloupe orange cube, pale orange flesh, thin green rind edge",
        "same cantaloupe cube, rotated",
    ),
    "peach_gum": (
        "peach gum resin chunk, amber honey translucent",
        "same peach gum, rotated amber chunk",
    ),
    "blueberry": (
        "single blueberry, deep blue-purple, star calyx, white bloom",
        "two blueberries, same size, slight angle",
    ),
    "crystal_jelly": (
        "clear crystal jelly cube, icy blue highlight",
        "same jelly cube, rotated corner",
    ),
    "sour_plum": (
        "pickled sour plum, wrinkled green-yellow skin",
        "same sour plum, rotated angle",
    ),
    "sweet_potato": (
        "orange sweet potato cube, roasted golden orange",
        "same sweet potato cube, rotated",
    ),
    "water_chestnut": (
        "water chestnut slice, white crisp flesh, brown peel edge",
        "same water chestnut piece, rotated",
    ),
    "almond_slice": (
        "almond slice, pale ivory teardrop",
        "two almond slices, same scale, fan angle",
    ),
    "coconut_jelly": (
        "coconut jelly strip, milky white translucent",
        "same coconut jelly strip, rotated",
    ),
    "snow_fungus": (
        "snow fungus frill petal, white translucent ruffled",
        "same snow fungus piece, different curl angle",
    ),
    "walnut_piece": (
        "walnut kernel piece, brain-fold tan texture",
        "same walnut piece, rotated angle",
    ),
    "honeydew": (
        "honeydew melon cube, pale green flesh, thin rind edge",
        "same honeydew cube, rotated isometric",
    ),
    "lotus_root": (
        "lotus root round slice with holes, pale ivory, pink edge",
        "same lotus root slice, rotated ~25°",
    ),
    "banana": (
        "peeled banana short segment, creamy yellow, brown tips",
        "peeled banana coin slice, same thickness style",
    ),
    "apple": (
        "small apple wedge 1/8, red skin edge, pale yellow flesh",
        "same apple wedge, rotated angle",
    ),
    "grape": (
        "2-3 purple grape berries, glossy purple, short stem",
        "4 purple grapes small cluster, same style",
    ),
    "kiwi": (
        "kiwi round slice, green flesh, black seeds ring, white center",
        "same kiwi slice, rotated ~30°",
    ),
    "watermelon": (
        "small watermelon cube dice, red flesh, black seeds, NO green rind",
        "same watermelon dice, rotated angle",
    ),
}

BATCHES: list[list[str]] = [
    ["nectarine", "chestnut", "kumquat", "blackberry", "blackcurrant", "raspberry"],
    ["osmanthus", "mandarin", "dragonfruit", "grape_green", "lime", "bayberry"],
    ["cranberry", "boba_pearl", "cherry", "gooseberry", "grapefruit", "longan"],
    ["lychee", "cucumber", "mulberry", "taro_ball", "sago", "cherry_tomato"],
    ["red_bean", "mini_mochi", "grass_jelly", "passionfruit", "peanut", "red_date"],
    ["plum", "ice_cube", "starfruit", "pudding_cube", "foxnut", "young_coconut"],
    ["durian", "chocolate_chip", "mint", "oat_flake", "lotus_seed", "marshmallow"],
    ["lily_bulb", "persimmon", "dried_longan", "pop_boba", "radish_heart", "basil_seed"],
    ["cookie_crumb", "pumpkin_cube", "taro_dice", "black_rice", "cantaloupe", "peach_gum"],
    ["blueberry", "crystal_jelly", "sour_plum", "sweet_potato", "water_chestnut", "almond_slice"],
    ["coconut_jelly", "snow_fungus", "walnut_piece", "honeydew", "lotus_root", "banana"],
    ["apple", "grape", "kiwi", "watermelon"],
]

def batch_names(fruits: list[str]) -> list[str]:
    names: list[str] = []
    for fid in fruits:
        names.extend([f"{fid}_1", f"{fid}_2"])
    return names


def batch_prompt(batch_idx: int, fruits: list[str]) -> str:
    lines = [STYLE.strip(), "", f"BATCH {batch_idx:02d} — fill cells left-to-right, top-to-bottom:", ""]
    cell = 1
    for row, fid in enumerate(fruits, 1):
        v1, v2 = CUTS[fid]
        lines.append(f"Row {row} ({fid}):")
        lines.append(f"  Cell {cell}: {v1}")
        cell += 1
        lines.append(f"  Cell {cell}: {v2}")
        cell += 1
    lines.append("")
    lines.append("NO TEXT anywhere. Keep all 12 ingredients consistent line weight and lighting.")
    return "\n".join(lines)


def main() -> None:
    import sys
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    out_dir = root / "docs" / "prompt"
    for i, fruits in enumerate(BATCHES, 1):
        prompt = batch_prompt(i, fruits)
        path = out_dir / f"bowl_upscale_regen_batch{i:02d}_v1.txt"
        path.write_text(prompt, encoding="utf-8")
        names = batch_names(fruits)
        print(f"batch{i:02d}: {len(fruits)} fruits, {len(names)} cells -> {path.name}")
        print("  names:", ",".join(names))


if __name__ == "__main__":
    main()
