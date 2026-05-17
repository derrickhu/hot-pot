# Daily Limited Recipe Cards Batch v3

目标：重新生成每日限定所有菜谱图，统一为固定 9:16 竖版手绘 UI 风格。

## 固定风格

所有菜谱图必须参考：

`subpackages/bowl_game/assets/images/daily_limited/recipes/pineapple_sprite_slush_recipe_card_v2.png`

固定规则：

- 9:16 竖版，不允许横版。
- 圆角内卡、顶部大标题、短副标题、上半区饮品插画、中部准备材料、下半区 2 列步骤卡片。
- 可爱手绘插画 / 轻 UI 图标风，不能写实，不能照片风，不能硬 3D。
- 字体粗、清晰、可读，中文字符完整。
- 配色可按主题变化：桃子可粉色，百香果可黄绿，蓝莓桑葚可紫色等。
- 布局、比例、图标密度、步骤卡片结构必须统一。
- 不直接使用用户上传截图作为素材，只从截图识别制作方法内容。

## 通用生成提示词模板

```
Create a 9:16 vertical Chinese recipe card for a cute casual mobile game.
Use the provided pineapple recipe card as the PRIMARY STYLE REFERENCE.
Match its overall layout: rounded inner card, top large title, small subtitle pill,
large hand-drawn drink hero image, material row, and 2-column step card grid.

Theme: <DRINK_NAME>
Color palette: <THEME_COLORS>

Text:
Title exactly: <DRINK_NAME>
Subtitle exactly: <SUBTITLE>
Material section title exactly: 准备材料
Material labels exactly: <MATERIAL_LABELS>
Step texts exactly:
1 <STEP_1_A>
<STEP_1_B>
2 <STEP_2_A>
<STEP_2_B>
3 <STEP_3_A>
<STEP_3_B>
4 <STEP_4_A>
<STEP_4_B>
5 <STEP_5_A>
<STEP_5_B>
6 <STEP_6_A>
<STEP_6_B>

Hero illustration:
<HERO_DESCRIPTION>

Strict constraints:
- Vertical 9:16 only.
- Same hand-drawn UI recipe-card style as the pineapple reference.
- NO photorealistic render, NO photography, NO hard 3D.
- NO English letters, NO watermark, NO QR code, NO app store badge.
- Generate ONLY the listed Chinese text.
- Chinese characters must be complete, correct, bold, readable.
- Avoid tiny dense paragraphs and fake glyphs.
```

## 本批主题

1. 菠萝雪碧冰沙：菠萝 / 雪碧 / 话梅 / 小金桔 / 白糖 / 凉白开。
2. 多肉葡萄：葡萄 / 青提 / 青柠 / 茉莉茶 / 蜂蜜 / 冰块。
3. 多肉桃桃：桃子 / 柠檬片 / 蜂蜜 / 茉莉茶 / 冰块。
4. 百香果爆柠檬：百香果 / 柠檬片 / 茉莉茶 / 蜂蜜 / 冰块。
5. 青提茉莉茶：青提 / 柠檬片 / 茉莉茶 / 蜂蜜 / 冰块。
6. 西柚茉莉茶：西柚 / 茉莉茶 / 蜂蜜 / 冰块 / 温水。
7. 草莓乌龙茶：草莓 / 乌龙茶 / 冰糖 / 冰块 / 温水。
8. 芒果绿茶：芒果 / 绿茶 / 冰块 / 温水。
9. 荔枝玫瑰茶：荔枝 / 玫瑰 / 红茶 / 温水 / 冰块。
10. 菠萝椰子茶：菠萝 / 椰汁 / 绿茶 / 冰块 / 温水。
11. 橙子苹果茶：橙子 / 苹果 / 红茶 / 冰块 / 温水。
12. 柠檬蜂蜜红茶：柠檬 / 红茶 / 蜂蜜 / 温水。
13. 蓝莓桑葚茶：蓝莓 / 桑葚 / 乌龙茶 / 蜂蜜 / 温水。

