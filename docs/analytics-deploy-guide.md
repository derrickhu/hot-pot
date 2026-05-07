# 经分埋点 SDK 部署与联调清单

> ✅ **首次部署已于 2026-05-07 完成并联调通过**（环境 `rosa-env-d7grf78r5dbd37323`）。
> 已验证：health 接口、track 接口、CloudDB 落库、event_id 幂等去重、game_key 白名单拒绝、公网 HTTP 网关链路。
> 后续接入 hot-pot/huahua/caizhu **不需要重复 1~3 步**，直接看 [SDK README 的「新游戏接入步骤」](../../game-analysis/packages/analytics-sdk/README.md#新游戏接入步骤约-30-分钟)。
> 本文档主要保留作为「重建环境」或「部署到新 env」时的 SOP，以及第 9 节多游戏共享架构说明。

---

本文档对应 `analytics-sdk-mvp` Plan 的最后一步「部署 + 端到端联调」。

## 1. 在 CloudBase 控制台建 `analytics_events` 集合

环境：**rosa-env-d7grf78r5dbd37323**（你 hot-pot/huahua/caizhu 共用的 env）

操作：

1. 控制台 → 「文档型数据库」→ 「集合管理」→ 「+ 添加集合」
2. 集合名：`analytics_events`
3. 创建后在「索引设置」标签页加 4 个索引：

| 索引名 | 字段 | 类型 | 说明 |
| --- | --- | --- | --- |
| `uniq_event_id` | `event_id ASC` | 唯一索引 | 服务端按此去重幂等 |
| `idx_game_ts` | `game_key ASC, event_ts ASC` | 普通索引 | 增量拉取主索引 |
| `idx_game_name_ts` | `game_key ASC, event_name ASC, event_ts ASC` | 普通索引 | 按事件名筛选 |
| `idx_game_user_ts` | `game_key ASC, user_id ASC, event_ts ASC` | 普通索引 | 按玩家明细查询 |

4. **TTL 索引**（关键，30 天自动清理）：
   - 控制台如果支持：在 `event_ts` 字段建 TTL 索引，过期时间 2592000000 毫秒（30 天）
   - 如果控制台不支持 TTL 索引创建：忽略此步，依赖经分后端的 `clean-expired-events` daily cron 兜底（已经在 `scheduler.ts` 里挂了，每天 03:00 跑）

## 2. 部署 `analytics-ingest` 云函数

操作：

1. 微信开发者工具 → 项目 → 「云开发」面板 → 「云函数」
2. 选中 `cloudfunctions/analytics-ingest` → 右键「云端安装依赖并上传」
3. 上传完成后在 CloudBase 控制台 → 「云函数」→ `analytics-ingest`：
   - 「环境变量」加：`ANALYTICS_GAME_KEYS=hotpot,huahua,caizhu`
   - 可选加：`ANALYTICS_COLLECTION=analytics_events`（默认值已是这个，可不加）

## 3. 配 HTTP 访问服务（沿用 hotpot-api 同款网关）

> 这一步**不要选「HTTP 触发器」**——那是另一种独立的 URL 格式。
> 你 hot-pot 现在 hotpot-api 用的是 CloudBase「HTTP 访问服务」网关（`<env-id>.service.tcloudbase.com`），analytics-ingest 走同款，所有游戏端 SDK 复用现有 `BACKEND_BASE_URL` 即可，**代码侧零改动**。

操作：

1. CloudBase 控制台 → 「环境管理」→ 「访问服务」→ 「HTTP 访问服务」（或在云函数 analytics-ingest 详情里找到「服务路径」入口）
2. 「+ 添加服务路径」：
   - 服务路径：`/analytics-ingest`
   - 类型：云函数
   - 选中 `analytics-ingest`
3. 保存，立即生效。验证：

   ```bash
   curl -X POST https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com/analytics-ingest/health \
     -H 'Content-Type: application/json' -d '{}'
   # 期望返回 {"ok":true,"ts":<timestamp>}
   ```

4. 客户端代码无需改 endpoint，已经在 [src/analytics/index.ts](../src/analytics/index.ts) 中复用 `BACKEND_BASE_URL` 拼接得到：

   ```
   https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com/analytics-ingest/track
   ```

## 4. 请求合法域名（如果还没加的话）

如果你 hot-pot 现有 hotpot-api 已经能跑通，那 `rosa-env-d7grf78r5dbd37323.service.tcloudbase.com` 这个域名应该早就在「request 合法域名」里加过了，本步骤跳过即可。

否则：

1. 微信公众平台 → 小游戏管理后台 → 「开发」→ 「开发管理」→ 「开发设置」
2. 「服务器域名」→ 「request 合法域名」加 `https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com`
3. 微信开发者工具 → 详情 → 本地设置 → 勾「不校验合法域名」可以临时绕过本地联调

## 5. 启动经分后端拉取事件

操作：

```bash
cd /Users/huyi/dk_proj/game-analysis

# 确保 .env 里有腾讯云密钥（之前接 cloudbase-ingest 应该已经配过）
# TENCENTCLOUD_SECRET_ID=...
# TENCENTCLOUD_SECRET_KEY=...
# GA_SCHEDULER_ENABLED=true

npm run api
```

启动后日志里会出现：

```
[scheduler] started: snapshots(games=2), events(3 games, cron=*/30 * * * * *), cleanup(cron=0 3 * * *, retentionDays=30)
[scheduler] events hotpot: fetched=N, inserted=M, cursor=... -> ..., adMinuteRows=K
```

前端：

```bash
cd /Users/huyi/dk_proj/game-analysis
npm run dev
```

打开 dashboard，点「广告实时（事件流）」Tab 看到 echarts 折线图就联通了。

## 6. 端到端联调验证

1. 微信开发者工具打开 hot-pot，进入第 1 关，刻意失败触发「复活看广告」
2. 看广告完成后，约 30~60 秒内，dashboard 「广告实时」Tab 应能看到：
   - 「曝光数」+1
   - 「按场景拆分」表格出现 `reward / level_fail_revive` 一行
   - 「估算收益」按 ECPM 表（35 元/千次）算出对应数值
3. CloudBase 控制台 → `analytics_events` 集合应能直接看到新增的事件文档
4. 点 dashboard 上的「立即拉取」按钮可以跳过 30s cron 周期立刻同步一次

## 7. 可选：手动触发清理验证

```bash
# 在 game-analysis 里临时执行一次 cleanup（保留期 0 天，立刻清干净所有事件）
cd /Users/huyi/dk_proj/game-analysis
npx tsx -e "import('./src/server/jobs/clean-expired-events').then(m => m.cleanExpiredEvents(0)).then(s => console.log(JSON.stringify(s, null, 2)))"
```

## 8. 后续接入 huahua / caizhu

代码侧零改动，只需要：

1. huahua/caizhu 自家工程加：
   ```json
   "@gp/analytics-sdk": "file:../game-analysis/packages/analytics-sdk"
   ```
2. 复制 `hot-pot/src/analytics/index.ts` 改一下 `GAME_KEY` 常量
3. 接入广告播放点同样调 `showGameplayRewardedAd({ scene, levelId })`

经分后端 / 云函数 / Dashboard / ECPM 配置都已经预先支持三款游戏，无需改动。

## 9. 多游戏共享同一个云函数：可行性、风险与命名策略

这是接入前要先想清楚的核心架构问题。

### 9.1 三款游戏（不同 AppID）能不能共享一个云函数？

**完全可以**，前提条件是云函数走 HTTP 网关（HTTP 访问服务 / HTTP 触发器）暴露公网 URL。

| 调用方式 | 是否锁 AppID | 跨 AppID 共享 | 适用场景 |
| --- | --- | --- | --- |
| `wx.cloud.callFunction` | 是（云函数 env 必须绑定到该 AppID 的小游戏） | 不可 | 同一 AppID 内部 |
| HTTP 访问服务（本方案） | 否 | **可以** | 多游戏复用、外部调用 |
| HTTP 触发器 | 否 | 可以 | 同上，URL 格式不同 |

我们这套 SDK 用的是 `Platform.request` → `wx.request`/`fetch`，本质是普通 HTTPS POST，**不依赖 wx.cloud.* SDK，所以跨 AppID 没有任何阻碍**。

### 9.2 要不要按游戏命名隔离？

**不需要**，建议保持 `analytics-ingest` 中性命名，三家共用一份。

| 共用一份（推荐） | 按游戏命名隔离 |
| --- | --- |
| 一份代码、一次部署 | 三份代码（hotpot-analytics-ingest / huahua-analytics-ingest / caizhu-analytics-ingest） |
| 修 bug 一处生效 | 修 bug 三处部署 |
| 配额按 env 总量算 | 单游戏故障/流量爆发不影响别家 |
| 命名跟现有 `hotpot-api` 风格不一致是 ok 的——`hotpot-api` 是业务接口（专属），`analytics-ingest` 是平台层（共享） | 命名跟 `*-api` 一致，但失去了 SDK 标准化的意义 |

什么时候才考虑拆？三个信号之一就拆：

1. 某个游戏 DAU 飙高把 CloudDB 写入配额吃光了别家
2. 某个游戏出 bug 高频上报错误事件影响了别家 dashboard 数据可信度
3. 不同游戏团队权限要严格隔离（A 团队不能看 B 团队的数据）

当前都不存在，保持共享。

### 9.3 共享带来的安全风险（必须正视）

HTTP 网关公网开放 → **任何知道 URL 的人都能 POST**，潜在风险：

- 攻击者伪造广告事件造成「估算收益」虚高，误导业务决策
- 海量伪造请求耗尽 CloudDB 写入配额（DDoS）
- 伪造其它游戏的 game_key，污染他家数据

我们当前 MVP 的防护级别（已实现）：

- `lib/validate.js` 的 game_key 白名单（`ANALYTICS_GAME_KEYS=hotpot,huahua,caizhu` 环境变量）
- 单批 ≤100 条事件硬限制
- params 字段类型校验 + 字符串长度截断
- event_id 唯一索引去重幂等

**这些只防误用和畸形数据，不防有意攻击。**

### 9.4 安全升级路径（Phase 2 接入，不在 MVP 范围）

按成本从低到高排：

**方案 A：HMAC 签名（推荐第一步）**

- 给每个游戏分配独立 secret（云函数环境变量 `ANALYTICS_SECRET_HOTPOT` / `_HUAHUA` / `_CAIZHU`）
- 客户端 SDK init 时传入自家 secret，每次上报在 header 加 `x-game-key` + `x-ts` + `x-sign`，sign = `hmac_sha256(secret, ts + body)`
- 云函数按 game_key 查 secret，校验签名 + 时间戳防重放（5 分钟有效期）
- secret 放在客户端会被反编译，但比裸接口高得多的攻击门槛已经足够
- 各游戏 secret 互相不可见，泄露一个不影响其它

**方案 B：腾讯云 WAF + 限流**

- CloudBase 控制台「访问控制」可以挂 WAF 规则
- 按 IP / anonymous_id 限流：每秒 N 次/IP 超过自动 ban 5 分钟
- 这一层防 DDoS 比签名更直接

**方案 C：迁移到 wx.cloud.callContainer（如果未来要锁 AppID）**

- 适合未来想严格按 AppID 鉴权时
- 代价是要拆三份云函数（每个 env 一份），失去共享能力
- 短期不建议

### 9.5 共享方案的最终架构

```
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ hotpot   │   │ huahua   │   │ caizhu   │
        │ AppID:A  │   │ AppID:B  │   │ AppID:C  │
        └────┬─────┘   └────┬─────┘   └────┬─────┘
             │ HTTPS POST   │              │
             └──────────────┴──────────────┘
                            │
                  HTTP 访问服务（公网网关）
              rosa-env-...service.tcloudbase.com
                  /analytics-ingest/track
                            │
                  ┌─────────▼──────────┐
                  │ analytics-ingest   │  ← 一份代码，三家共用
                  │  - whitelist 校验   │  ← ANALYTICS_GAME_KEYS=hotpot,huahua,caizhu
                  │  - sanitize         │
                  │  - batch add        │  ← Phase 2 加 HMAC 校验
                  └─────────┬──────────┘
                            │
                  CloudDB analytics_events
                  （30 天 TTL，按 game_key 字段隔离）
```

## 10. 已知扩展点（Phase 2）

- HMAC 签名校验（见 9.4 方案 A）
- 流量主结算接口接入做 T+1 真实收益回填
- 绑定腾讯云 CLS 做事件全文检索 + 告警
- TTL 缩到 7 天 + CLS 90 天，CloudDB 配额压力降一个量级
- SDK 抽出独立 git 仓库 + 发 npm 包
