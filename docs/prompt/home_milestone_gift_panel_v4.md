# 首页大礼包弹窗面板 v4（超值顶栏 + 大内容区）

## 设计目标

- **顶部**：醒目庆祝标题带，豪华超值感（大红彩带、金匾、金币闪光），程序叠「新手大礼包」。
- **中间**：宽大留白放 3 行道具，禁止四角大水果簇。
- **两侧**：干净边框，不要角落大插画。

## GenerateImage 提示词

Portrait mobile game reward popup panel, 3:4 aspect ratio, centered on canvas.

Bright cheerful Chinese casual fruit puzzle game UI: saturated candy colors, 2D cartoon, thick dark brown outlines (#5A3218), NOT photoreal.

TOP — HERO celebration title ribbon (prominent, ~22% height):
Grand festive party ribbon: vivid coral-red ribbon tails spreading wide, large golden-yellow center plaque with beveled edge and highlight, soft shadow. Gold coins and sparkle stars and tiny confetti ONLY around the ribbon — premium super-value gift pack mood. Center plaque completely EMPTY, no text. Confetti must NOT spill into the body below.

BODY — content-first panel:
Large rounded rectangle, warm cream-yellow (#FFF6D0), peach inner glow, thick brown border. Wide empty cream center (76%+ width, 58%+ height) — blank for reward icons. NO corner fruit clusters, NO watermelon/strawberry/lemon corner art, NO confetti in content zone, NO buttons drawn inside.

Bottom: flat cream footer strip only, no button shape.

Background: SOLID FLAT MAGENTA #FF00FF only. NO checkerboard. NO text anywhere.

## 后处理

`python3 scripts/chroma_key_ff00ff.py` → `assets/images/home_milestone_gift_panel_v4.png`（720×486）

## 进包

- 路径：`assets/images/home_milestone_gift_panel_v4.png`
- 九宫格：`left 72, top 112, right 72, bottom 56`（见 `homeMilestoneGiftAssets.ts`）
