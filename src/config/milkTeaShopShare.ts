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

function pickFrom<T extends readonly string[]>(arr: T): string {
  const i = Math.floor(Math.random() * arr.length);
  return arr[i] ?? arr[0];
}

export function pickMilkTeaShopClearShareTitle(levelUps: number): string {
  return levelUps > 0 ? pickFrom(LEVEL_UP_SHARE_TITLES) : pickFrom(CLEAR_SHARE_TITLES);
}
