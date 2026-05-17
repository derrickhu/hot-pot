# 每日限定玩法上方面板底框材质版 5 风格 v4

基于 `subpackages/bowl_game/assets/images/daily_limited/board_frame_thin_green_v2.png` 重新生成 5 张不同材质底框。当前游戏底框尺寸为 1054×685，生成图保持同样的横向空面板构图和留边逻辑，后续再按需缩放/替换。

统一硬性要求：

- 只生成一个空的游戏 UI 底框，不要完整背景。
- 外轮廓必须是平整的横向矩形，不能有任何向外突出的装饰物、角标、挂件、叶子、水果、绳结、夹子。
- 边框厚度保持和参考图接近，不能变成厚重相框。
- 四角只能轻微圆角，接近直角，不能大圆角。
- 内部必须是空白平面，不要卡槽、凹槽、格子、卡片、文字、图标。
- 可以有材质、阴影、高光和轻微立体感，但立体感必须沿着矩形边框内部表达，不能破坏外轮廓。
- 透明背景或纯净可抠背景，便于后处理。

## frame_ice_glass_material_v4

```text
Create ONE isolated empty mobile game board frame UI asset, using the reference image for exact layout and proportions. Same wide rectangular panel, same thin border, same almost-square corners, same large empty interior.

Material theme: translucent ice glass. The border is a flat rectangular rim made of pale cyan glass and frosted ice, with subtle inner bevel, white edge highlights, tiny internal frost texture, and soft blue shadow. The outer silhouette must remain perfectly flat and rectangular.

Interior: empty pale icy mint surface, smooth and clean, no slots.

STRICT: no protruding decorations outside the frame, no corner ornaments, no leaves, no fruits, no snowflakes sticking out, no text, no cards, no grid, no grooves, no holes, no logo, no watermark, no full scene background.
```

## frame_bamboo_material_v4

```text
Create ONE isolated empty mobile game board frame UI asset, using the reference image for exact layout and proportions. Same wide rectangular panel, thin border, near-square corners, large empty center.

Material theme: polished bamboo board. The thin rim looks like laminated bamboo strips pressed into a flat rectangular UI frame, warm bamboo beige with green shadow lines, subtle knots only as flat texture inside the rim, soft bevel and hand-painted highlights. Outer edge must be a simple straight rectangle.

Interior: empty pale green cream surface, flat and quiet.

STRICT: no bamboo poles protruding, no rope knots outside, no leaves outside, no fruit decorations, no text, no cards, no slots, no grooves, no grid, no logo, no watermark, no background scene.
```

## frame_stone_material_v4

```text
Create ONE isolated empty mobile game board frame UI asset, based on the reference image proportions and thin border layout. Same large empty interior and almost-square corners.

Material theme: smooth garden stone / light slate. Thin flat stone rim with soft carved bevel, pale sage gray-green color, tiny stone grain texture inside the border, gentle ambient shadow for dimensionality. The shape remains a clean flat rectangular frame, not bulky.

Interior: empty very pale warm stone cream surface, low contrast and clean.

STRICT: no protruding rocks, no chips outside the silhouette, no flowers, no leaves, no fruits, no text, no cards, no grooves, no grid, no icons, no logo, no watermark, no scene background.
```

## frame_wood_material_v4

```text
Create ONE isolated empty mobile game board frame UI asset, matching the reference image proportions. Thin border, straight sides, tiny corner radius, large empty center.

Material theme: light polished wood. Slim wooden rim with soft bevel, warm honey-brown and cream highlights, subtle wood grain following the rectangular border, slightly raised but still thin and elegant. Outer silhouette must be a simple flat rectangle.

Interior: empty pale parchment cream surface with faint warm tint, no details.

STRICT: no clip, no nails protruding, no leaves, no fruit, no flowers, no outside decorations, no text, no card slots, no grooves, no grid, no logo, no watermark, no full background.
```

## frame_ceramic_material_v4

```text
Create ONE isolated empty mobile game board frame UI asset, using the reference image for the same size feeling and layout. Thin border, near-square corners, large empty interior.

Material theme: glossy ceramic / jade tile. Thin flat ceramic rim in mint, cream, and soft turquoise glaze, subtle raised edge, gentle reflected highlights, tiny glaze texture inside the border only. Clean modern casual mobile game UI.

Interior: empty pale mint-white ceramic surface, smooth and uncluttered.

STRICT: no protruding decorations outside the frame, no corner badges, no leaves, no fruits, no text, no cards, no slots, no grooves, no grid, no logo, no watermark, no scene background.
```

## frame_ceramic_material_v4b

```text
Create ONE isolated empty WIDE HORIZONTAL mobile game board frame UI asset. Use the reference image as the exact target: a landscape rectangle panel, about 1054x685 proportion, fills most of the canvas width, thin border, large empty center, near-square corners.

Material theme: glossy ceramic / jade tile. The frame is a WIDE LANDSCAPE RECTANGLE, not a square. Thin flat ceramic rim in mint, cream, and soft turquoise glaze, subtle raised edge, gentle reflected highlights, tiny glaze texture inside the border only. Clean modern casual mobile game UI.

Canvas composition: the rectangular frame should nearly touch the left and right sides like the reference, with only small even margins. Keep the top and bottom margins modest. Do not center a square panel.

Interior: empty pale mint-white ceramic surface, smooth and uncluttered.

STRICT: WIDE HORIZONTAL RECTANGLE ONLY. No square frame. No protruding decorations outside the frame, no corner badges, no leaves, no fruits, no text, no cards, no slots, no grooves, no grid, no logo, no watermark, no scene background.
```
