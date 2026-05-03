# 微信小游戏图标（1:1）

## 用途

微信小游戏程序图标；定稿与中间产物见仓库外 **`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/wechat_icon/`**，**勿**直接写入本仓库 `assets/`（见 `.cursor/rules/game-assets.mdc`）。

## 画风（与项目统一）

与 `docs/水果素材生图提示词.md` 中「统一画风规范」一致：**2D 手绘卡通**食物插画、**清晰线稿**、**鲜艳高饱和**、柔和卡通光照与阴影；**不要**写实摄影、**不要**电影级 3D 渲染、**不要**无描边扁平企业风。气质可参考 `docs/prompt/home_summer_background.md` 的夏日清凉倾向（薄荷/冰蓝系）。

---

## v1 提示词（首版，已保留不删）

Square 1:1 mobile game app icon, WeChat mini-game style. Solid flat background: soft warm cream or pale mint green, completely uniform no texture. Center-bottom: a cute ceramic or glass fruit bowl. Inside: one large whole pineapple as the hero subject, glossy and volumetric, centered and largest. Around: smaller whole strawberries and blueberries. Glossy 3D cartoon render. Behind the fruit group: stage spotlight — radial beams, warm golden-white rim light, subtle lens flare, shiny debut feeling. No text, no logo, no watermark.

## v2 提示词（玻璃碗 + 冰块 + 清凉感，画风对齐游戏）

Square 1:1 WeChat mini-game app icon. Art style MUST match 2D hand-painted cartoon food illustration: clean readable linework, bright saturated appetizing colors, soft cel-shading, NOT photorealistic, NOT cinematic 3D render, NOT flat corporate vector without outlines. Center composition: a transparent glass bowl with visible ice cubes inside and cold condensation on the outer glass, cool refreshing summer feeling. One large whole pineapple as the main hero fruit, most prominent. Smaller whole strawberries and blueberries nestled among ice. Background: solid soft cool mint-ice-blue or pale aqua, uniform flat color, no busy texture. Behind the bowl: subtle stage spotlight effect adapted to illustration style — soft radial glow, gentle rim light, sparkly highlights suggesting a "debut" moment, not realistic lens flare. Cute, friendly, mobile game icon readability at small size. No text, no logo, no watermark, no UI.

---

## 文件说明（均在仓库外 `game_assets/.../raw/wechat_icon/`，旧版保留）

| 文件 | 说明 |
|------|------|
| `wechat_minigame_icon_fruit_bowl.png` | v1 模型原始导出 |
| `wechat_minigame_icon_1024.png` | v1 居中裁切正方形 1024×1024 |
| `wechat_minigame_icon_v2_glass_ice.png` | v2 模型原始导出 |
| `wechat_minigame_icon_v2_glass_ice_1024.png` | v2 居中裁切正方形 1024×1024 |
| `wechat_minigame_icon_v3_high_contrast_readable_raw.png` | v3 小图标强化版原始导出 |
| `wechat_minigame_icon_v3_high_contrast_readable_1024.png` | v3 1024×1024 导出版 |
| `wechat_minigame_icon_v3_high_contrast_readable_preview_1024_and_64.png` | v3 大图与 64px 小图预览拼图 |

确认进包前：按需抠图/压缩，再**拷贝**到游戏仓库 `assets/images/`。

---

## v3 提示词（小图标可读性强化）

目标：解决小尺寸下碗和背景分不清、水果不够醒目的问题。图标必须像微信小游戏列表里的小图标一样能一眼看懂：**大碗、大水果、少元素、高对比、粗轮廓**。

```text
Square 1:1 WeChat mini-game app icon, optimized for tiny icon readability at 48px and 64px. 2D hand-painted cartoon food illustration, cute, bright, clean, NOT photorealistic, NOT 3D render, NOT flat corporate vector.

Composition: one large transparent glass bowl fills 78% to 85% of the icon width, centered and slightly lower. The bowl silhouette must be very readable, with thick dark teal / navy outline and bright white rim highlights. Do not make the bowl too transparent; use visible cyan-blue glass tint and strong outline so it separates clearly from the background.

Hero fruits: use only a few large fruits, no clutter. One oversized pineapple chunk or pineapple crown at center-back, one big red watermelon wedge front-left, two big strawberries front-right, several large blueberries as accents. Fruits should be large, saturated, and simple shapes with thick clean outlines. Avoid many tiny fruit pieces.

Ice: use 5 to 7 large readable ice cubes in the bowl, bright white and cyan highlights, not too many small cubes.

Background: very simple high-contrast circular app icon background, solid deep aqua / turquoise gradient or flat mint-blue, darker than the glass highlights. Add a soft pale circular halo behind the bowl to make the fruit bowl pop, but keep background clean. No busy texture, no small sparkles except a few large simple highlights.

Small icon rule: all major shapes must remain recognizable when scaled to 48px. Strong silhouette, high contrast, thick outline, simple fruit count, no thin details.

No text, no logo, no watermark, no UI, no phone frame.
```

文件路径：

- 原始：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/wechat_icon/wechat_minigame_icon_v3_high_contrast_readable_raw.png`
- 1024：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/wechat_icon/wechat_minigame_icon_v3_high_contrast_readable_1024.png`
- 64px 预览拼图：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/wechat_icon/wechat_minigame_icon_v3_high_contrast_readable_preview_1024_and_64.png`
