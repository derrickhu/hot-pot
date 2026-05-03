# 碗内食材扩展（§2.9：75 `ingredientId`）美术缺口与 Gemini 提示词

策划真源：[`.cursor/plans/20关碗内关卡策划_2d2b77a9.plan.md`](/Users/rosa/.cursor/plans/20关碗内关卡策划_2d2b77a9.plan.md) §2.9。  
资源流程：先本文档 → **Gemini 生图**（见 [gemini-image-gen skill](/Users/rosa/.cursor/skills/gemini-image-gen/SKILL.md)）→ 输出到项目外 **`/Users/rosa/rosa_games/game_assets/hot-pot/assets/`**（子目录自设）→ **抠图 + alpha 裁边** → **你确认后再拷贝** 进包 `subpackages/bowl_game/assets/images/...`（与 [.cursor/rules/game-assets.mdc](../../.cursor/rules/game-assets.mdc) 一致）。

---

## 1. 规格（相对「已有 12 种水果」）

### 1.1 已视为「旧版已生成」的水果（12）

与 [`src/config/fruits.ts`](../../src/config/fruits.ts) 一致：**strawberry, blueberry, orange, lemon, watermelon, grape, kiwi, peach, apple, banana, mango, pineapple**。  
工程内当前约定为 **碗内各 2 张**（`<id>_1.png` / `<id>_2.png`）。若你希望与下文「整果 + 两小块」完全统一，可另开任务为这 12 种 **补一张整果 hero**（不进URGENT）。

### 1.2 新增 **水果类**（策划表中类别为「果」、且不在上列）

每种需 **3 张图**，与 [`docs/水果素材生图提示词.md`](../水果素材生图提示词.md) 一致：

| 后缀语义 | 内容 |
|----------|------|
| `_whole`（或工程最终映射到独立命名） | 完整果或最典型整果形态 |
| `_cut_1` | 水果捞尺度 **小块 / 薄片 / 小丁**（禁止半只大剖面占满格） |
| `_cut_2` | 同系列另一角度的小块，与 `_cut_1` 可区分 |

出图后在外部目录可用：`raw/bowl_expansion/<id>_whole.png` 等；定稿抠图后再决定与 `_1/_2` 的映射。

### 1.3 新增 **非水果**（小料、中式、洋甜、装饰、蔬、坚果等）

每种 **仅 1 张**：碗中一勺 / 一小堆 / 典型形态，尺度与既有碗内食材一致，**不需要**额外切面图。

共 **33** 个 id（见下表「配料单列」）。

### 1.4 冰块 `ice_cube`

**不在 75 图鉴内**；若需要单独图标，按 **1 张** 小冰块透明底即可（可与水果批分开做，避免合图里混淆）。

---

## 2. 数量汇总

| 类型 | 种数 | 每种种图数 | 小计 |
|------|------|------------|------|
| 新增水果 | **30** | **3** | **90** |
| 配料等非水果 | **33** | **1** | **33** |
| **合计（不含冰）** | — | — | **123** |

---

## 3. 新增水果清单（30，需 3 图/种）

按英文字母序，便于文件名统一：

`bayberry`, `blackberry`, `blackcurrant`, `cantaloupe`, `chestnut`, `cherry`, `cherry_tomato`, `cranberry`, `cucumber`, `dragonfruit`, `durian`, `gooseberry`, `grapefruit`, `grape_green`, `honeydew`, `kumquat`, `lime`, `longan`, `lychee`, `mandarin`, `mulberry`, `nectarine`, `passionfruit`, `persimmon`, `plum`, `raspberry`, `red_date`, `sour_plum`, `starfruit`, `young_coconut`

> **易混点（策划已提醒）**：`cherry` vs `cherry_tomato` 轮廓与配色需可区分；`taro_ball` vs `taro_dice` 在配料表里。

---

## 4. 配料等非水果清单（33，需 1 图/种）

`almond_slice`, `basil_seed`, `black_rice`, `boba_pearl`, `chocolate_chip`, `cookie_crumb`, `coconut_jelly`, `crystal_jelly`, `dried_longan`, `foxnut`, `grass_jelly`, `lily_bulb`, `lotus_root`, `lotus_seed`, `marshmallow`, `mini_mochi`, `mint`, `oat_flake`, `osmanthus`, `peach_gum`, `peanut`, `pop_boba`, `pudding_cube`, `pumpkin_cube`, `radish_heart`, `red_bean`, `sago`, `snow_fungus`, `sweet_potato`, `taro_ball`, `taro_dice`, `water_chestnut`, `walnut_piece`

---

## 5. 画风对齐（所有批次的通用尾部）

与现有合图提示 [`fruit_grid_bowl_snack_en.txt`](fruit_grid_bowl_snack_en.txt) 及中文规范 [`水果素材生图提示词.md`](../水果素材生图提示词.md) **同一套**：2D 手机休闲卡通食材、线稿清爽、饱和有食欲、统一顶视偏 3/4、**透明背景**、单格单主体、留白充足、无文字水印餐具场景。

**每笔 Gemini 调用建议**：同一 prompt 内用 **一张合图多格**（雪碧单图），一次生成多格可最大程度锁画风；出图后再按格切图 + 抠图 + `trim_alpha_bbox`。

**负面**（可拼入每批末尾）：`no photorealism, no busy background, no UI, no multiple unrelated subjects in one cell, no huge half-fruit cross-section filling the cell, no text, no watermark`。

---

## 6. 合图批次数与网格建议（英文 prompt 正文）

