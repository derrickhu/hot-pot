# 每日限定玩法空底框 3 风格 v1

## 用途

每日限定玩法中上方堆叠卡牌区、下方平铺容错区使用的绿色底框 / 面板资源。先生成 3 个风格方向供挑选：绿色葡萄、竹子、冰板。

## Gemini 提示词

```text
Create a 3-column by 1-row sprite sheet of empty rounded game board frames for a cute 2D casual mobile fruit puzzle game.

Important: each cell contains exactly ONE isolated empty board frame asset. The board frame is a large rounded horizontal rectangle, similar proportions to a mobile puzzle card area panel. It must be an empty simple panel with a clean flat interior.

Overall style:
- Polished 2D hand-painted mobile game UI asset.
- Cute summer fruit dessert puzzle game style.
- Soft cel shading, clean outlines, subtle bevels, gentle highlights, light drop shadow.
- Asset should work on a refreshing summer background and pair with cream fruit cards.
- Plain white or very pale background only, easy to remove.

Sheet layout:
- 3 columns, 1 row.
- Equal cell sizes.
- Generous spacing between cells.
- Each board centered in its cell.

Panel shape rules for all three:
- Rounded rectangle board frame, wide horizontal.
- Thick outer frame and thinner inner rim.
- Interior must be one smooth simple flat area, pale cream / pale mint / icy pale blue depending on style.
- NO card slots, NO grooves, NO grid lines, NO inset holes, NO cards, NO fruit icons inside the board.
- The inside must be empty and clean, because cards will be placed by code later.

Cell 1: green grape version
- Fresh green fruit-garden board.
- Outer frame: juicy grape-leaf green with darker green outline.
- Small subtle grape-vine decorations only on the outer corners, tiny grape clusters / leaves, not inside the panel.
- Interior: very pale mint cream, flat and clean.

Cell 2: bamboo version
- Bamboo summer hut board.
- Outer frame: light bamboo segments and warm green bindings, rounded cute bamboo construction.
- Small bamboo knots and leaf accents on the outer rim only.
- Interior: pale warm cream with a slight mint tint, flat and clean.

Cell 3: ice board version
- Cool dessert ice board.
- Outer frame: translucent pale cyan ice/glass rim with white highlights and soft blue shadow.
- Small frost sparkle and shaved-ice accents on the rim only.
- Interior: very pale icy blue, flat and clean, low contrast.

Strict constraints:
- NO TEXT, no labels, no captions, no writing anywhere in the image.
- NO cards, no card slots, no grooves, no grid, no fruit icons inside the panel.
- NO logo, no watermark, no characters, no full scene background, no buttons.
- Do not crop the boards; keep full rounded frames visible.
```

## 产物路径

- 原始合图：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/daily_limited_board_frames_3styles_v1.png`
- 拆分图：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/split/daily_limited_board_frame_{grape,bamboo,ice}_v1.png`
- 抠图后：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/nobg/daily_limited_board_frame_{grape,bamboo,ice}_v1.png`
- 裁边定稿：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/final/daily_limited_board_frame_{grape,bamboo,ice}_v1.png`
