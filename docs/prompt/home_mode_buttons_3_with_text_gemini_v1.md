# 首页 3 个玩法按钮资源 v1（带文字）

目标：生成一张同风格的首页玩法按钮雪碧图，包含 3 个横向大按钮。按钮文字和图标直接烘焙在图内，用于先评审方向；确认后再拆分、抠透明、裁边。

## 内容归纳

1. 闯关模式
   - 大标题：闯关模式
   - 副标题：捞果配对 解锁新关
   - 图案：一个圆润可爱的水果碗，碗里有西瓜、草莓、柠檬、猕猴桃等水果块，一把木勺正在从碗里捞起水果，表现“别捞水果”的核心玩法。
   - 色彩：青柠绿按钮，主 CTA，最醒目。

2. 每日限定
   - 大标题：每日限定
   - 副标题：今日特饮 限时挑战
   - 图案：一杯好看的冰饮，透明玻璃杯，冰块、柠檬片、草莓、薄荷叶和吸管，表现每天刷新的清爽限定玩法。
   - 色彩：冰蓝按钮，清爽、限定、日更感。

3. 果切挑战
   - 大标题：果切挑战
   - 副标题：连切水果 冲击高分
   - 图案：一把小刀正在切开西瓜/橙子/猕猴桃，带一点果汁飞溅，表现限时切水果和高分挑战。
   - 色彩：橙黄色按钮，动感、挑战感。

## Gemini Prompt

```text
Generate a single clean PNG sprite sheet containing exactly THREE large horizontal home-screen mode buttons for a cute summer fruit WeChat mini game.

Use the provided reference screenshots only for overall game mood: fresh mint water background, juicy fruit decorations, hand-painted cartoon mobile UI, rounded glossy buttons. Do NOT copy the prototype's inaccurate icons or subtitles.

Canvas and layout:
- One image for review, transparent background if supported; if not, use a plain pure white background only.
- Arrange exactly 3 large horizontal rounded pill buttons stacked vertically in one column.
- Each button has the same size and silhouette, about 4.2:1 width-to-height ratio.
- Leave generous blank spacing around and between buttons so they can be split later.
- No phone frame, no full screen background, no extra UI panels.

Shared button style:
- Premium cute 2D hand-painted cartoon casual mobile game UI.
- Rounded pill buttons with soft glossy top highlight, cream inner rim, clean dark teal outer outline.
- Tactile, polished, juicy fruit-game quality; NOT photorealistic, NOT hard 3D plastic, NOT metallic.
- Text must be baked into the image and very readable.
- Chinese text style: thick rounded playful Chinese UI font, white or cream fill, dark teal outer outline, subtle soft shadow, centered vertically.
- Each button has a large illustrated icon on the left, title in the middle-left, smaller subtitle below the title, and a round arrow badge on the right.

Button 1, top, green main mode:
- Green mint-lime gradient button.
- LEFT ICON: a cute fruit bowl with mixed fruit pieces inside; a wooden spoon is scooping fruit from the bowl. The bowl must clearly show "scooping fruit from a bowl", not a calendar, not a knife.
- MAIN TITLE text, EXACTLY four Chinese characters: 闯关模式
- SUBTITLE text, EXACTLY eight Chinese characters with one space in the middle: 捞果配对 解锁新关
- Right side: small circular green arrow badge, no extra text.

Button 2, middle, ice blue daily mode:
- Ice-blue gradient button.
- LEFT ICON: a beautiful iced fruit drink in a transparent glass cup, with ice cubes, lemon slice, strawberry, mint leaf, and straw. It must clearly look like a refreshing limited daily drink.
- MAIN TITLE text, EXACTLY four Chinese characters: 每日限定
- SUBTITLE text, EXACTLY eight Chinese characters with one space in the middle: 今日特饮 限时挑战
- Right side: small circular blue arrow badge, no extra text.

Button 3, bottom, orange challenge mode:
- Warm orange-yellow gradient button.
- LEFT ICON: a small knife cutting fruit, with watermelon slice, orange slice, kiwi slice and tiny juice splash. It must clearly look like fruit slicing action.
- MAIN TITLE text, EXACTLY four Chinese characters: 果切挑战
- SUBTITLE text, EXACTLY eight Chinese characters with one space in the middle: 连切水果 冲击高分
- Right side: small circular orange arrow badge, no extra text.

Strict text constraints:
- Generate ONLY these Chinese strings: 闯关模式, 捞果配对 解锁新关, 每日限定, 今日特饮 限时挑战, 果切挑战, 连切水果 冲击高分.
- The Chinese characters must be complete, correct, clear, not fake glyphs, not malformed, no missing strokes.
- NO English letters, NO random numbers, NO watermark, NO logo, NO QR code, NO captions.
- Do not add any other Chinese words.

Quality constraints:
- Icons must be clear at mobile button size.
- Keep icon, title, subtitle, and arrow aligned consistently across all three buttons.
- Keep edges clean for later background removal and cropping.
```
