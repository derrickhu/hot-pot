# 新水果第三形态重生成提示词（红框替换）

Reference image说明：参考图是 7 行 × 2 列，每一行是一种水果；左列是完整水果，右列是已经认可的切面 / 切片。请根据参考图的画风、描边、色彩、光照和水果身份，生成第三形态替换图。

Generate one square 3x3 equal grid image for replacement fruit asset cells. Strictly 3 columns and 3 rows, nine equal cells, clear light divider lines, pale warm cream background. Use the same 2D hand-drawn cartoon mini-game food icon style as the reference image: bold dark brown outline, compact rounded shapes, saturated appetizing colors, soft cel shading, top-down slightly angled 3/4 view, transparent-background friendly.

Output only one centered fruit subject per cell, generous padding. NO TEXT, no labels, no captions, no watermark, no logo, no UI, no plates, no bowls, no utensils, no hands, no background scene.

Fill cells left-to-right, top-to-bottom. Cells 8 and 9 may be empty cream background or very simple unused placeholder fruit silhouettes, but the first seven cells must be complete usable assets:

1. PEAR replacement cut_b: a pear wedge slice very similar to the reference pear cut slice, not cubes. Pale cream pear flesh, thin yellow-green skin edge, small seed cavity detail, same pear color and outline, a slightly different angle from the reference slice.

2. AVOCADO replacement cut_b: an avocado half or thick slice that clearly matches the reference avocado half, not cubes. Green flesh gradient, dark green skin rim, optional smaller pit cavity or no pit, same rounded avocado silhouette, slightly different angle.

3. POMEGRANATE replacement cut_b: a smaller opened pomegranate wedge or half section, not loose arils. Thick red rind, cream membrane, clustered ruby seeds inside, same style as the reference opened pomegranate, slightly different angle.

4. YANGJIAOMI MELON replacement cut_b: a round cross-section slice similar to the reference melon slice, not a plain cube/wedge. Pale green rind ring, white-green juicy flesh, small central seed marks, slightly different angle or thickness.

5. WAX APPLE replacement cut_b: a wax apple wedge similar to the reference wax apple slice, not cubes. Pink-red skin edge, white translucent watery flesh, same bell-fruit color, slightly different angle.

6. EMBLIC replacement cut_b: an emblic / Indian gooseberry cross-section or half similar to the reference emblic cut face, not lemon-like wedges. Yellow-green round fruit, ribbed skin edge, radial star seed core detail, slightly different angle.

7. PAPAYA replacement cut_b: a papaya half or wedge similar to the reference papaya cut half, not a cube. Orange flesh, green-yellow rind edge, black seed cavity visible or partial, slightly different angle.

Strong consistency constraints:
- The replacement should feel like the third pose of the same fruit row, not a different cutting style.
- No diced cubes for pear, avocado, wax apple, or papaya.
- No loose seeds/arils for pomegranate.
- No lemon/lime wedge look for emblic.
- No oversized whole fruit, no decorative leaves.
