# Bowl 水果捞切块放大重生 v1

## 目标
`subpackages/bowl_core/assets/images/bowl/` 中 max 边 < 130px 的素材（参考 `mango_2.png` 152×142）在游戏中放大后模糊，需按 **mango_2** 清晰度与画风重生。

## 画风（对齐 mango_2）
- 2D 手绘卡通食材，略俯视 3/4，**厚深红褐色外描边**（maroon/brown），内部块面有清晰明暗。
- 饱和鲜艳、多汁质感；左上高光；**无外部投影/无落地阴影/无光晕**。
- 单个主体居中，占格子约 65–75%，四周留白便于裁切。
- **纯白 #FFFFFF 实心背景**（便于 rembg）；禁止渐变背景、场景、餐具、文字。

## 尺度
- 每种食材两张：`{id}_1`、`{id}_2`，**同一切块类型**，仅视角/旋转略异（禁止 _1 圆片 _2 方块这种混搭）。
- 小块捞料尺度：禁止半颗苹果、整圈厚菠萝环；见 `docs/水果素材生图提示词.md` B/C 规则。

## 合图
- 4 列 × 3 行 = 12 格；行优先命名见各 batch 文件。
- 格间留白，食材不碰格线。

## 后处理
1. `crop_equal_grid_to_bowl.py` + `birefnet-general` 抠图
2. `trim_alpha_bbox.py` 裁透明边
3. 用户确认后覆盖 `bowl_core/assets/images/bowl/`

## 工具
- **内置 GenerateImage**（不用 Gemini）
- 参考图：`mango_2.png`
