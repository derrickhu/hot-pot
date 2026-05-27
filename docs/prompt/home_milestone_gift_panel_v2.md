# 首页大礼包弹窗面板 v2（游戏同款 + 品红底抠图）

参考：`subpackages/bowl_game/assets/images/bowl_common_modal_panel.png`  
风格：奶油浅棕底、深棕描边、角落草莓西瓜柠檬小叶 —— 与「别捞水果」闯关按钮一致，**不要**华丽金属卷轴风。

## 生图硬性要求

- 背景：**仅**纯色亮品红 `#FF00FF`，禁止灰白棋盘格、禁止渐变外景、禁止阴影投射到背景
- 无字：无中文、无英文、无数字
- 中间留白：不画道具、不画金币、不画按钮

## Prompt

Portrait mobile game UI popup panel, aspect ratio 3:4, centered on canvas.

Style MUST match casual fruit merge game "别捞水果": flat 2D cartoon, thick dark brown outline (#5A3218), cream-tan fill (#F5E6C8), soft inner highlight, small cute fruit stickers only in bottom-left and top-right corners (strawberry, watermelon slice, lemon leaf) — same family as a simple wooden fruit stand UI frame. NOT ornate fantasy gold frame, NOT metallic scroll, NOT 3D render, NOT photoreal.

Structure:
1. Top center: small simple title ribbon — rounded cream-yellow banner with brown outline, EMPTY blank center (no text). Ribbon is modest, cute, like mobile game level badge — NOT a huge golden plaque.
2. Main body: large rounded rectangle panel, empty cream-tan interior (70% height), brown border, fruit corner decorations subtle.
3. Bottom: empty cream area hint for external button (do NOT draw any button shape).

Background outside panel: SOLID FLAT MAGENTA #FF00FF only.

NO text, NO letters, NO numbers, NO watermark, NO checkerboard pattern.

## 交付

1. 品红底母版 → `game_assets/.../raw/*_v2_raw.png`
2. `scripts/chroma_key_ff00ff.py --tol 95` + `trim_alpha_bbox.py`
3. 进包：`assets/images/home_milestone_gift_panel_v2.png`（RGBA 透明）
4. 弹窗用 `NineSlicePlane` 拉伸，边距见 `homeMilestoneGiftAssets.ts`
