# 游戏 Logo 字标：别捞水果

与 `docs/水果素材生图提示词.md` 同一 **2D 手绘卡通风**：线稿清晰、颜色鲜艳饱和、可爱有食欲，**不要**写实摄影、**不要** 3D 金属字、**不要**无描边系统黑体。

---

## 文案

- 固定四字：**别捞水果**（简体），顺序从左到右横排，可读性优先。

---

## 设计感要求

- **不是纯排版字**：整体像 **游戏标题字标 / 手写 POP 字**，字与字可略错落、大小微变化。
- **笔画夸张**：部分横竖可 **拉长、加粗、弯曲** 或带 **小尾巴、小水滴** 感，仍保持汉字可辨认。
- **图形化替代**（至少 1～2 处，自然融入字结构）：
  - **水果**：如 **草莓** 替代某一点或一短竖、**橙片** 作笔画装饰、**小葡萄** 作「口」旁点缀等；
  - **捞勺 / 小汤勺 / 木勺**：可替代 **「捞」** 的提手旁一笔、或作 **「别」** 末笔的弯钩延伸。
- **配色**：暖色为主（草莓红、橙黄、木勺浅褐、奶白高光），可加 **薄荷绿小点缀** 与首页夏日感呼应；**深咖或深绿描边** 保证对比。

---

## 画幅与导出

- 横向条带，推荐约 **960×280** 或 **1280×320**（高分辨率便于缩放）；**透明底** PNG。
- 进包建议：`assets/images/game_logo_title.png`
- 生图 → **remove-background**（若仍有底）→ `trim_alpha_bbox.py`，暂存见 `docs/生图与资源流程规范.md`。

---

## English prompt

```text
Single horizontal game title LOGO art on transparent background, PNG alpha. Chinese characters exactly: 别捞水果 (four characters left to right). WeChat mini-game 2D HAND-PAINTED CARTOON cute fruit hot-pot title style — bold playful custom lettering, NOT plain system font, NOT photorealistic, NOT metallic 3D chrome.

Design: hand-drawn POP logo feel; exaggerated thick strokes, bouncy rhythm, some strokes extended or curved for personality. Integrate at least one or two clever substitutions: tiny strawberry or orange wedge or grape cluster replacing a dot or short stroke; a small wooden soup ladle / skimmer replacing part of the radical in 捞 or as a tail flourish on 别. Warm palette: strawberry red, citrus orange, cream highlights, mint green tiny accents, dark brown or deep green outline for readability.

High legibility for all four characters. No English, no watermark, no extra slogan text, no UI frame. Generous transparent margin around the logo mark.
```
