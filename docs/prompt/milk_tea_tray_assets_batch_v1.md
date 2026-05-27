# Milk Tea Tray Gameplay Assets Batch v1

## v2 matte-friendly notes (2026-05-26)

- Object sheets (tray, drinks, tools, order panel): **no drop/cast/ground shadows**, flat even lighting, solid light background for rembg.
- Page background: generate on **16:9 canvas**, **9:16 content centered**, **pure white left/right margins** for later center crop to exact 9:16.

Delivered v2 raw files use suffix `_v2_matte` or `page_bg_16x9_canvas_v2`.

---

Shared art direction for all prompts:

- Cute casual WeChat mini game art, matching the prototype `milk_tea_tray_gameplay_prototype_v1`.
- Warm cream, honey, peach, mint, and fruit tea colors.
- Soft hand-painted 2D UI, rounded edges, clean mobile game readability.
- Keep assets front-facing or slight top-down object view as needed for gameplay.
- NO readable text, NO English, NO Chinese, NO numbers, NO watermark, NO QR code.

## Prompt A: Empty Tray

Create one clean gameplay asset: an empty cream-colored drink tray with exactly six circular cup holes arranged 3 columns by 2 rows.

Visual requirements:
- Soft 2D hand-painted casual mobile game style.
- Slight top-down perspective, matching a grid board item.
- Rounded rectangular tray, warm cream ceramic/plastic material.
- Six visible recessed circular holes, evenly spaced, 3x2.
- Subtle soft shadow under tray.
- Thin warm brown outline, small highlight along the rim.
- Transparent or plain light neutral background is acceptable, but keep the tray isolated and centered.
- No drinks inside, no labels, no text.

Strict constraints:
- Exactly ONE empty tray.
- Exactly six holes, arranged 3 by 2.
- NO text, no numbers, no characters, no hands, no background scene.

## Prompt B: 31 Drink Cups Sheet

Create a single sprite sheet containing 31 different fruit tea / milk tea drink cups plus 5 empty unused cells, arranged in a strict 6 columns by 6 rows grid.

Style:
- Same cute 2D hand-painted game style as the prototype.
- Each drink is a small translucent takeaway cup with lid or cream cap, straw optional, soft outline, tiny fruit/topping details.
- All cups share the same silhouette and scale for gameplay consistency.
- Differentiate drinks by liquid color, toppings, foam/fruit pieces, cup sticker shape, straw/cap color, and inner contents.
- Clean isolated object assets on a plain light background.
- No cast shadows crossing cell boundaries.

Grid layout:
- 6 columns x 6 rows, evenly spaced cells.
- One drink centered in each of the first 31 cells, left to right, top to bottom.
- Last 5 cells should be empty plain background.
- Leave clear gutters between cells so the sheet can be sliced.
- No grid labels, no text, no numbers.

