# 金币扭蛋 GachaScene 拆分组件资源

按 v1 原型图（`docs/prompt/gacha_scene_ui_prototype_v1.md` /
`game_assets/hot-pot/assets/raw/gacha_scene_ui_prototype_v1.png`）拆出的独立组件资源。

每张图都使用 v1 原图作为 `--image` reference 喂给 Gemini，保证风格、配色、笔触完全一致。
所有资源都需要：

- **背景透明**（除非另说）
- **不带任何文字**（`gacha_title.txt` 例外，专为标题字而生）
- **不带任何按钮 / 面板 / 其它组件**（除非这张图本身就是该组件）

## 目录

| 文件 | 资源说明 | 比例 |
|---|---|---|
| `gacha_bg.txt` | 背景底图：暖色 + 装饰水果 + 装饰星星 + 问号气泡，**不带**文字/按钮/机器/面板 | 9:16 |
| `gacha_title.txt` | 「金币扭蛋」中文 POP 字标，透明背景 | 16:9 |
| `gacha_back_button.txt` | 「返回」药丸按钮，透明背景 | 1:1 |
| `gacha_pull_button.txt` | 抽奖按钮（药丸底，**不带文字**，文字程序绘制以承载动态金币消耗） | 16:9 |
| `gacha_pool_panel.txt` | 「可能获得」面板底（圆角白卡，**7 个空槽**，**不带文字也不带任何道具图标**） | 16:9 |
| `gacha_machine_back.txt` | 扭蛋机底层：机身轮廓 + 顶帽 + 底座 + 出蛋口 + 把手 + 「扭蛋」字；**玻璃罩内填 `#e5f9ff` 实色平涂**，不画高光/反光 | 9:16 |
| `gacha_machine_dome_overlay.txt` | 扭蛋机玻璃罩高光 overlay：**只**画玻璃罩区域的对角白色高光 + 下右弧形 cyan 反光 + rim-light，其余完全透明 | 9:16 |
| `gacha_capsules_sheet.txt` | 多色胶囊球网格 sprite sheet，**3×3 = 9 颗**，每格独立、等大、透明，**绝对无图案** | 1:1 |

## 输出落点

- 原始母版：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/gacha_assets/<name>_v2.png`
- 抠背景：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/nobg/gacha_assets/<name>_v2.png`
- 裁透明边定稿：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/final/gacha_assets/<name>_v2.png`

用户确认后再拷到游戏包路径 `assets/images/gacha/<name>.png`。

> v1 老母版（`gacha_capsules_sheet_v1.png` / `gacha_machine_empty_v1.png`）由于玻璃罩透明 + 胶囊上有图案被弃用，
> 当前实施按 v2 重新生图。胶囊 sheet 改成 **3×3=9** 颗，扭蛋机改成 **back + dome_overlay 两层**。
