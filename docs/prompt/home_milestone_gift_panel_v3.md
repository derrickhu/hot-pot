# 首页大礼包弹窗面板 v3（鲜艳 + 庆祝彩带）

## Prompt

Portrait mobile game reward popup panel, 3:4, centered.

Style: bright cheerful Chinese casual fruit puzzle game UI — saturated candy colors, juicy 2D cartoon, thick dark brown outlines (#5A3218), NOT dull beige, NOT gray, NOT photoreal.

**Celebration title ribbon (top center, MUST be prominent):**
- Festive party ribbon banner across top: vivid coral-red ribbon tails spreading left and right, golden-yellow center plaque with beveled edge and soft highlight.
- Small sparkle stars and tiny confetti dots around ribbon (gold, pink, lemon yellow).
- Center plaque completely EMPTY — no text, no letters, no Chinese characters.
- Ribbon should feel like "celebration / grand prize / festival" — exciting and eye-catching.

**Main panel body:**
- Large rounded rectangle below ribbon, bright warm cream-yellow fill (#FFF6D0) with orange-peach inner glow (#FFD4A8), thick brown border, glossy top highlight.
- Bottom-left and top-right: cute colorful fruit clusters (strawberry, watermelon, lemon) with white sticker outline — vivid saturated fruit colors.
- Large empty center (65% height): completely blank for reward icons — NO items, NO coins, NO buttons drawn inside.

**Overall mood:** rich rewards, colorful, festive, expensive-but-cute mobile game popup — match vibrant home screen fruit game, NOT muted tan modal.

Background outside panel: SOLID FLAT MAGENTA #FF00FF only. NO checkerboard. NO text anywhere.

## 后处理

`chroma_key_ff00ff.py --tol 95` → `assets/images/home_milestone_gift_panel_v3.png`
