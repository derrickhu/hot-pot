# 每日限定玩法三道具说明面板 v1

## 用途

每日限定玩法三种道具的说明弹层，参考原关卡玩法的剪贴板/便签纸弹窗风格。三列雪碧图，从左到右：洗牌 / 撤销 / 上移。

## Gemini 提示词

```text
Single horizontal PNG sprite sheet, transparent or plain pale background outside panels. EXACTLY THREE equal-width columns in one row; each column is ONE complete vertical clipboard-style modal panel for a cute 2D fruit puzzle mobile game.

Style:
- Match the existing fruit hot-pot tool help panels: warm brown hand-painted outline, cream parchment main panel, top wooden/metal clip, orange brushstroke title banner, light peach inner illustration box, cozy food-game UI.
- Polished 2D hand-painted cartoon style, clear outlines, soft highlights, cute casual WeChat mini-game look.
- NOT photorealistic, NOT 3D render.

Shared panel structure:
- Top title banner with bold white Chinese title.
- Middle illustration box with simple explanation art.
- Below illustration, one short brown Chinese description line.
- Top-right small close X is allowed.
- Leave lower area clean; do not draw bottom reward button, no video button. Game code will add action button separately if needed.

Column 1 left:
- Title text: 洗牌
- Illustration: many fruit cards being mixed, with green circular arrows around a small stack of cream cards.
- Description text: 打乱未使用的卡片

Column 2 middle:
- Title text: 撤销
- Illustration: one fruit card flying backward from a slot to its original card position, with a green undo arrow.
- Description text: 撤回最近一步操作

Column 3 right:
- Title text: 上移
- Illustration: bottom temporary slot cards moving upward into the flat card area, with a green upward arrow.
- Description text: 把底部卡片移回上方

Strict constraints:
- Generate exactly three panels, no fourth panel.
- Chinese text must be exactly the requested title and description lines.
- NO English text, no watermark, no logo, no phone frame.
- No bottom yellow reward button, no camera icon, no QR code.
- Keep each panel fully visible and centered in its column.
```

## 产物路径

- 原始母版：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/daily_limited_tool_panels_sheet_v1.png`
- 抠图后：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/nobg/daily_limited_tool_panels_sheet_v1.png`
- 裁边定稿：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/final/daily_limited_tool_panels_sheet_v1.png`
