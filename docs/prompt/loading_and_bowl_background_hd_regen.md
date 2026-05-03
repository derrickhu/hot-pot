# 高清 Loading 与关卡底图重生成

## 目标

- 解决真机上 `384x688` 资源放大导致的模糊。
- Loading 图保持面朝大海、躺椅背向观众、中心满桌冰镇水果饮品和刨冰。
- 关卡底图只提供干净环境氛围，**不画标题凹槽 / 木牌 / 按钮底座 / GM / 订单盘 / 槽位 / 文字**，这些全部由游戏程序叠加。

## Loading v3 高清提示词

```text
High-resolution vertical mobile game loading screen background, 9:16 portrait composition, 2D hand-painted cartoon style, cute cozy mobile game art, same art family as a casual tropical fruit game. Crisp clean outlines, soft cel shading, bright refreshing colors. NOT photorealistic, NOT 3D render.

Core feeling: facing the sea on a cool summer vacation, relaxing on a seaside resort deck, refreshing ocean breeze, comfortable and delicious.

Camera and composition: viewer is behind or slightly above the lounge chair, looking toward the ocean. The lounge chair must face the sea, angled away from the viewer, with the backrest pointing toward the ocean horizon. The sea view is clearly in front of the chair. Do not show the chair facing the viewer.

Main focal point: a large round bamboo / light wood side table placed near the center of the image, slightly lower than center, prominent and inviting. The table is full of chilled summer treats and must feel abundant, colorful, and appetizing.

On the table: a generous spread of cute hand-painted iced fruits and drinks: sliced watermelon, orange slices, lemon/lime slices, kiwi, strawberries, grapes, lychee, mango cubes, blueberries, mint leaves, many shiny ice cubes, condensation droplets. Include beautiful cold drinks: iced fruit tea with citrus slices, pink berry smoothie, coconut drink with straw, sparkling mint lemonade. Include one cute bowl or glass of shaved ice / kakigori dessert, topped with fruit pieces and syrup, visually refreshing. Full table, rich but organized.

Foreground / midground: one cozy beach lounge chair with mint / cream cushion, bamboo or light wood frame, facing the sea. Add a folded towel on the chair. The chair supports the vacation mood but should not cover the center table.

Far background: calm turquoise ocean facing the viewer, gentle waves, pale blue sky, fluffy white clouds, distant island silhouettes, bright soft sunlight. Add a bamboo terrace railing and beach deck details consistent with a tropical bamboo hut UI theme.

Palette: cool turquoise, mint green, soft cream, light bamboo brown, juicy fruit colors. Bright, airy, clean outlines, soft cel shading, cute game illustration. Add small sparkle highlights on ice and drinks to convey coolness.

Composition requirement: leave a subtle clean area near the lower third or bottom center for future loading UI overlay, but keep the table visually central and rich. Keep important details away from edges.

Do NOT draw any phone frame, black notch, status bar, home indicator, UI overlay, title, logo, text, labels, captions, watermark, buttons, people, realistic photo texture, or heavy shadows.
```

## 关卡底图 v2 高清无凹槽提示词

```text
High-resolution vertical mobile game gameplay background, 9:16 portrait composition, 2D hand-painted cartoon style, cute cozy tropical fruit stand / bamboo hut environment, same art family as a casual fruit game. Crisp clean outlines, soft cel shading, warm but refreshing summer palette. NOT photorealistic, NOT 3D render.

Purpose: this is ONLY the environmental background behind game UI. The actual title plaque, settings button, GM button, order plates, buffer slots, progress bar, fruit bowl, and tool buttons will be drawn by the game engine later.

Critical restrictions: NO title groove, NO recessed title slot, NO empty wooden plaque, NO carved title board, NO button base, NO settings button, NO GM button, NO order dishes, NO plate slots, NO progress bar, NO text, NO labels, NO UI icons, NO blank speech bubbles, NO gameplay objects.

Scene: a clean tropical bamboo fruit stand interior facing the player. Top area has a light bamboo canopy / woven bamboo wall texture and soft tropical leaves at the corners, but it must stay clean and open for the game title overlay. No grooves or plaques. The upper center should be a simple continuous bamboo wall / canopy surface, not a framed slot.

Middle area: warm light wood counter and bamboo booth structure, gentle horizontal layers, soft shadows, subtle woven texture, empty enough for game order UI overlays. Keep the composition balanced and not busy.

Lower area: pale cream / mint summer background with gentle wave-like lines and subtle sparkles, fresh fruit decoration at the side edges only, leaving the central bowl area clean for the game bowl overlay.

Art direction: tropical vacation, cool fruit dessert stand, bamboo, mint, cream, honey wood, soft green leaves, small citrus / strawberry side decorations only around edges. Cute cartoon game illustration, no realistic textures, no hard shadows.

Composition requirement: full-screen background designed for mobile cover scaling; important decorative elements should stay away from extreme left/right/top/bottom edges. Keep the center and UI overlay regions clean.

NO TEXT, no labels, no captions, no logo, no watermark, no UI panels, no title groove, no title plaque, no buttons, no plate slots, no people.
```

