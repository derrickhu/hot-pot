# 首页背景图：夏日 · 凉爽

竖屏小游戏首页底图，叠在 UI（顶栏、紫按钮、底栏）之下。

**画风必须与碗内水果素材统一**，详见项目 `docs/水果素材生图提示词.md` 中的「统一画风规范」。

---

## 画风统一（与水果素材同系列）

- **2D 手绘卡通**食物 / 场景插画风，与水果图标 **同一套笔触感**：清晰线稿轮廓、颜色 **鲜艳高饱和**、有食欲，**不要**写实摄影、**不要**电影级渲染、**不要**无描边的扁平企业矢量风。
- **光照**：柔和顶光偏卡通，阴影简单干净，与水果素材「统一光照、统一阴影方式」一致。
- **细节**：背景可含西瓜、柠檬、薄荷、冰块等 **手绘感** 元素，但需 **弱对比、偏小或远景感**，避免抢 UI；宁可略平面装饰化，也不要照片纹理。
- **负面**（与水果通用负面对齐）：不要写实摄影，不要复杂写实场景，不要光污染，不要灰脏低饱和，不要模糊主体，不要 UI / 文字 / 水印。

---

## 画幅与用途

- **比例**：**9:16** 竖屏（建议导出 **1080×1920** 或 **720×1280**，游戏中再缩放到逻辑分辨率）。
- **用途**：全屏背景；**不要**画按钮、状态栏、文字、Logo；留出 **顶部约 12%**、**底部约 14%** 略收敛细节，避免抢 UI；**中部** 略留白或极淡纹理，方便紫色大按钮可读。

---

## 气质与配色

- **夏天**：阳光感用 **高键、浅调** 表达，避免厚重黄昏；可点缀 **西瓜、柠檬、薄荷、冰块、透明气泡** 等，需 **虚化 / 大光圈散景**，不要写实大块主体挡中间。
- **凉爽**：主色倾向 **薄荷绿、冰蓝、青白、淡青灰**；可带极淡的 **冷灰渐变**（上浅下略深或对角轻渐变）；**禁止** 大面积暖橙、焦褐主导（与顶栏木色冲突可在边缘极少量出现）。
- **整体**：清新、透气，**手绘卡通插画**（非照片）；**对比度适中**，避免深色脏块压在按钮区域。

---

## 硬性不要

- 无文字、无水印、无 UI 控件、无人物正脸特写。
- 不要强烈镜头畸变、不要横构图。

---

## English prompt（生图可直接贴）

与水果素材英文描述对齐的核心句：**2D hand-painted cartoon game art, clear line art edges, bright saturated appetizing colors, same illustration pipeline as casual mobile fruit icons — NOT photorealistic, NOT cinematic 3D, NOT corporate flat vector without outlines.**

```text
WeChat mini-game style full-screen vertical background wallpaper, STRICT portrait 9:16 (1080 by 1920). 2D HAND-PAINTED CARTOON illustration matching cute fruit ingredient icons: visible clean linework, bright saturated colors, appetizing, soft simple cel-shading, unified soft top-light — same art family as hand-drawn casual game food assets. Summer cool refresh mood: mint green, icy aqua, cyan-white airy gradient. Decorative hand-painted hints of watermelon, citrus, mint, ice cubes as distant soft shapes or gentle pattern — simplified, NOT photo textures, NOT hyper-real bokeh. Center calmer lighter for a big UI button; top ~12% and bottom ~14% simpler for header/footer. Medium contrast, low noise. No text, no watermark, no UI, no logos, no characters. Full bleed.
```

中文可再叠一句给模型（可选）：

```text
与《果了个果》水果食材同一套：2D手绘卡通、线稿清晰、饱和鲜艳、非写实摄影。
```

---

## 产出与接入

- 入库路径：`assets/images/home_bg_summer.jpg`（若生图仍为横屏，可脚本 **居中按 9:16 裁切** 再 `resize` 到 1080×1920；本次已处理。）
- 游戏内：`HomeScene` 异步加载该图，铺满后移除占位纯色底；顶栏、底栏叠在上方。

### 裁切示例（Python / Pillow）

```python
from PIL import Image
im = Image.open("raw.png").convert("RGB")
w, h = im.size
ar = 9 / 16
if w / h > ar:
    nw = int(h * ar)
    x0 = (w - nw) // 2
    im = im.crop((x0, 0, x0 + nw, h))
else:
    nh = int(w / ar)
    y0 = (h - nh) // 2
    im = im.crop((0, y0, w, y0 + nh))
im.resize((1080, 1920), Image.Resampling.LANCZOS).save("home_bg_summer.jpg", quality=88)
```
