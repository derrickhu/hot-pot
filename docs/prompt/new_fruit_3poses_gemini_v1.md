# 新水果三形态合图提示词（Gemini NB2）

目标：参考现有 `subpackages/bowl_game/assets/images/bowl/` 水果素材风格，为当前游戏还没有的水果生成资源。每种水果 3 张图：1 张完整水果图，2 张切面 / 切片 / 切块图。每 3 种水果生成一张 3x3 合图，每行一种水果，三列保持同一种水果的外形、色彩、光照和描边一致。

通用风格要求（每个 batch 都使用）：

Generate one square 3x3 equal grid image for mobile mini-game fruit assets. Strictly 3 columns and 3 rows, nine equal cells, clear light divider lines, pale warm cream background. One centered fruit subject in each cell, generous padding, no subject crossing cell boundaries.

Art style: 2D hand-drawn cartoon food icon, same style as casual fruit hot-pot / fruit slicing mini-game assets, transparent-background friendly, top-down slightly angled 3/4 view, compact rounded shapes, bold dark brown outline, smaller inner color outline when useful, saturated appetizing colors, soft cel shading, small glossy highlights, no realistic photo texture, no hard 3D render.

Important asset constraints:
- Each row is exactly one fruit species.
- Column 1 is a whole fruit.
- Columns 2 and 3 are cut surfaces, slices, wedges, cubes, or opened pieces chosen to clearly show that fruit's most recognizable features.
- Cut pieces should be bite-sized game ingredients, not huge plated halves unless the fruit needs a half-open form to show seeds.
- Use no plates, bowls, forks, knives, hands, table, leaves as decoration except natural fruit stems/leaves.
- NO TEXT, no labels, no captions, no writing anywhere in the image, no watermark, no logo, no UI.

## Batch A: mangosteen / pear / avocado

Row 1 MANGOSTEEN:
1. Whole mangosteen, round deep purple rind, green calyx cap on top, glossy thick shell, compact icon silhouette.
2. Open mangosteen half, thick purple rind split open, white segmented flesh lobes visible like garlic cloves, creamy center, bite-sized.
3. A few white mangosteen flesh segments removed from rind, soft rounded lobes with tiny hint of purple rind edge, different angle.

Row 2 PEAR:
1. Whole Asian pear or yellow-green pear, plump teardrop shape, tiny brown stem, faint speckles.
2. Pear wedge slice, pale cream flesh, thin yellow-green skin edge, small seed cavity detail, juicy highlight.
3. Small pear cubes or thick chunk pieces, pale flesh with one skin edge, different angle and same scale.

Row 3 AVOCADO:
1. Whole avocado, dark green pebbled oval skin, pear-like oval silhouette.
2. Half avocado with green flesh and large brown pit, creamy yellow-green center, dark green skin rim.
3. Avocado slice or cube chunk without pit, smooth green gradient, skin edge visible, different angle.

## Batch B: pomegranate / yangjiaomi melon / hawthorn

Row 1 POMEGRANATE:
1. Whole pomegranate, round ruby red fruit with small crown calyx, slightly faceted rind.
2. Open pomegranate wedge, ruby seed arils packed inside, pale membrane lines, thick red rind.
3. Small cluster of loose pomegranate arils, jewel-like red beads grouped as one bite-sized subject.

Row 2 YANGJIAOMI MELON:
1. Whole Chinese yangjiaomi melon, long slender horn-shaped pale green melon, tapered curved ends, subtle light stripes.
2. Cross-section round slice, pale green rind ring, white-green juicy flesh, small seed cavity.
3. Small melon wedge or cube chunk, pale green rind edge, white-green flesh, refreshing crisp look.

Row 3 HAWTHORN:
1. Whole hawthorn berry, small round bright red fruit, tiny stem and blossom end, dotted skin.
2. Hawthorn half, red peel, pale yellow flesh, brown seed core visible.
3. Candied-looking hawthorn wedge or small slices, red skin edge and pale flesh, no skewer, no sugar stick.

## Batch C: wax apple / emblic / guava

Row 1 WAX APPLE:
1. Whole wax apple, bell-shaped glossy pink-red fruit, wider bottom, small green stem top, crisp watery look.
2. Wax apple wedge, thin pink-red skin, white translucent watery flesh, hollow seed cavity hint.
3. Small wax apple chunks, white translucent flesh with red skin edges, different angle.

Row 2 EMBLIC:
1. Whole emblic / Indian gooseberry, small round yellow-green fruit with vertical rib grooves and glossy skin.
2. Cut emblic half, pale green-yellow flesh, radial star-like seed core visible.
3. Emblic wedge segments, ribbed yellow-green skin edge, tart juicy flesh, different angle.

Row 3 GUAVA:
1. Whole guava, light green oval fruit, slightly bumpy skin, small brown stem.
2. Guava half, green rind, pink flesh center with many tiny cream seeds.
3. Guava wedge slice, pink seeded flesh and green rind edge, different angle.

## Batch D: papaya / fig / apricot

Row 1 PAPAYA:
1. Whole papaya, elongated orange-yellow fruit with green-yellow mottled skin, smooth rounded ends.
2. Papaya half, orange flesh, central cavity filled with many black seeds, green-yellow rind edge.
3. Papaya cube or wedge, bright orange flesh with thin rind edge, juicy highlight.

Row 2 FIG:
1. Whole fig, pear-shaped purple-green fruit, small stem, subtle skin stripes.
2. Cut fig half, deep red jammy interior with many tiny seeds, pale rind ring.
3. Fig wedge, red seeded interior and purple-green skin edge, different angle.

Row 3 APRICOT:
1. Whole apricot, small round orange fruit, soft blush, central crease line, tiny stem.
2. Apricot half, golden orange flesh, one brown pit visible, soft fuzzy skin edge.
3. Apricot wedge or chunky slice, orange flesh with skin edge, different angle.
