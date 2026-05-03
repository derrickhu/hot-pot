# 碗内工具说明弹层：加菜牌 / 移除 / 打乱（一张雪碧图 · 三列）

参考「剪贴板 + 便签纸」式竖向弹窗：**厚咖色手绘描边**、**米白主区**、**顶中金属夹**、**橙红笔刷标题条 + 白字**、**浅粉杏内框插画**、**咖色说明小字**；与 `docs/水果素材生图提示词.md` **同一 2D 手绘卡通风**（线稿清晰、饱和可爱、非写实）。

---

## 版式（单列 = 一枚完整弹窗）

- **单张横图**，**三列等宽**，从左到右：**加菜牌** | **移除** | **打乱**。
- 每列 **一枚完整竖向弹窗**，列与列之间 **少量间隙**；弹窗外 **透明底**（PNG alpha）。
- **不要**画参考图里底部 **黄色「免费获取」药丸按钮**、**不要**摄像机图标、**不要**任何激励视频按钮；弹窗主体内容在 **说明文字下缘结束**，底部留 **透明留白**（约整列高度 12%～18%），便于程序叠按钮。

---

## 三列文案与插画

| 列 | 标题（橙条白字） | 内框插画 | 标题下说明（咖色圆体） |
|----|------------------|----------|-------------------------|
| 0 | **加菜牌** | 三只小浅碟/卡槽，第三格带 **亮黄绿「+」**；可叠 tiny 水果丁装饰 | **增加暂存区 1 个菜碟** |
| 1 | **移除** | **蓝柄卡通小扫帚**扫过三只空浅格（与水果捞盘子气质一致） | **移除所有菜碟中的食材** |
| 2 | **打乱** | **浅色碗 + 奶白汤** 内浮 **小块水果**（草莓片、橙片等），旁有 **绿色旋转箭头** 或汤勺示意搅拌 | **打乱所有食材** |

内框后可极淡 **圆形纹样水印**（参考图），勿抢主体。

---

## 画幅建议

- 总宽 **能被 3 整除**（如 **1536×900** 或 **1344×840**），便于 `width / 3` 裁帧。
- 暂存与抠图流程见 `docs/生图与资源流程规范.md`；进包路径：`subpackages/bowl_game/assets/images/bowl_tool_panels.png`。

---

## English prompt（一张出三列）

```text
Single horizontal PNG sprite sheet, transparent background outside panels. EXACTLY THREE equal-width columns in one row; each column is ONE complete vertical clipboard-style modal for a WeChat mini-game fruit hot-pot title.

Style: 2D HAND-PAINTED CARTOON cozy UI — thick warm brown outlines, cream parchment panel, grey metal clip at top center, orange brushstroke title banner with bold WHITE Chinese title text, light pink-peach inner rounded illustration box, faint decorative circular watermark behind art, brown rounded description text below inner box. Same cute saturated food-game family as casual fruit icons — NOT photorealistic, NOT cinematic 3D.

CRITICAL: Do NOT draw any bottom yellow pill button, NO "免费获取" text, NO video camera icon, NO ad reward bar. End each panel's painted content at the description line; leave generous TRANSPARENT empty margin at bottom of each column (~15% column height).

Column 1 (left): Title "加菜牌". Inner art: three small empty plate slots, third slot has bright lime-green "+" accent; optional tiny fruit garnish. Description Chinese: "增加暂存区1个菜碟".

Column 2 (middle): Title "移除". Inner art: cute blue-handled cartoon brush sweeping across three empty plate slots. Description: "移除所有菜碟中的食材".

Column 3 (right): Title "打乱". Inner art: light bowl with milky soup and floating small fruit chunks (strawberry orange) plus green curved shuffle arrows or ladle stir. Description: "打乱所有食材".

Top-right small red rounded-square CLOSE "X" on each panel. Small gap between the three modals. No phone frame, no English except none, no watermark, no fourth panel.
```