The 31 drinks in order:
1. pineapple ice: golden yellow pineapple soda slush, pineapple bits, mint leaf.
2. grape cheese ice: purple grape drink, creamy cheese foam, grape pieces.
3. peach oolong ice: soft peach pink tea, peach slices, pale tea gradient.
4. passionfruit lemon ice: orange yellow drink, lemon slice, passionfruit seeds.
5. green grape jasmine tea: mint green tea, green grape pieces.
6. grapefruit jasmine tea: coral grapefruit tea, grapefruit wedge.
7. strawberry oolong tea: pink strawberry tea, strawberry chunks.
8. mango green tea: bright mango yellow tea, mango cubes.
9. lychee rose tea: pale rose pink tea, lychee pearl, tiny rose accent.
10. pineapple coconut tea: yellow coconut tea, coconut jelly cubes.
11. orange apple tea: orange amber fruit tea, apple and orange pieces.
12. lemon honey black tea: amber black tea, lemon slice, honey glow.
13. blueberry mulberry tea: deep violet berry tea, small berries.
14. watermelon green grape tea: watermelon red and green gradient, grape pieces.
15. blueberry soda tea: blue purple sparkling tea, bubbles.
16. mango banana smoothie: thick yellow smoothie, banana cream cap.
17. peach lychee lime tea: peach pink tea with lime green accent.
18. kumquat lemon tea: bright citrus yellow tea, kumquat and lemon slices.
19. apple ginger tea: warm golden tea, apple pieces, ginger accent.
20. snow pear lily tea: pale cream pear tea, white lily bits.
21. orange mint tea: orange tea with mint green leaves.
22. guava avocado smoothie: pastel green smoothie, guava pink accent.
23. cucumber pear juice: light green juice, cucumber slice, pear cube.
24. lychee dragonfruit drink: magenta dragonfruit drink, lychee pearl.
25. pickled cherry tomato plum: red tomato plum drink, tiny tomato garnish.
26. pomegranate ice tea: ruby red tea, pomegranate seeds.
27. bayberry lychee drink: deep red bayberry tea, lychee bits.
28. bayberry rena ice: dark berry shaved ice drink, icy cap.
29. cantaloupe oat latte: pale melon green latte, oat foam.
30. guava emblic drink: green guava drink, emblic yellow accent.
31. papaya milk: warm orange milk drink, papaya cubes.

Strict constraints:
- Exactly 6x6 sprite sheet.
- First 31 cells contain one unique cup each, last 5 cells empty.
- NO text, NO labels, NO numbers, NO watermark.

## Prompt C: Three Tool Icons Sheet

Create a single horizontal sprite sheet with 3 square tool icons for a cute casual mobile game.

Layout:
- 3 columns x 1 row.
- Equal square cells, clear gutters between icons.
- Plain light background.

Icon 1: remove one tray.
- Orange rounded square button base.
- Icon shows a small cream six-hole tray with a cup and a minus / removal gesture using simple visual symbol only.

Icon 2: reshuffle trays.
- Orange rounded square button base.
- Icon shows a small tray and two curved arrows circling it.

Icon 3: clear one row.
- Orange rounded square button base.
- Icon shows a small horizontal row of board cells or cups being swept away by a broom / trash sparkle.

Style:
- Match prototype: honey-orange buttons, cream highlights, soft brown outline, cute 2D hand-painted.
- Icons only, no readable text.

Strict constraints:
- Exactly 3 icons in one row.
- NO text, NO Chinese, NO English, NO numbers.

## Prompt D: Pink Order Panel

Create one UI asset: a rounded pink-peach order panel for the top order strip of a mobile puzzle game.

Visual requirements:
- Horizontal rounded rectangle, wide aspect ratio about 5:1.
- Peach-pink / soft coral fill, warm brown outline, subtle inner highlight.
- Slight soft drop shadow.
- Empty panel only, no drink icons inside.
- Leave comfortable inner padding area for placing five drink icons.
- Match cute 2D hand-painted food-game UI style.
- Isolated asset on plain light background or transparent-like background.

Strict constraints:
- No text, no icons, no numbers, no characters.
- Empty order bar only.

## Prompt E: Page Background

Create a vertical 9:16 mobile game background for the milk tea tray puzzle scene.

Composition:
- Top 18 percent: softly blurred fruit tea shop counter background, faint simplified shopkeeper and customer silhouettes, very low detail, no facial focus.
- Top-middle behind order area: peach counter band.
- Middle 55 percent: warm cream tabletop / board area with subtle rounded panel backdrop, no grid cells drawn.
- Bottom 22 percent: warm wooden tabletop strip and darker lower toolbar strip.
- Decorative fruit tea shop details can be placed at edges only: citrus slices, leaves, jars, flowers, but keep center clean.

Style:
- Same warm cute 2D hand-painted style as prototype.
- Bright cream, honey, peach, mint palette.
- Background only, no playable trays, no cups in center, no order cups, no tool buttons.

Strict constraints:
- 9:16 vertical background.
- NO text, NO numbers, NO watermark, NO QR code.
- Keep the central gameplay area clean for UI overlay.
