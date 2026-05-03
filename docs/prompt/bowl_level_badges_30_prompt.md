# 碗内玩法 30 关徽章图标批量生图提示词

目标：为 30 个关卡设计一组统一风格的关卡徽章。每个徽章都是清凉感的水果茶、刨冰、水果捞、奶茶或甜品饮品，一杯或一碗为主体，颜色鲜艳，配冰块、奶盖、薄荷、珍珠、彩色水果、果冻、爆珠等配料。图标用于游戏进度条终点和通关后的“新徽章获得”弹层。

通用风格：
- 休闲小游戏图标风格，Q 版手绘，厚白描边，干净透明背景。
- 每个徽章为圆形或软圆徽章底托，主体饮品居中，占画面 70% 左右。
- 高饱和但柔和的夏日配色，强调清凉、甜品、水果、多配料。
- 不要任何文字、数字、标签、印章字、logo、水印。
- 每个格子只画一个完整徽章，不要裁切，不要混入 UI 文案。
- 输出透明 PNG 最佳；如果模型只能出普通背景，使用纯浅色背景，后续抠图。

统一负面提示词：
NO TEXT, no labels, no captions, no writing anywhere in the image, no watermark, no logo, no realistic photo, no messy background, no cropped object, no duplicate icon in one cell.

建议分 5 张雪碧图生成，每张 3 列 × 2 行，共 6 枚徽章。单张建议 1536×1024 或 1800×1200，后续按 3×2 拆分、抠图、裁边，最终导出为 `bowl_badge_01.png` 到 `bowl_badge_30.png`。

## Sheet 1：关卡 1-6

Prompt:
Create a 3 columns x 2 rows sprite sheet of six cute mobile game achievement badge icons, transparent background or plain pale background, consistent Q-style hand-painted art, thick white outline, glossy summer dessert look. Each cell contains exactly one round soft badge icon with one cup or bowl drink/dessert in the center. NO TEXT, no labels, no captions, no writing anywhere in the image.

1. Yogurt berry cup badge: creamy white yogurt drink in a clear cup, strawberries, blueberries, lemon slice, mint leaf, icy blue badge rim.
2. Lemon blueberry iced tea badge: bright yellow lemon tea in a glass cup, blueberries, lemon wheels, ice cubes, aqua bubbles.
3. Tropical mango shaved ice bowl badge: orange mango shaved ice in a bowl, mango cubes, dragon fruit, pineapple, syrup shine.
4. Star watermelon fruit bowl badge: pink watermelon fruit sago bowl, starfruit slices, watermelon chunks, green mint, cool blue rim.
5. Berry grapefruit sparkling cup badge: pink sparkling fruit tea, grapefruit wedge, raspberry, purple berry, ice and fizz.
6. Nutty peach snow-top cup badge: peach milk drink with cream top, almond flakes, walnut bits, peach wedges, golden honey accent.

## Sheet 2：关卡 7-12

Prompt:
Create a 3 columns x 2 rows sprite sheet of six cute mobile game achievement badge icons, transparent background or plain pale background, consistent Q-style hand-painted art, thick white outline, glossy summer dessert look. Each cell contains exactly one round soft badge icon with one cup or bowl drink/dessert in the center. NO TEXT, no labels, no captions, no writing anywhere in the image.

7. Coconut longan ice bowl badge: milky coconut dessert bowl, longan, lychee, coconut pieces, pale gold syrup, cool blue highlights.
8. Colorful topping milk tea badge: caramel milk tea cup, boba pearls, pink jelly cubes, yellow pudding, purple taro balls, blue badge rim.
9. Crunchy berry smoothie bowl badge: magenta berry smoothie bowl, cookie crumbs, cranberries, blackberries, icy white cream.
10. Orange grapefruit double iced tea badge: orange tea cup with two-color swirl, orange slices, kumquat, green grape, sparkling ice.
11. Twelve-fruit ice bowl badge: overflowing mixed fruit bowl, strawberry, blueberry, orange, kiwi, pineapple, grape, shaved ice sparkle.
12. Lychee fruit tea cup badge: pale pink lychee tea, lychee fruit, cherry, white jelly, peach slice, mint leaf.

