# 每日限定玩法三道具按钮 v1

## 用途

每日限定玩法底部三枚道具按钮：洗牌 / 撤销 / 上移。风格参考原关卡玩法道具按钮，但文案与图标改为每日限定玩法。

## Gemini 提示词

```text
Single horizontal PNG sprite sheet for a cute 2D mobile fruit puzzle game. EXACTLY THREE equal-width columns in one row; each column contains ONE complete circular tool button. Transparent or plain pale background outside the buttons, easy to remove.

Style:
- Match the existing fruit hot-pot level tool buttons: warm golden-brown circular base, thick cream/gold rim, soft hand-painted highlights, clear dark brown outline, slight drop shadow.
- Cute 2D hand-painted cartoon UI, polished WeChat mini-game asset, saturated but cozy colors.
- NOT photorealistic, NOT 3D render, NOT flat corporate vector.

Shared structure for all three buttons:
- Same circle size and same visual style.
- Central icon in bright green with dark outline, slightly above center.
- Bottom Chinese label in bold white characters with dark brown outline.
- Small count badge area is NOT needed; game code will draw count separately.
- No extra phone UI or background scene.

Column 1 left:
- Label text: 洗牌
- Icon: green circular shuffle / refresh arrows, clear and readable.

Column 2 middle:
- Label text: 撤销
- Icon: green undo arrow bending back to the left, clear and readable.

Column 3 right:
- Label text: 上移
- Icon: green upward arrow, clear and readable.

Strict constraints:
- Generate exactly three buttons, no fourth button.
- Chinese text must be exactly: 洗牌, 撤销, 上移.
- NO English text, no watermark, no logo, no phone frame.
- Do not crop any circle; each button fully visible with small spacing between columns.
```

## 产物路径

- 原始母版：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/daily_limited_tool_buttons_sheet_v1.png`
- 抠图后：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/nobg/daily_limited_tool_buttons_sheet_v1.png`
- 裁边定稿：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/final/daily_limited_tool_buttons_sheet_v1.png`
