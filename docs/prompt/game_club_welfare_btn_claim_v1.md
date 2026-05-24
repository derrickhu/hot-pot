# 游戏圈福利 — 「领取」按钮组件 v1

单枚独立 UI 按钮，用于福利弹窗每日任务领取（**默认禁用灰态**，与空面板原型一致）。

## 参考

- 对齐 `game_club_welfare_overlay_ui_prototype_v1.png` 任务条右侧灰色「领取」按钮。

## 输出

- 比例：**4:1** 横向药丸按钮（Gemini 可用比例）
- 背景：**纯品红 #FF00FF** 铺满，便于色键；按钮内不要用 magenta
- 落盘：`game_assets/hot-pot/assets/raw/game_club_welfare_btn_claim_v1.png`
- 模型：gemini-3.1-flash-image-preview，1K

## 造型

- 横向圆角药丸按钮，略扁，带轻微 3D 厚度（上亮下暗）
- 填充：**灰色禁用渐变**（#d8d2c6 → #c8c2b8）
- 描边：深灰 #a8a095，2~3px
- 文字 EXACTLY two characters: **领取**
  - 白字 + 深灰描边，粗圆 POP 体，居中
- 仅这一枚按钮，居中，四周留 magenta 安全边

## 禁止

- NO 其他 UI、NO 面板、NO 金币、NO 进度条
- NO English except none, NO watermark
- NO 绿色/黄色激活态（这是 disabled 版）

## 风格

same family as hot-pot summer fruit game UI buttons, 2D cartoon, thick outlines
