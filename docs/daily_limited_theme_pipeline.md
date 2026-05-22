# 每日限定主题接入流水线

每日限定按日期号固定主题：每月 1 日使用 `dayOfMonth: 1` 的主题，31 日使用 `dayOfMonth: 31` 的主题。

## 用户输入

后续新增主题时，用户只需要提供：

- 冰饮名称，例如：多肉葡萄。
- 制作方法原文。
- 目标水果 1-3 个，以及每个目标需要收集的数量。

可选输入：

- 难度倾向：简单 / 中等 / 偏难。
- 希望出现的非目标水果或配料。

## 主题设计

1. 精简制作方法为 4-6 个步骤，保留关键材料、关键口味点和最终饮用方式。
2. 生成主题配置：
   - `themeId`：英文 snake_case，例如 `grape_cheese_ice`。
   - `themeName`：页面标题，例如 `今日主题：多肉葡萄`。
   - `drinkName`：奖励和图鉴展示名。
   - `positioningText`：关卡页副标题，一句话说明玩法代入感。
   - `recipeCard.catalogTitle` / `catalogSubtitle`：图鉴展示文字。
   - `recipeCard.shareTitle`：分享标题。
3. 配置目标水果：
   - 支持 1-3 个目标水果。
   - 每个目标必须满足：`requiredCount <= cardCopies <= requiredCount + 2`。
   - 示例：目标 6 个葡萄，则葡萄卡片总数只能是 6-8。
4. 配置卡牌规模：
   - `fruitIds` 可配置较多种类；局内实际发牌由 `getDailyLimitedPlayableFruitIds` 截断为最多 19 种（目标水果必含）。
   - `totalStackCards` 是堆叠区总卡数，不是目标卡数；必须大于等于 210，保持满屏堆叠难度。
   - 后续主题只能在 210 基础上增加，不能减少。
   - 目标卡优先进入堆叠区。
   - 容错区默认只放非目标卡，避免开局过于简单。
   - 目标水果卡仍受限制：每个目标 `cardCopies` 只能是 `requiredCount` 到 `requiredCount + 2`，其余堆叠卡用非目标三消组合补足。

## 制作方法图生成

1. 先把提示词保存到 `docs/prompt/`。
2. 用 Gemini 生成图文制作方法图。所有每日限定制作方法图必须保持统一模板：
   - 参考 `subpackages/bowl_game/assets/images/daily_limited/recipes/pineapple_sprite_slush_recipe_card_v3.png` 的整体风格。
   - 固定为 9:16 竖版卡片，不使用横版。
   - 圆角内卡、顶部标题、主饮品插画、材料区、步骤卡片区的结构固定。
   - 顶部大标题 + 短副标题。
   - 上半区为手绘插画风饮品主图，不能写实摄影风。
   - 中部为 `准备材料`，使用一排食材小图标和短标签。
   - 下半区为 2 列步骤卡片，默认 6 步，步骤文字短而清晰。
   - 画风必须是可爱手绘插画 / 轻 UI 图标风，颜色清爽，不能偏写实、不能照片质感。
   - 配色和边框装饰可以按主题变化，例如葡萄主题可用紫色/薄荷绿，芒果主题可用橙黄/奶油色；但整体版式和画风必须统一。
3. 原图和中间产物放到仓库外：

   `/Users/rosa/rosa_games/game_assets/hot-pot/assets/raw/daily_limited_recipes/`

4. 用户确认后，再复制定稿到游戏分包：

   `subpackages/bowl_game/assets/images/daily_limited/recipes/`

5. 在 `src/config/dailyLimitedLevels.ts` 中填写：

```ts
recipeCard: {
  textureKey: 'daily_limited_recipe_<theme_id>',
  path: 'subpackages/bowl_game/assets/images/daily_limited/recipes/<theme_id>_recipe_card.png',
  catalogTitle: '<冰饮名>',
  catalogSubtitle: '<简短副标题>',
  shareTitle: '<分享标题>',
}
```

## 配置接入

只需要改：

`src/config/dailyLimitedLevels.ts`

新增一条 `DailyThemeLevelDef`，包含：

- `dayOfMonth`
- `themeId`
- `themeName`
- `drinkName`
- `targets`
- `totalStackCards`
- `fruitIds`
- `positioningText`
- `recipeUnlock`
- `recipeCard`
- `bufferSize`
- `toolCounts`
- `layoutSeed`

不需要再改：

- `src/scenes/DailyLimitedScene.ts`
- `src/scenes/CatalogScene.ts`

它们会自动读取主题配置，处理当天主题、奖励弹窗、分享图、图鉴条目和大图预览。

## 校验规则

代码会在加载配置时校验：

- `dayOfMonth` 必须是 1-31。
- `dayOfMonth` 不能重复。
- `themeId` 不能重复。
- 目标水果数量必须是 1-3。
- 每个目标水果必须存在于 `fruitIds`。
- 每个目标 `cardCopies` 必须在 `requiredCount` 到 `requiredCount + 2` 之间。
- `fruitIds` 建议覆盖足够干扰池； playable 上限 19 种，目标水果必须在其中。
- `totalStackCards` 如果配置，必须大于等于 210，且不能小于目标卡总数。
- `recipeCard.textureKey` 和 `recipeCard.path` 必填。

## 验证清单

新增主题后必须验证：

- 当天日期能正确命中主题。
- 卡牌中每个目标水果数量符合配置。
- 目标收集进度和冰碗显示正确。
- 首次通关奖励 50 金币并解锁制作方法。
- 重复通关奖励 5 金币。
- 图鉴只显示已解锁的冰饮制作。
- 点击图鉴条目能打开对应制作方法大图。
- 分享按钮使用当前主题的制作方法图和分享标题。
- 制作方法图尺寸、比例、画风与菠萝冰首图一致。
- `npm run build` 通过。