## 产物路径

- Loading 高清原始：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/loading/loading_page_cool_vacation_table_focus_v3_hd_raw.png`
- 关卡底图高清原始：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/themes/bowl_theme_tropical_fruit_stand_clean_v2_hd_raw.png`

## 关卡底图 v3 高清无凹槽（保持原图上下比例）

调整目标：v2 的台面和竹屋结构太低，挤占了碗的区域。v3 必须复刻原关卡底图的空间比例：上方竹屋/台面只占画面上约 32%~36%，下方 64%~68% 是干净浅色留白，给程序叠加大碗。

```text
High-resolution vertical mobile game gameplay background, 9:16 portrait composition, 2D hand-painted cartoon style, cute cozy tropical fruit stand / bamboo hut environment, same art family as a casual fruit game. Crisp clean outlines, soft cel shading, warm refreshing summer palette. NOT photorealistic, NOT 3D render.

Purpose: this is ONLY the environmental background behind game UI. The actual title plaque, settings button, GM button, order plates, buffer slots, progress bar, fruit bowl, and tool buttons will be drawn by the game engine later.

Most important composition rule: match the original gameplay background proportions. The bamboo hut / fruit stand / wooden counter must stay in the TOP 32% to 36% of the image only. The counter front edge should be around one third down from the top. Below the counter, leave a very large clean pale cream area occupying about 64% to 68% of the image height for a large game bowl overlay. Do NOT let bamboo tables, counters, shelves, pillars, leaves, or decorations extend into the central lower bowl area.

Critical restrictions: NO title groove, NO recessed title slot, NO empty wooden plaque, NO carved title board, NO button base, NO settings button, NO GM button, NO order dishes, NO plate slots, NO progress bar, NO text, NO labels, NO UI icons, NO blank speech bubbles, NO gameplay objects.

Top area: a simple tropical bamboo stand facing the player, with bamboo roof / woven bamboo wall texture, vertical bamboo posts at far left and far right, soft palm leaves in the top corners. The upper center must be a continuous woven bamboo wall surface only — no framed slot, no title holder, no groove.

Counter area: one horizontal warm light wooden counter near the upper third, similar thickness and placement to the original game background. Keep the counter shallow and high; do not draw a large table occupying the middle.

Lower area: broad empty pale cream / light mint summer background with very subtle soft sparkles and faint wave-like lines. Small fruit decorations only near side edges and corners, similar to the original layout. The center must remain open and uncluttered for the big bowl.

Art direction: tropical vacation fruit stand, bamboo, mint, cream, honey wood, soft green leaves, small citrus / strawberry side decorations. Cute cartoon game illustration, no realistic textures, no hard shadows.

Composition requirement: full-screen mobile background designed for cover scaling; keep important decoration away from extreme edges; keep the center lower 60% empty and bright.

NO TEXT, no labels, no captions, no logo, no watermark, no UI panels, no title groove, no title plaque, no buttons, no plate slots, no people.
```

- 关卡底图 v3 高清原始：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/themes/bowl_theme_tropical_fruit_stand_clean_v3_original_ratio_hd_raw.png`

## 关卡底图 v4 参考原图微调（只去掉凹槽）

调整目标：不要重画构图。以当前游戏内 `bowl_theme_tropical_fruit_stand.png` 为参考，只删除顶部标题凹槽 / 木牌底座，让上方变成连续竹编墙面；其它比例、台面高度、下方留白、边角水果装饰尽量保持原版。

参考图：`hot-pot/subpackages/bowl_game/assets/images/themes/bowl_theme_tropical_fruit_stand.png`

```text
Use the reference image as the main layout and style guide. Create a clean edited version of the same mobile game background, 9:16 portrait, 2D hand-painted cute cartoon style.

Do NOT redesign the scene. Preserve the original composition almost exactly: same bamboo hut proportions, same counter height, same large pale empty lower area for the game bowl, same side fruit decorations, same warm tropical fruit stand mood.

Only change needed: remove the recessed title groove / empty wooden plaque / slot in the top bamboo wall area. Replace it with continuous woven bamboo wall texture and subtle bamboo shading that matches the surrounding wall. No groove, no title holder, no button base.

Keep the top bamboo roof, palm leaves, side bamboo posts, counter, lower cream background, sparkles, and fruit decorations very close to the reference image.

This is background only; game UI will be drawn later. NO TEXT, no labels, no captions, no logo, no title plaque, no title groove, no buttons, no GM, no order plates, no progress bar, no bowl, no people, no watermark.
```

- v4 参考原图生成：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/themes/bowl_theme_tropical_fruit_stand_ref_remove_groove_v4_raw.png`

