# 首页底栏：图鉴 / 果切（一张雪碧图 · 两列）

与 `docs/水果素材生图提示词.md`、`docs/prompt/home_summer_background.md` **同一套 2D 手绘卡通风**：清晰线稿、鲜艳饱和、非写实、非 3D、非无描边扁平矢量。

---

## 版式

- **单张横图**，**两列等宽**，从左到右：**图鉴** | **果切**。
- 每列一枚 **圆角竖条按钮**：底板为 **清爽淡蓝**（约 `#d6f0fc`～`#cfe8f8`），**细浅蓝描边**（约 `#b0d4ea`），与夏日底图 **薄荷 / 冰蓝** 气质一致；**不要**深木棕、不要厚重暖褐底。
- **上图标、下中文标签**：字色用 **深蓝灰**（约 `#2a4f63`），保证在淡蓝底上清晰；图标略饱和、手绘卡通。
- 圆角矩形外 **透明背景**（PNG alpha）；两列之间少量间隙。

---

## 左列：图鉴

- 底部文字：**图鉴**（清晰可读）。
- 中央图标：**打开的卡通图鉴 / 食谱书**（可见书页、略厚书脊），风格与水果素材同笔触感；可点缀 **小草莓或柠檬贴纸** 装饰书角，**不要**写实照片书。

---

## 右列：果切（原「烹饪」位，预留玩法）

- 底部文字：**果切**。
- 中央图标：**不锈钢或卡通小刀砍向一块三角西瓜**（红瓤、黑籽、绿皮与首页西瓜一致），动感清晰、可爱不血腥；**不要**血、不要写实恐怖。

---

## 画幅建议

- 总宽 **能被 2 整除**（如 **1024×360** 或 **960×320**），便于 `texture.width / 2` 裁帧。
- 暂存处理路径见 `docs/生图与资源流程规范.md`；定稿拷贝进游戏仓库：`assets/images/home_footer_buttons.png`。

---

## English prompt（一张出两列）

```text
Single horizontal PNG sprite sheet, transparent background outside UI. EXACTLY TWO equal-width columns in one row; each column is ONE complete rounded-rectangle mobile footer button for a WeChat mini-game.

Style: 2D HAND-PAINTED CARTOON matching cute fruit game assets — clear linework, bright saturated appetizing colors, soft simple shading, NOT photorealistic, NOT cinematic 3D, NOT corporate flat vector without outlines.

Shared look both columns: fresh LIGHT BLUE rounded vertical pill button (pastel ice-blue fill ~#d6f0fc, subtle lighter-blue border ~#b0d4ea), summer-cool mood NOT dark wood brown; centered icon above; bottom bold Chinese label in deep blue-gray (~#2a4f63) with very subtle darker stroke if needed for readability; small gap between the two buttons.

Column 1 (left): Chinese text "图鉴". Icon: cute open illustrated guide / recipe book with visible pages and spine; optional tiny fruit sticker accent (strawberry or lemon) on corner — playful, same art family as casual fruit icons.

Column 2 (right): Chinese text "果切". Icon: friendly cartoon kitchen knife cutting into a triangular watermelon slice (red flesh, black seeds, green rind consistent with summer fruit style); energetic cute, NO blood, NO horror.

No extra UI, no phone frame, no English, no watermark, no third button.
```
