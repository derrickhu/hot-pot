# 转发分享卡片（share_card.jpg）多主题提示词总览

> 用于微信小游戏 `wx.shareAppMessage` 的分享卡封面，平台推荐显示比例 **5:4**。
> 生图用 Gemini NB2（`gemini-3.1-flash-image-preview`）输出 **4:3** 1K 母版（最接近 5:4），再用 `scripts/conform_promo_size.py --target 1000x800` 中心裁切到 5:4，输出 JPG ≤ 200KB。
>
> 母版（PNG）放：`/Users/rosa/rosa_games/game_assets/hot-pot/推广/share_<theme>_v1.png`
> 合规件（JPG）放：`/Users/rosa/rosa_games/game_assets/hot-pot/推广/conformed/share_<theme>_v1_1000x800.jpg`

## 设计原则（公共约束）

- 强主体：单张图必须有"一眼能记住"的主视觉，缩略图也要能 hold 住
- 颜色饱和、对比强、暖色基调：分享卡通常显示在白色聊天背景，要跳出来
- 玩法可识别：必须包含"碗 + 水果 + 订单盘"中的至少 2 个核心元素
- 卷轴标题区：底部留干净区域，便于事后叠中文标题（部分主题不留则在 prompt 里说明）
- 严禁：app 商店徽章、广告 logo、二维码、英文字母、随机数字、说话气泡、白边/黑边

## 8 个主题方向

| # | 文件名 | 风格关键词 | 主题 hook |
|---|---|---|---|
| 1 | `share_funny_meme` | 搞笑 / 内卷梗 | 卡通水果疯狂抢盘子，挤眉弄眼的群像 |
| 2 | `share_challenge_extreme` | 极限挑战 / 高燃 | 黑金质感、火焰边、订单爆满火光四射 |
| 3 | `share_kawaii_cozy` | 治愈可爱 / 奶油色 | Q 萌水果抱抱大碗，蝴蝶结、爱心、奶油泡 |
| 4 | `share_tangping_meme` | 打工人摆烂梗 | 水果躺平摸鱼，咸鱼柠檬等"懒洋洋" |
| 5 | `share_party_carnival` | 节日狂欢 | 彩纸、礼炮、订单卡片爆满满桌欢呼 |
| 6 | `share_collection_dex` | 图鉴收藏 | 几十种水果家族大合照，金徽章环绕 |
| 7 | `share_combo_action` | 连击爆炸 / 速度感 | 三连消瞬间，光线轨迹+sparkle |
| 8 | `share_chef_warm` | 厨师治愈 | Q 版小厨师角色端着冒蒸汽的水果碗，温暖灯光 |

## 生图流程

```bash
# 单张
for i in 1 2 3 4 5 6 7 8 9 10; do
  echo "=== attempt $i ==="
  python3 ~/.cursor/skills/gemini-image-gen/scripts/generate_images.py \
    --prompt-file docs/prompt/share_<theme>.txt \
    --output ../game_assets/hot-pot/推广/share_<theme>_v1.png \
    --aspect-ratio 4:3 --image-size 1K \
    --model gemini-3.1-flash-image-preview && break
  echo "=== attempt $i failed, sleep 5s ==="; sleep 5
done

# conform 5:4
python3 scripts/conform_promo_size.py \
  --input ../game_assets/hot-pot/推广/share_<theme>_v1.png \
  --output ../game_assets/hot-pot/推广/conformed/share_<theme>_v1_1000x800.jpg \
  --target 1000x800 --max-kb 200
```
