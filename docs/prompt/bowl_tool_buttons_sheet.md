# 碗内底部三按钮：加菜牌 / 移除 / 打乱（一张雪碧图）

与 `docs/水果素材生图提示词.md` **同一套 2D 手绘卡通风**：线稿清晰、颜色鲜艳饱和、有食欲、非写实、非 3D 渲染、非无描边矢量。

---

## 版式（对齐参考图二）

- **单张横图**，从左到右 **三个等宽竖格**（3 列栅格），每格内一个 **完整圆形按钮**，圆与圆之间 **留少量间隙**，圆外 **透明背景**（PNG alpha）。
- 每个按钮结构一致（与参考二同构）：
  - **左上**：小圆形 **红色角标**，内 **白色「+」**。
  - **中央**：与功能相关的 **手绘卡通小图标**（见下），略偏上。
  - **底部**：**中文标签**（必须清晰可读），白字 + **深咖描边**，与参考二同款层级感。
- 三枚按钮 **底色、线宽、描边颜色、角标样式** 完全一致，仅中央图标与文字不同。

---

## 三格内容与文案（从左到右 = 列 0 → 2）

| 列 | 文案 | 图标创意（水果风、可爱、易识别） |
|----|------|-----------------------------------|
| 0 | **加菜牌** | 浅色小碟 / 小木盘，上叠 **2～3 块** 鲜艳水果丁（草莓、橙片等），旁有 **小绿「+」** 或小星星点缀 |
| 1 | **移除** | **迷你卡通扫帚**（偏蓝/黄帚毛 + 木柄），或 **小果皮铲** 感，线条圆润，与水果素材同笔触感 |
| 2 | **打乱** | **小木勺 / 小汤勺** + **两颗小水果块** 周围 **绿色旋转箭头**（示意搅拌打乱），勿写实金属 |

---

## 画风与负向（与水果通用条对齐）

- 微信小游戏 UI 小部件，**2D 手绘卡通**，边缘线稿清晰，**不要**写实摄影、**不要**电影光、**不要**复杂场景、**不要**灰脏低饱和。
- **不要**额外装饰大背景、**不要**画屏幕外框、**不要**除三枚按钮外的第四枚控件。
- **不要**英文、不要水印、不要模糊。

---

## 画幅建议

- 推荐总尺寸约 **1536×512** 或 **1200×400**（宽能被 3 整除便于程序 `width/3` 裁帧）；导出 **PNG 透明底**。
- 入库路径：`subpackages/bowl_game/assets/images/bowl_tool_buttons.png`

---

## 后处理：透明底（抠图，不用色键）

生图常为 **RGB 实底**，与场景叠放会露白边。使用 Cursor 通用 skill **`remove-background`**（`rembg` + BiRefNet，按前景识别抠图，非色键）：

```bash
python3 ~/.cursor/skills/remove-background/scripts/rembg_single.py \
  subpackages/bowl_game/assets/images/bowl_tool_buttons.png \
  -o subpackages/bowl_game/assets/images/bowl_tool_buttons_rgba.png \
  -m birefnet-general-lite
```

确认输出为 **RGBA** 后，再覆盖为正式资源名 `bowl_tool_buttons.png`（或直接把 `-o` 指到该路径）。依赖：`pip3 install rembg onnxruntime Pillow`；脚本内已固定 **CPUExecutionProvider**、**OMP_NUM_THREADS=8**（见 skill 说明）。

**裁透明边**（减小雪碧条留白、游戏里可显示更大）：

```bash
python3 scripts/trim_alpha_bbox.py subpackages/bowl_game/assets/images/bowl_tool_buttons.png
```

默认覆盖原文件；也可用 `-o` 另存。

---

## English prompt（一张出三格）

```text
Single horizontal PNG sprite sheet, transparent background outside circles. EXACTLY THREE equal-width columns in one row; each column contains ONE complete circular mobile-game button, same size, small gap between circles. Style: WeChat mini-game 2D HAND-PAINTED CARTOON matching cute bright fruit ingredient icons — clear linework, saturated appetizing colors, soft simple shading, NOT photorealistic, NOT 3D render, NOT flat corporate vector without outlines.

Identical structure for each button (like a reference UI): top-left small RED circular badge with WHITE plus sign; center a cute hand-painted icon; bottom bold WHITE Chinese text with DARK-BROWN stroke.

Column 1 (left): Chinese text "加菜牌". Icon: small light plate with 2-3 tiny colorful fruit chunks (strawberry wedge orange slice) and a tiny green plus accent.

Column 2 (middle): Chinese text "移除". Icon: cute mini cartoon broom (blue/yellow bristles wooden handle) OR playful sweep tool, rounded shapes.

Column 3 (right): Chinese text "打乱". Icon: small wooden spoon with two tiny fruit bits and bright GREEN curved arrows suggesting mix/shuffle.

Warm coffee-brown circular button base, same for all three. No extra UI, no phone frame, no English, no watermark, no fourth button.
```

---

## 程序接入

- `BowlScene` 预加载 `bowl_tool_sheet` → `subpackages/bowl_game/assets/images/bowl_tool_buttons.png`，按 `texture.width / 3` 切三帧贴到三个槽位；加载失败则回退矢量按钮。
