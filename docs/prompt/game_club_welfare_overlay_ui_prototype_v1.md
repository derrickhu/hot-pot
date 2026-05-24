# 游戏圈福利弹窗 UI 原型图 v1

目标：为首页「福利」入口弹出的 **游戏圈福利** 面板，设计一张 **完整可落地的高保真 UI 原型图（mockup）**。
风格必须与现有《别捞水果》首页 / 设置面板 / 扭蛋页统一：明亮夏日卡通水果、奶油黄暖底、圆角厚边框、POP 中文标题、手绘感 2D，不要写实 3D。

## 参考图说明

- **reference A（布局）**：当前福利弹窗截图 —— 保留信息架构与控件位置，但全面美术升级。
- **reference B（风格）**：首页夏日水果背景 —— 沿用同款奶油黄底、水果切片、薄荷绿点缀、温暖阳光感。

## 输出参数

- **比例**：9:16 竖版 mobile game UI mockup
- **用途**：内部 UI 原型 / 视觉对齐 / 后续切图参考。**不进游戏包**。
- **落盘**：`game_assets/hot-pot/assets/raw/game_club_welfare_overlay_ui_prototype_v1.png`
- **模型**：`gemini-3.1-flash-image-preview`（NB2）
- **尺寸**：1K

## 整体构图

整张画面 = 手机竖屏内的一帧游戏 UI，**不要** phone frame / notch / 微信胶囊按钮。
背景 = 首页同款夏日水果场景（西瓜片、柠檬、青柠、薄荷叶、冰块），**整屏加 45% 半透明暖棕遮罩**，突出中央弹窗。

中央弹窗占屏宽约 88%、高约 72%，垂直居中略偏上。

## 弹窗结构（自上而下）

### 1. 外框主面板
- 大圆角矩形（radius ~28px 视觉感），**奶油白 → 浅蜜黄渐变** 填充（#fff8e8 → #fff0c8），**不要** 冷蓝色面板。
- 外描边：4px 暖木棕 (#8b5a3a) + 内描边 2px 浅白高光，与设置面板 / 首页底栏同款「木条 + 奶油纸」质感。
- 底部柔和投影，像一张浮在水果背景上的厚纸卡片。

### 2. 顶部标题区
- 顶部居中：**白色小卷轴 / 胶囊标题条**，两端微卷，边线暖棕。
- 标题 EXACTLY five characters: **游戏圈福利**
  - 字风：thick strokes / **bright YELLOW fill** / **RED-ORANGE outline** / **dark brown outermost outline** / soft drop shadow（叮咚 POP 体，与「金币扭蛋」标题一致）
- 右上角：**红色圆形关闭按钮**，白 ✕，带 2px 深红描边（与设置面板关闭钮同款）。

### 3. 说明区（标题下方 ~35% 高度）
- **左侧**：可爱游戏 mascot —— 一只 **会眨眼的橙色小花盆 / 水果锅角色**（圆眼、微笑、两片小叶子），与夏日水果主题一致，不要写实盆栽照片。
- **右侧**：大圆角 **白色对话气泡**，边线浅橙棕，内文三行编号说明，深棕可读字：
  1. **进入游戏圈，福利礼包天天领！**
  2. **交流游戏心得，获得更多攻略**
  3. **参与话题讨论，福利领不停**
- 气泡尾巴指向左侧 mascot。气泡角落可点缀 tiny 草莓 / 星星 sparkle，但勿抢文字。

### 4. 每日任务条（中部）
- 横向 **暖橙奶油任务卡片**（#fff0d8 底 + #e0a050 描边），圆角 18px，宽约面板 92%。
- 左上标题 EXACTLY nine characters: **每日：发表1个帖子**（深棕粗体）
- 左下：**游戏内同款金币图标**（圆形金币 + 中心五角星）+ 下方数字 **50**（橙金 POP 数字）
- 中部：**进度条** —— 白底胶囊条 + 浅橙边；当前 **0/1** 显示在条下方（深棕字）；进度填充 0%（空条即可，表示未完成态）
- 右侧：**领取** 按钮 —— 圆角矩形，**灰色禁用态**（#d8d2c6 底 + #a8a095 边），字 **领取** 深灰；表示尚未完成不可点

### 5. 提示小字（任务条下方）
- 居中一行 EXACTLY fifteen characters: **先去游戏圈发帖，返回后会自动刷新进度**
- 字号偏小，灰蓝棕 (#5a7080)，不抢主视觉。

### 6. 底部主行动按钮
- 宽大圆角药丸按钮（宽约面板 88%，高 ~72px 视觉），**鲜草绿渐变** (#58c46a → #3d9e52)，厚深绿描边 + 内高光。
- 按钮文字 EXACTLY five characters: **进入游戏圈**（白字 + 深绿描边，粗圆 POP 体）
- 按钮两侧可有小 leaf / sparkle 点缀。

## 严格中文字符串（只允许这些 UI 中文）

- 游戏圈福利
- 进入游戏圈，福利礼包天天领！
- 交流游戏心得，获得更多攻略
- 参与话题讨论，福利领不停
- 每日：发表1个帖子
- 领取
- 先去游戏圈发帖，返回后会自动刷新进度
- 进入游戏圈

数字：**50**、**0/1**

## 风格关键词

- cozy summer fruit hot-pot mini game UI
- cream honey yellow warm palette, NOT cold cyan-blue modal
- huahua / 叮咚 POP cartoon Chinese titles
- thick rounded outlines, soft glossy 2D illustration
- polished WeChat casual game production art
- readable at 720x1280 mobile size

## 禁止项

- NO phone device frame, NO notch, NO WeChat system menu dots
- NO QR code, NO watermark, NO app store badge
- NO English UI text (numbers 50, 0/1 allowed)
- NO photoreal, NO hard 3D render
- NO second popup border outside the main panel
- Do NOT change the task rule (daily post 1 time, reward 50 coins)
- Each Chinese character must be COMPLETE, CORRECT, CLEARLY readable
