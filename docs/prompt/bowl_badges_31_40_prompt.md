# 碗内玩法 31-40 关徽章图标批量生图提示词

目标：为主线水果捞 31-40 关设计一组统一风格的续章徽章。每个徽章都是清凉感的水果茶、奶昔、刨冰、水果捞或甜品饮品，一杯或一碗为主体，突出新水果：山竹、梨、牛油果、石榴、羊角蜜、山楂、莲雾、油柑、番石榴、木瓜、无花果、杏。图标用于游戏进度条终点和通关后的“新徽章获得”弹层。

通用风格：
- 休闲小游戏图标风格，Q 版手绘，厚白描边，干净透明背景。
- 每个徽章为圆形或软圆徽章底托，主体饮品居中，占画面 70% 左右。
- 高饱和但柔和的夏日配色，强调清凉、甜品、水果、多配料。
- 不要任何文字、数字、标签、印章字、logo、水印。
- 每个格子只画一个完整徽章，不要裁切，不要混入 UI 文案。
- 输出透明 PNG 最佳；如果模型只能出普通背景，使用纯浅色背景，后续抠图。

统一负面提示词：
NO TEXT, no labels, no captions, no writing anywhere in the image, no watermark, no logo, no realistic photo, no messy background, no cropped object, no duplicate icon in one cell.

建议分 2 张雪碧图生成：Sheet 6 为 3 列 × 2 行，共 6 枚徽章；Sheet 7 为 2 列 × 2 行，共 4 枚徽章。后续拆分、抠图、裁边，最终导出为 `bowl_badge_31.png` 到 `bowl_badge_40.png`。

## Sheet 6：关卡 31-36

Prompt:
Create a 3 columns x 2 rows sprite sheet of six cute mobile game achievement badge icons, transparent background or plain pale background, consistent Q-style hand-painted art, thick white outline, glossy summer dessert look. Each cell contains exactly one round soft badge icon with one cup or bowl drink/dessert in the center. NO TEXT, no labels, no captions, no writing anywhere in the image.

31. Purple mangosteen snow pear cup badge: pale pear iced drink in a clear cup, purple mangosteen shell crown, white mangosteen segments, soft yellow pear slices, tiny ice cubes, fresh green garnish.
32. Avocado yogurt smoothie cup badge: creamy avocado green smoothie in a clear cup, avocado half with pit, pale yogurt swirl, cream highlights, small mint leaf, soft milk-white rim.
33. Ruby pomegranate ice bowl badge: bright ruby red shaved ice bowl, pomegranate seeds like jewels, red syrup shine, pale ice crystals, golden sparkle accents, refreshing dessert style.
34. Crescent melon hawthorn iced tea badge: warm amber iced tea cup, crescent-shaped yangjiaomi melon slices, red hawthorn berries, coral shell accent, ice cubes and fizzy highlights.
35. Wax apple pink mist cup badge: pale pink sparkling fruit drink, glossy wax apple wedges, soft pink mist bubbles, white ice, aqua sea-breeze highlights, cute rounded cup.
36. Emblic sweet-aftertaste iced drink badge: green-gold fruit tea cup, small round emblic fruits, honey-gold tea glow, lime-green highlights, ice cubes, fresh leaf garnish.

## Sheet 7：关卡 37-40

Prompt:
Create a 2 columns x 2 rows sprite sheet of four cute mobile game achievement badge icons, transparent background or plain pale background, consistent Q-style hand-painted art, thick white outline, glossy summer dessert look. Each cell contains exactly one round soft badge icon with one cup or bowl drink/dessert in the center. NO TEXT, no labels, no captions, no writing anywhere in the image.

37. Guava fruit-cart milkshake badge: pale green guava milkshake cup, guava cross-section with pink center, creamy white foam, small fruit-cart striped accent, fresh tropical look.
38. Papaya warm milk bowl badge: orange papaya milk dessert bowl, papaya cubes and wedge, creamy milk base, warm golden highlights, cozy but still refreshing dessert icon.
39. Fig honey feast bowl badge: elegant purple fig dessert bowl, sliced figs with red seed centers, honey amber drizzle, cream highlights, premium golden rim sparkle.
40. Apricot beach finale bowl badge: celebratory apricot fruit bowl, warm orange apricot halves, golden beach sunlight glow, tiny mint and ice sparkle, grand final badge feeling.
