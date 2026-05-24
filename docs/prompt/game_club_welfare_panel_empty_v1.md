# 游戏圈福利弹窗 — 空面板组件 v1

单张 **可切片 UI 组件**：福利弹窗主体面板（不含金币、进度条、领取按钮、进入游戏圈按钮）。
金币与进度条由程序绘制；两个按钮单独出图。

## 参考

- 对齐 `game_club_welfare_overlay_ui_prototype_v1.png` 的奶油黄木框、POP 标题、任务区布局。
- **左侧 mascot 必须改为水果角色**，不要花盆/盆栽。

## 输出

- 比例：**3:4**（竖向面板组件）
- 背景：**纯品红 #FF00FF** 铺满画布，便于色键抠图；组件内部不要用 magenta。
- 落盘：`game_assets/hot-pot/assets/raw/game_club_welfare_panel_empty_v1.png`
- 模型：gemini-3.1-flash-image-preview，1K

## ⚠️ 最关键约束（必须遵守）

这是一张 **空面板切片**，程序会在运行时叠加：金币图标、数字 50、进度条、领取按钮、进入游戏圈按钮。

**任务卡片内部必须是完全空白的大块奶油色留白**，像空槽位/placeholder。
**绝对不要画**：金币、数字 50、进度条、0/1、领取、进入游戏圈、任何底部大绿按钮。
**面板底部也不要留大按钮位置**——面板在任务提示小字处结束即可。

## 画面内容（仅这一块面板，居中）

### 必须包含

1. **主面板外框**
   - 大圆角奶油黄 → 浅蜜黄渐变卡片，暖木棕厚描边 + 内白高光。
   - 占画布宽约 88%，高约 90%，居中。

2. **顶部标题**
   - 白色小卷轴标题条 + EXACTLY five characters: **游戏圈福利**
   - POP 体：bright YELLOW fill / RED-ORANGE outline / dark brown outer outline / soft shadow

3. **右上角关闭钮**
   - 红色圆钮 + 白 ✕（可画在面板上，后续程序也可复用）

4. **说明区**
   - **左侧 mascot**：可爱 **橙子水果角色**（或草莓），圆眼 wink、微笑、小叶子/梗，kawaii 卡通，与夏日水果主题一致。**禁止** 花盆、陶盆、盆栽。
   - **右侧白色对话气泡**，浅橙棕边，三行深棕字：
     1. **进入游戏圈，福利礼包天天领！**
     2. **交流游戏心得，获得更多攻略**
     3. **参与话题讨论，福利领不停**

5. **每日任务卡片框架（空槽位 — 最重要）**
   - 暖橙奶油圆角条（#fff0d8 底 + #e0a050 边）
   - 仅保留左上标题 EXACTLY nine characters: **每日：发表1个帖子**
   - 标题下方是一大片 **完全空白** 的奶油色区域：不要任何图标、不要任何数字、不要任何条、不要任何按钮
   - 空白区应占任务卡片高度的 60~70%，像预留插槽

6. **提示小字**
   - 任务卡片下方居中 EXACTLY fifteen characters: **先去游戏圈发帖，返回后会自动刷新进度**
   - 灰蓝棕小字

7. **面板在此结束** —— 下方不要再画任何按钮或大色块

### 必须排除

- NO 金币图标、NO 数字 50、NO 进度条、NO 0/1、NO 0%
- NO **领取** 按钮、NO **进入游戏圈** 按钮、NO 底部绿色大按钮
- NO 整屏遮罩、NO 首页背景、NO 手机框
- NO 花盆 / flower pot / terracotta pot
- If you draw coin/progress/buttons, the output is WRONG — regenerate as empty slot only

## 中文字符串（只允许这些）

游戏圈福利、进入游戏圈，福利礼包天天领！、交流游戏心得，获得更多攻略、参与话题讨论，福利领不停、每日：发表1个帖子、先去游戏圈发帖，返回后会自动刷新进度

## 风格

cozy summer fruit mini game UI, thick rounded outlines, 2D hand-painted cartoon, NOT photoreal, NOT 3D
