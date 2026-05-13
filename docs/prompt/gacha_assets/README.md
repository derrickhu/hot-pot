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
| `gacha_pool_panel.txt` | 「可能获得」面板底（圆角白卡，6 个空槽，**不带文字也不带任何道具图标**） | 16:9 |
| `gacha_machine_empty.txt` | 扭蛋机本体，**玻璃罩内空**（不放任何彩色球），透明 | 9:16 |
| `gacha_capsules_sheet.txt` | 多色胶囊球网格 sprite sheet，4×4 = 16 颗，每格独立、等大、透明 | 1:1 |

## 输出落点

- 原始母版：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/gacha_assets/<name>_v1.png`
- 抠背景：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/nobg/gacha_assets/<name>_v1.png`
- 裁透明边定稿：`/Users/rosa/rosa_games/game_assets/hot-pot/assets/final/gacha_assets/<name>_v1.png`

用户确认后再拷到游戏包路径 `assets/images/gacha/<name>.png`。
