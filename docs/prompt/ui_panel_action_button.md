# 面板底部行动条：免费获取（单枚按钮图）

与首页底栏、`docs/水果素材生图提示词.md` 一致：**清爽淡蓝**、**夏日水果捞**气质；**2D 手绘卡通**、线稿清晰、略抖的粗描边（涂鸦感）、**不要**写实、**不要** 3D 高光塑料。

---

## 造型

- **横条药丸按钮**：圆角很大、略扁；**淡冰蓝填充**（约 `#d6f0fc`～`#c8e8f8`），**外圈手绘感描边**（可用 **深蓝灰** `#4a6d82` 或 **暖深咖** `#5c4032` 二选一，与线稿统一即可），内缘可有一条更浅的线增加层次。
- **左侧**：小 **摄像机 / 激励视频** 图标（扁平卡通、与线稿同色或略深）。
- **右侧**：中文 **「免费获取」**，**深蓝灰字**（约 `#2a4f63`），粗圆手写感、清晰可读。
- 按钮外 **透明底**（PNG alpha）；图中 **只要这一枚按钮**，不要剪贴板、不要整面板。

---

## 画幅建议

- 横向约 **480×120** 或 **520×128**（高分辨率可 2x），左右留白透明适中。
- 进包路径：`assets/images/ui_panel_free_btn.png`  
- 暂存与抠图流程：`docs/生图与资源流程规范.md`

**程序接入**：`BowlScene` 在工具说明弹层打开时，于面板贴图下方居中显示该按钮；点击 toast「激励视频预留」（可再接微信激励视频 API）。

---

## English prompt

```text
Single isolated UI asset, transparent background outside the button. One wide horizontal PILL-shaped mobile-game button for a WeChat mini-game fruit hot-pot title.

2D HAND-PAINTED CARTOON doodle style: slightly wobbly thick outline, clear linework, NOT photorealistic, NOT glossy 3D plastic.

Fill: fresh LIGHT ICE BLUE pastel (~#d6f0fc to #c8e8f8), summer-cool mood matching casual fruit game UI. Outline: hand-drawn feel in deep blue-gray OR warm dark brown, consistent with the linework.

Left: small simple flat cartoon video-camera / reward-ad icon in same ink color family. Right: bold rounded Chinese text "免费获取" in deep blue-gray (~#2a4f63), highly readable.

No clipboard, no full modal, no extra UI, no watermark, no English other than none, only this one pill button centered with modest transparent margin.
```
