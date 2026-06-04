const CLEAR_SHARE_TITLES = [
  '果茶店又过关啦！排单思路绝了，脑子不服来战',
  '恭喜过关！订单我都算明白了，智商在线等你来',
  '又通一关！靠的是脑子不是手速，不服来一局',
  '过关成功！我这店长排单逻辑已封神',
  '果茶店营业中——脑子好使刚过关，等你来抄作业',
] as const;

const LEVEL_UP_SHARE_TITLES = [
  '果茶店升级啦！脑子好使店长又进阶，不服来试',
  '店铺升级成功！排单智商拉满，你还敢来挑战？',
  '果茶店升一级！动脑经营越来越顺，来比比看',
  '升级过关双喜！脑子在线订单全清，等你来切磋',
] as const;

/** 格子「江湖急救」分享解锁：突出求助 + 排单玩法。 */
const CELL_UNLOCK_SHARE_TITLES = [
  '果茶店格子堵死了！江湖急救缺一双手，会排单就来',
  '订单爆了托盘满了，分享摇人来做果茶江湖急救',
  '这关我算不过来了，江湖急救需要你那双慧眼',
  '格子锁住了动不了，动动脑子帮我果茶店急救',
  '好友江湖急救！一起排杯上托盘，看你能过几单',
  '分享喊人！果茶店接单调饮，脑子好用不服来战',
] as const;

function pickFrom<T extends readonly string[]>(arr: T): string {
  const i = Math.floor(Math.random() * arr.length);
  return arr[i] ?? arr[0];
}

export function pickMilkTeaShopClearShareTitle(levelUps: number): string {
  return levelUps > 0 ? pickFrom(LEVEL_UP_SHARE_TITLES) : pickFrom(CLEAR_SHARE_TITLES);
}

export function pickMilkTeaShopCellUnlockShareTitle(): string {
  return pickFrom(CELL_UNLOCK_SHARE_TITLES);
}
