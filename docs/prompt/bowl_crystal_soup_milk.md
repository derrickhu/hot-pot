# 碗内：水晶碗 + 奶白汤（两张分层图）

游戏里 **底层 → 顶层**：**汤贴图** → `水果层` → **水晶碗贴图**（碗中心透明洞，水果从碗口露出）。底栏阴影已去掉时不再叠单独「碗影」。

---

## 统一抠图底（色键）

两图使用 **完全相同的纯色底 `#FF00FF`（洋红）**，与画面内容反差大，便于 **色键一键去底** 或 rembg；**不要用 `#f2ddbb`** 等与奶白、浅灰太接近的颜色。

---

## 图 A：水晶碗 `bowl_crystal_rim.png`

**硬性要求**

- **绝对不要** 碗下投影、外发光、地面阴影、接触阴影（整张图无任何阴影）。
- 水晶感仅用 **不透明厚涂 + 高光**：碗壁为不透明淡灰白 / 浅蓝灰，**不要** 真透明玻璃透出底色。
- **碗口内圈**：与背景 **同色满铺 `#FF00FF`**，抠图后成为透明洞。
- **外形**：**正方形 1:1 画布**上碗为 **数学正圆** 俯视：外轮廓与碗口均为 **同心圆**（像素空间 X/Y 半径相等），**禁止** 椭圆、扁圆、16:9 宽屏、透视压扁。
- 画布必须 **1024×1024**，碗几何中心与画布中心重合；碗外不要出现左右色条、不要把圆画进横向窄条里。
- 背景：仅 **`#FF00FF`**，无其它物体。

**English prompt**

```text
STRICT square 1:1 canvas EXACTLY 1024x1024 pixels (NOT widescreen NOT 16:9). Flat orthographic TOP-DOWN: one crystal-glass fruit-bowl rim viewed from above. The bowl silhouette AND the outer edge of the glass MUST be a PERFECT CIRCLE in pixel coordinates — same radius on X and Y, concentric circular bands, axisymmetric, centered in frame. Absolutely NOT an ellipse, NOT a squashed oval, NOT a horizontal strip crop of a circle. Opaque cel-shade crystal: pale blue-gray milky glass, white specular highlights, NO real transparency. Inner circular opening completely filled flat solid #FF00FF identical to background for chroma key. NO shadows. Background ONLY #FF00FF. No fruits, no liquid, no text, no side beige bars.
```

---

## 图 B：奶白汤 `bowl_soup_milk.png`

**硬性要求**

- 奶白液体 **完全不透明厚涂**：深浅层次仅用 **更亮/更暗的不透明白、象牙、浅灰** 表现，**禁止** 半透明叠在洋红底上透出洋红色（禁止 multiply 透出底）。
- **背景与汤严格分层**：圆外 **整幅** 只能是 **`#FF00FF` 纯色**（无渐变、无噪点、无奶色混入）；圆内 **只能** 是奶白/象牙/浅灰系，**禁止** 圆内出现洋红、禁止圆外出现奶色条带或「脏边」。
- 液体与背景的交界 **清晰**：允许 **1–3px** 的硬边或抗锯齿边，禁止大面积羽化把洋红渗进汤里、也禁止汤色糊到背景区。
- 只有液体，无碗、无水果。液面在 **正方形 1:1 画布** 上为 **数学正圆**（同心圆，非椭圆）；直径约 **65%** 画宽，居中。画布 **1024×1024**。

**English prompt**

```text
STRICT square 1:1 canvas 1024x1024 game texture. TOP-DOWN orthographic. OUTSIDE a centered perfect circle: ONLY flat solid chroma magenta RGB(255,0,255) #FF00FF — no noise, no gradient, no cream pixels outside the circle, no beige bars on sides. INSIDE the circle ONLY: thick fully opaque creamy milk-white gouache (ivory, warm cream, pale gray swirls for depth). HARD separation at the circular boundary: crisp edge or at most 2–3px anti-alias, NO large soft blend mixing magenta into milk and NO milk smear into the background. The liquid silhouette is a TRUE circle (equal X/Y radius), NOT ellipse. No bowl, no fruit, no text, no shadows.
```

---

## 导入与去底

### 汤 `bowl_soup_milk.png`

1. `scripts/chroma_key_ff00ff.py` 去 `#FF00FF`。  
2. `scripts/postprocess_soup_circle.py`：**中心裁 1:1** + **正圆外遮罩**（与汤逻辑一致）。

### 碗沿 `bowl_crystal_rim.png`（与汤同思路，**不裁原画面只补方**）

1. `python3 scripts/chroma_key_ff00ff.py --no-trim -o _rim_chroma.png <生图.png>` — 保留整画布，避免 trim 裁掉内容。  
2. `python3 scripts/postprocess_rim_circle.py _rim_chroma.png -o subpackages/bowl_game/assets/images/bowl_crystal_rim.png` — **仅透明补成正方形**，再 **正圆外轮廓遮罩**，最后 **默认按 alpha 紧裁透明边**（与「去掉大方块透明」一致；若需保留方画布可加 `--no-trim-alpha`）。  
3. 可选：再跑 `scripts/optimize_bowl_textures.py` 仅压体积时注意不要破坏 1:1（碗沿已带 `pad_to_square` 逻辑时可只调 `--rim-max`）。
