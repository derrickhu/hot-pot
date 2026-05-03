# 碗内订单区：圆盘 + 横槽（一张雪碧图 · 两列）

与 `BowlScene` 顶栏木色底板、米白订单区一致；**列 0 大圆盘** 与 **列 1 宽横槽** 在画面上要 **和上排订单圆盘视觉体量接近**（横槽为 **加宽、加高** 的圆角药丸，不要细白条）。

---

## 版式

- **单张横图**，**两列等宽**，透明底（PNG alpha）。
- **列 0**：**大圆盘**（正视圆），奶油白 `#fffaf2`～`#fff7eb`，**咖褐描边** `#6a4c34`；可 **略粗、略手绘抖** 的线稿（与可爱水果 UI 一致），内缘可一圈浅粉点纹或浅圈；**无文字**；圆占满格高约 **90%**。
- **列 1**：**宽扁圆角矩形槽**（大圆角药丸），**宽高比约 12:7**（≈100:58，与程序里 `orderSlotStripSlotW/H` 一致）；**浅灰白** `#f8fbfb`，**灰描边** `#dfe4e4`～`#c8d0d4`；**明显加粗**于旧版细条；**无文字**。

---

## 画幅建议

- 总宽 **偶数、两等分**（推荐 **1280×640** 或 **1024×512**），每列内主体 **尽量撑满格**，列间少量透明缝。
- 进包：`subpackages/bowl_game/assets/images/bowl_plates.png`（玩法分包，见 `game.json` / `docs/生图与资源流程规范.md`）  
- 流程：生图 → **remove-background** → `scripts/trim_alpha_bbox.py`（见 `docs/生图与资源流程规范.md`）。

---

## English prompt（重生成用）

```text
Single horizontal PNG sprite sheet, transparent background outside. EXACTLY TWO equal-width columns with a thin transparent gutter between them.

WeChat mini-game casual food UI: 2D HAND-PAINTED CARTOON warm cozy style — clear linework, slightly thick hand-drawn brown strokes (NOT perfect vector), NOT photorealistic, NOT metallic 3D.

Column 1 (left): LARGE top-down circular EMPTY plate — cream / off-white fill (#fffaf2), warm brown outline (#6a4c34), optional subtle inner pink dotted ring or soft inner rim; plate fills ~90% of cell height; NO text.

Column 2 (right): LARGE wide horizontal ROUNDED-RECT slot (super-rounded pill / stadium shape) — light grey-white fill (#f8fbfb), soft grey stroke (#dfe4e4 to #c8d0d4), VERY generous corner radius. Aspect ratio about 12:7 (width noticeably greater than height, like ~100:58), chunky and readable at mobile size — NOT a thin tiny dash. NO text.

No watermark, no extra UI, no third column. Target canvas about 1280 by 640 pixels, two equal cells.
```