## Sheet 3：关卡 13-18

Prompt:
Create a 3 columns x 2 rows sprite sheet of six cute mobile game achievement badge icons, transparent background or plain pale background, consistent Q-style hand-painted art, thick white outline, glossy summer dessert look. Each cell contains exactly one round soft badge icon with one cup or bowl drink/dessert in the center. NO TEXT, no labels, no captions, no writing anywhere in the image.

13. Eastern plum iced drink badge: purple sour plum tea cup, plum fruit, osmanthus sparkle, ice cubes, mint garnish, golden accent.
14. Snow pear shaved ice bowl badge: creamy pale shaved ice bowl, pear slices, lime, cucumber ribbon, honey drops, aqua rim.
15. Melon peach ice cup badge: honeydew and peach drink, green melon cubes, peach wedges, cantaloupe balls, chilled glass.
16. Grand berry snow mountain badge: purple berry shaved ice bowl, raspberry, mulberry, blueberry, cream peak, icy sparkles.
17. Coconut ice tea cup badge: white coconut drink with blue ice, coconut jelly, lime leaf, small pineapple star, clean summer look.
18. Mixed fruit dessert bowl badge: colorful fruit soup bowl, orange, berry, grape, kiwi, sago pearls, glossy syrup.

## Sheet 4：关卡 19-24

Prompt:
Create a 3 columns x 2 rows sprite sheet of six cute mobile game achievement badge icons, transparent background or plain pale background, consistent Q-style hand-painted art, thick white outline, glossy summer dessert look. Each cell contains exactly one round soft badge icon with one cup or bowl drink/dessert in the center. NO TEXT, no labels, no captions, no writing anywhere in the image.

19. Thin ice lime cup badge: green lime iced drink, crushed ice, lime wheels, mint, pale blue frost, refreshing sour style.
20. Lotus root mixed ice bowl badge: creamy dessert bowl, lotus root slices, snow fungus, peach gum, yellow syrup, blue bowl rim.
21. Red berry fruit-array smoothie badge: red berry smoothie cup, strawberry, cranberry, blueberry, ice cubes, sparkling rim.
22. Green lime snow bowl badge: green citrus shaved ice bowl, lime, lemon, honeydew, basil seeds, cool aqua highlights.
23. Nourishing snow fungus dessert badge: warm cream colored chilled dessert bowl, snow fungus, red date, lotus seed, foxnut, golden syrup.
24. Topping boba milk tea badge: milk tea cup, black pearls, taro balls, coconut jelly, pudding cube, bright straw, ice shine.

## Sheet 5：关卡 25-30

Prompt:
Create a 3 columns x 2 rows sprite sheet of six cute mobile game achievement badge icons, transparent background or plain pale background, consistent Q-style hand-painted art, thick white outline, glossy summer dessert look. Each cell contains exactly one round soft badge icon with one cup or bowl drink/dessert in the center. NO TEXT, no labels, no captions, no writing anywhere in the image.

25. Chocolate crunchy ice cup badge: chocolate dessert drink, cookie crumbs, chocolate chips, marshmallow, cream top, golden rim.
26. Mango coconut snow bowl badge: bright mango shaved ice bowl, coconut cream, mango cubes, yellow starfruit, ice sparkle.
27. Red date nourishing ice drink badge: red date tea cup, jujube, longan, lotus seed, honey glow, refreshing ice.
28. Grass jelly topping ice bowl badge: dark grass jelly dessert bowl, red bean, sago, taro balls, pink jelly, blue rim.
29. Popping boba fruit tea badge: orange-pink fruit tea cup, colorful popping boba, strawberry, grape, lemon, fizz and ice.
30. Dragon fruit ice crown bowl badge: final grand badge, vivid dragon fruit shaved ice bowl, white and pink dragon fruit cubes, golden citrus crown, mint, sparkling celebratory rim.
