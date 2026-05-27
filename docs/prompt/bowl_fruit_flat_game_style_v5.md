# Bowl 水果扁平卡通风 v5（对齐 mango_2 / grapefruit_1）

## 问题

v4 合图偏 **写实 / 高光过细 / 颗粒逐粒 shading**，与已进包 `mango_2`、`grapefruit_1` 的 **厚描边 + 大色块 + 一条粗高光** 不一致。

## 风格锚点（GenerateImage 参考图顺序）

1. `mango_2.png` — 立体感画法（粗高光、平滑渐变、无肌理）
2. `grapefruit_1.png` — 更扁平的 2D 切块示范
3. 各食材 `refs_orig/{id}_1.png`、`_2.png` — **只学切法/形态**，不学旧图写实度

## 强制画风（写入每条 prompt）

```
FLAT 2D mobile fruit-bowl cartoon — match mango_2 and grapefruit_1 references EXACTLY.

ALLOWED:
- Thick outline darker than local color (NOT generic black)
- 3–4 smooth color zones per piece + ONE bold thick highlight shape on upper-left
- Simple segment lines / seeds / rind marks as flat strokes (few, large)
- Slight 3/4 top-down, saturated juicy colors

FORBIDDEN (critical):
- Photorealistic, painterly, 3D render, glossy wet specular dots
- Per-bump or per-drupelet individual shading (bayberry bumps = flat dot pattern only)
- Hundreds of micro-highlights, concentric texture lines on berries
- Drop shadow, contact shadow, plate, bowl, tray

Background: pure #FFFFFF white only. One ingredient per cell, large (~70% cell).
```

## 本批重生（桑葚/杨梅/蓝莓/猕猴桃）

| 合图 | 布局 | 产出 |
|------|------|------|
| mulberry + bayberry | 2×2 | mulberry_1/2, bayberry_1/2 |
| blueberry | 1×2 | blueberry_1/2 |
| kiwi | 1×1 | kiwi_1（_2 同图复制） |

特殊：

- **桑葚/蓝莓**：每格 **一颗**（不要三颗串、不要成串）
- **杨梅**：整颗 + 切半两格；表面凸起用 **统一小圆点图案**，不要每粒 3D 高光

## 后处理

```bash
mkdir -p /Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2/raw_v5
# GenerateImage → raw_v5/*.png
python3 scripts/bowl_upscale_regen_v2.py process-duo --a mulberry --b bayberry \
  --raw .../duo_mulberry__bayberry_flat_v5.png --out .../final_v5
python3 scripts/bowl_upscale_regen_v2.py process-solo-pair --id blueberry \
  --raw .../duo_blueberry_flat_v5.png --out .../final_v5
python3 scripts/bowl_upscale_regen_v2.py process-solo-single --id kiwi \
  --raw .../kiwi_1_flat_v5.png --out .../final_v5
```

**用户确认前**不要覆盖 `subpackages/bowl_core/assets/images/bowl/`。
