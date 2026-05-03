# 微信小游戏头像 144×144（别捞水果）

平台要求：PNG/JPEG 等，≤2M，建议 **144×144**、**PNG**。本图用于小游戏后台/资料页头像。

---

## 英文整段 prompt（给 Gemini 生图）

Square composition **1:1**, final intent **144×144** app icon style — read clearly at small size.

**Subject:** One **large pineapple** as the **hero** in the **center**, cute and plump, slightly tilted, friendly cartoon eyes optional (very subtle). Around it, **smaller** companion fruits: a few **strawberries, orange slice, watermelon wedge, grapes, lemon slice** — arranged in a **semi-circle or cluster** so they frame the pineapple without hiding it. Clear silhouettes, **bold outlines**, **2D hand-painted casual game** style (same family as hot-pot fruit art: saturated colors, appetizing, **not** photorealistic, **not** 3D render).

**Background:** **Very light** pastel — soft cream, pale mint, or barely-blue sky — **clean and flat**, subtle **radial vignette** slightly darker toward edges OK but keep center bright.

**Stage / spotlight effect:** Strong sense of **“spotlight debut”**: a **soft warm spotlight cone** from above hitting the pineapple; **sparkles**, **small star glints**, and **light rays** or **bokeh highlights** around the fruits; optional **subtle stage floor** as a thin **shiny ellipse** or **glossy reflection** under the group — **magical welcome**, not a busy theater interior. Keep **one clear focal point** (the pineapple).

**Technical:** **No text**, **no UI**, **no watermark**. **Full-bleed** square — important content **inside safe margin** ~8% from edges so it crops safely to 144px. High contrast edges for tiny display.

---

## 进包建议

- 导出：`assets/images/wechat_minigame_icon_144.png`（脚本会再缩放到 **144×144** 并检查体积）。