下列批次可按 **5×3** 或 **4×4** 规划；**未用格子填纯白/留空**（或在 prompt 写 `empty cells solid flat cream color #F5E6D3` 避免花噪）。  
每个 **Row = 一种食材**；**Col1 = whole**，**Col2/3 = two small cuts**（仅水果批）。配料批：**每行一格一个 subject** 或 **单行多列**。

### Batch A — 浆果 / 小型果（示例 5×3）

One image, **5 rows × 3 columns** grid, thin separators, **transparent outside subjects** OR flat cream empty cells. **Mobile game 2D cartoon fruit** for yogurt fruit-bowl, bold outlines, saturated colors, unified lighting.  
Row1 BAYBERRY (yangmei): col1 whole spiky berry. col2 tiny 1–2 berries cluster bite-sized. col3 same tiny cluster different angle.  
Row2 BLACKBERRY: col1 whole aggregate berry. col2 tiny 2–3 drupelets cluster. col3 tiny cluster different angle.  
Row3 BLACKCURRANT: col1 whole black currant sprig or small group. col2 tiny 2–4 berries cluster. col3 tiny cluster different angle.  
Row4 CRANBERRY: col1 whole red cranberry. col2 tiny 2–4 berries small pile. col3 tiny pile different angle.  
Row5 RASPBERRY: col1 whole raspberry. col2 tiny 2–3 drupelets cluster. col3 tiny cluster different angle.

### Batch B — 瓜果 / 瓜果条（示例 5×3）

**切开格：每格仅 1 个主体，禁止碎丁堆、多粒 cubes。** 瓜类用 **一牙楔片**；黄瓜用 **单块圆横切片**；椰青肉用 **单块** 非一堆。详见 [`bowl_expansion_batchB.txt`](bowl_expansion_batchB.txt)。

### Batch C — 柑橘 / 核果（示例 5×3）

Same grid + style tail.  
Row1 KUMQUAT: col1 whole tiny orange kumquat. col2 thin cross slice small. col3 thin slice different angle.  
Row2 MANDARIN (shatangju): col1 whole small mandarin. col2 tiny peeled segment wedge bite-sized. col3 small segment different angle.  
Row3 LIME: col1 whole green lime. col2 thin round slice small. col3 thin slice different angle.  
Row4 GRAPEFRUIT: col1 whole grapefruit. col2 thin pink flesh wedge small NOT huge half. col3 small wedge different angle.  
Row5 NECTARINE: col1 whole smooth nectarine. col2 tiny flesh dice with red skin edge. col3 tiny dice different angle.

### Batch D — 热带 / 特殊果（示例 5×3）

**切开格：每格仅 1 个主体**；火龙果为 **单片楔状白肉+籽**，禁止多粒方块堆。详见 [`bowl_expansion_batchD.txt`](bowl_expansion_batchD.txt)。

### Batch E — 桃李枣柿等（示例 5×3）

**柿子 col2/col3：半颗剖开露瓤**，禁止切丁方块。**所有切开格仅 1 个主体。** 详见 [`bowl_expansion_batchE.txt`](bowl_expansion_batchE.txt)。

### Batch F — 余下水果（示例 5×3）

Same grid + style tail.  
Row1 GOOSEBERRY: col1 whole green gooseberry. col2 tiny 2–3 berries cluster. col3 tiny cluster different angle.  
Row2 GRAPE_GREEN: col1 small bunch green grapes. col2 tiny 2–4 grapes cluster. col3 tiny cluster different angle.  
Row3 MULBERRY: col1 whole mulberry. col2 tiny 2–4 berries cluster dark. col3 tiny cluster different angle.  
Row4 SOUR_PLUM: col1 whole preserved sour plum look. col2 tiny wedge/dice bite-sized. col3 tiny piece different angle.  
Row5 CHESTNUT: col1 whole brown chestnut shell. col2 tiny peeled chestnut kernel chunk. col3 tiny chunk different angle.

---

## 7. 配料合图批（每格 1 图，无 whole/cut 分列）

**每格仅 1 个主体，或最多 2 个黏在一起；禁止一堆、一勺大量、散点很多粒。** 唯真源为 [`bowl_expansion_batchT1.txt`](bowl_expansion_batchT1.txt)（10 格）、[`bowl_expansion_batchT2.txt`](bowl_expansion_batchT2.txt)（9 格）、[`bowl_expansion_batchT3.txt`](bowl_expansion_batchT3.txt)（14 格 + 2 空）。

---

## 8. Gemini 调用与落盘

```bash
# 示例：长提示写入 txt 后
python3 /Users/rosa/.cursor/skills/gemini-image-gen/scripts/generate_images.py \
  --prompt-file /Users/rosa/rosa_games/hot-pot/docs/prompt/bowl_ingredients_75_expansion_batchA.txt \
  --output /Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/bowl_expansion/batchA_grid.png \
  --aspect-ratio 1:1
```

切格脚本可按项目现有 [`scripts/process_fruit_grid_sheet.py`](../../scripts/process_fruit_grid_sheet.py) 模式新建参数，或手工切。

---

## 9. 与工程后续映射（实施阶段备忘）

- 扩展 `IngredientId` 后，水果仍可保留 **2 张碗内图** 映射到 `_cut_1` / `_cut_2`；**`_whole`** 用于图鉴、订单大卡、教程若需要。  
- 配料仅 **1 张** 映射到 **`bowl/<id>_1.png`** 或统一 `bowl/toppings/<id>.png`，由代码约定为准。

---

*文档版本：与 §2.9 表同步；若策划改 id 或拆并种类，请先改策划真源再更新本文件。*
