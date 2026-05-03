# 别捞水果（hot-pot）

微信小游戏 + **Pixi.js 7** + **TypeScript**，入口为根目录 `game.js`（加载 `minigame/` 下适配器与 `game-bundle.js`）。

## 开发

```bash
npm install
npm run build      # 产出 minigame/game-bundle.js
npm run dev        # watch 模式
```

在微信开发者工具中打开**本仓库根目录**（含 `game.json`、`game.js`）。

## 目录说明（节选）

| 路径 | 说明 |
|------|------|
| `src/` | 游戏逻辑（首页 `HomeScene`、关卡 `BowlScene`） |
| `assets/images/` | 主包：首页背景 / Logo / 主按钮 / 底栏等 |
| `subpackages/bowl_game/` | 分包：碗内贴图、工具条、水果切片等 |
| `minigame/` | 构建产物与 pixi 适配器 |
| `scripts/downscale_game_textures.py` | 大图降分辨率（改资源后按需执行） |
| `scripts/compress_game_images.py` | PNG/JPEG 再压缩 |

官方小游戏文档：<https://developers.weixin.qq.com/minigame/dev/guide/develop/start.html>
