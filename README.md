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

## CloudBase 部署信息

- 环境 ID：`rosa-env-d7grf78r5dbd37323`
- 环境别名：`rosa-env`
- 地域：`ap-shanghai`
- 后端云函数：`hotpot-api`
- 函数类型：Event Function，入口 `index.main`
- 运行时：`Nodejs18.15`
- 后端访问域名：`https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com`
- 接口前缀：`/hotpot-api`
- 已部署接口：
  - `POST /hotpot-api/health`
  - `POST /hotpot-api/login`
  - `POST /hotpot-api/save/pull`
  - `POST /hotpot-api/save/push`
  - `POST /hotpot-api/rank/submit`
  - `POST /hotpot-api/rank/list`
  - `POST /hotpot-api/rank/mine`
- 数据库集合：
  - `hotpot_playerData`：云存档数据
  - `hotpot_rankings`：排行榜数据
- 排行榜索引：
  - `user_board_unique`
  - `bowl_rank_order`
  - `fruit_rank_order`
- CloudBase 控制台：`https://tcb.cloud.tencent.com/dev?envId=rosa-env-d7grf78r5dbd37323#/overview`
- 云函数管理：`https://tcb.cloud.tencent.com/dev?envId=rosa-env-d7grf78r5dbd37323#/scf/detail?id=hotpot-api&NameSpace=rosa-env-d7grf78r5dbd37323`
- 文档数据库：`https://tcb.cloud.tencent.com/dev?envId=rosa-env-d7grf78r5dbd37323#/db/doc`

最近部署：2026-05-11，已更新 `hotpot-api` 代码并创建 `hotpot_rankings` 集合。
