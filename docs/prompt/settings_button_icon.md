# 设置按钮图标（独立资源）

## 用途

小游戏内通用「设置」圆形按钮贴图；定稿与原始图放在仓库外 **`game_assets/hot-pot/assets/raw/ui/`**，确认进包后再拷贝至 `hot-pot/assets/images/`。

## v1 提示词（首版，偏深咖底）

WeChat mini-game UI asset, 2D hand-painted cartoon style, clean thick outlines, saturated colors, same family as casual fruit game icons — NOT photorealistic, NOT 3D render. One circular settings button icon, perfectly round. Thin light cream or pale gold outer ring border. Inner circle fill: warm dark amber / coffee brown (readable contrast). Center: simplified 6-tooth gear silhouette, filled with deeper golden yellow / mustard yellow (more saturated than cream, not neon). Small circular hole in gear center showing the dark background. Soft cel-shading highlight on gear. Transparent background outside the circle. No text, no watermark, no drop shadow outside asset. Square canvas 512×512 or 1024×1024, icon centered, safe margin ~8%.

## v2 提示词（更活泼、高明度）

整体反馈：**颜色太暗沉** → 提高明度与饱和度，避免深咖主色。要求：**轻快、阳光感**，仍保持 2D 手绘卡通 UI。

```text
WeChat mini-game UI asset, 2D hand-painted cartoon style, cheerful and lively — NOT dark, NOT muddy. Circular settings button icon, perfectly round, centered on square 1024x1024. Thin bright lemon-yellow or soft white outer ring. Inner circle: light warm honey or soft amber-orange fill (NOT dark brown — use medium warm tone like #d4a574 or sunny peach-beige). Center: cute 6-tooth gear, filled with vibrant golden yellow (#ffd54f to #ffca28), saturated and playful, soft highlight on top-left. Small center hole showing slightly darker but still warm fill — not black. Fresh, energetic, friendly mobile game UI. Transparent PNG outside circle. No text, no watermark. Bright high-key look.
```

## 文件（均在 `game_assets/.../raw/ui/`，旧版保留）

| 文件 | 说明 |
|------|------|
| `settings_btn_gear_yellow.png` | v1 原始导出 |
| `settings_btn_gear_yellow_1024.png` | v1 正方形 1024 |
| `settings_btn_gear_yellow_v2_lively.png` | v2 原始导出 |
| `settings_btn_gear_yellow_v2_lively_1024.png` | **推荐先看**：v2 正方形 1024，更活泼 |

## 游戏仓库内路径

- 进包文件：`hot-pot/assets/images/settings_btn.png`
- **抠图流程（已执行）**：`rembg`（`birefnet-general-lite`）→ `scripts/trim_alpha_bbox.py` 裁透明边 → `scripts/downscale_game_textures.py`（`max_side: 256`）控体积。
- 归档（仓库外）：`game_assets/.../raw/ui/settings_btn_matted_trimmed.png`（抠图后、降分辨率前的大图备份可选）
- 代码：`src/utils/settingsButtonSprite.ts`，`HomeScene` / `BowlScene` 引用
