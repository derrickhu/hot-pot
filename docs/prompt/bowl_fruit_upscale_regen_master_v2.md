# Bowl 水果切块放大重生 v2

## 合图布局（默认）

**一张 2×2 = 两种水果 × 各 2 张**，切格后得 4 个文件：

| 左上 | 右上 |
|------|------|
| 水果 A `_1` | 水果 A `_2` |
| 水果 B `_1` | 水果 B `_2` |

- 以各水果现有 `bowl/{id}_1.png`、`{id}_2.png` 为参考，**切法形态不变**，只放大变清晰。
- **画风参考**：`mango_2.png`（只学立体感画法；**不用碗截图**，避免盘子/阴影）。
- **立体感**：内部平滑渐变（亮→中→暗）、左上高光、侧面深色体现厚度；略俯视 3/4 见切面厚度；保留瓣纹/环纹/籽等细节。
- 描边：比该食材主色**更深一档**（非统一棕/黑）。
- 白底、无投影、无碗、单食材。

## 小料（`_1` 与 `_2` 完全相同）

- 游戏中仍保留 `_1`、`_2` 两个文件名，但**只画一张**，处理后复制即可。
- 合图时可与另一种小料拼 2×2：两格各一种小料（每格一张，`_2` 由 `_1` 复制）；或**单果单图**生成。

## 备选：单果单独生成

若 2×2 双果合图仍不稳定，改为：

| 类型 | 合图 | 产出 |
|------|------|------|
| 有两种形态的果 | 1×2 | `{id}_1`、`{id}_2` |
| 小料（两张相同） | 单图 1×1 | 一张复制为 `_1`、`_2` |

## 后处理

`crop_equal_grid_to_bowl.py` → rembg → 确认后覆盖 `subpackages/bowl_core/assets/images/bowl/`

## 脚本

```bash
# 清单与批次
python3 scripts/bowl_upscale_regen_v2.py manifest

# 双果 2×2 提示词（例：西柚 + 青柠）
python3 scripts/bowl_upscale_regen_v2.py prompt-duo --a grapefruit --b lime

# 切格（生成图保存后）
python3 scripts/bowl_upscale_regen_v2.py process-duo --a grapefruit --b lime \
  --raw /path/to/sheet.png
```

内置 **GenerateImage**；参考图：**游戏画风截图** + 按顺序 `A_1, A_2, B_1, B_2`。
