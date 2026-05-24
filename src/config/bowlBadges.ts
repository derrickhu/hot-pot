import { BOWL_BADGE_IMAGES_ROOT } from '@/config/bowlAssets';

export interface BowlBadgeDef {
  levelNumber: number;
  title: string;
  asset: string;
  vessel: 'cup' | 'bowl';
  drinkColor: number;
  accentColor: number;
  fruitColors: readonly number[];
  garnishColor: number;
}

const badge = (
  levelNumber: number,
  title: string,
  vessel: BowlBadgeDef['vessel'],
  drinkColor: number,
  accentColor: number,
  fruitColors: readonly number[],
  garnishColor: number,
): BowlBadgeDef => ({
  levelNumber,
  title,
  asset: `${BOWL_BADGE_IMAGES_ROOT}/bowl_badge_${String(levelNumber).padStart(2, '0')}.png`,
  vessel,
  drinkColor,
  accentColor,
  fruitColors,
  garnishColor,
});

export const BOWL_BADGES: BowlBadgeDef[] = [
  badge(1, '酸奶莓果杯', 'cup', 0xfff4e7, 0x7ed8ff, [0xff5a7a, 0x355fd1, 0xffc94d], 0x65c85a),
  badge(2, '柠檬蓝莓冰茶', 'cup', 0xffe66d, 0x68d6ff, [0xffe34d, 0x3c73df, 0xff7aaa], 0x50bc6b),
  badge(3, '热带芒芒刨冰', 'bowl', 0xffb43d, 0xffec88, [0xff9f2f, 0xff4c61, 0xffdd4c], 0x62c765),
  badge(4, '星星西瓜水果捞', 'bowl', 0xff6b82, 0x93f0ff, [0xff3f63, 0x3ed56b, 0xffe95c], 0x48b65c),
  badge(5, '莓柚气泡冰杯', 'cup', 0xff7aa8, 0xb8efff, [0xff4b7d, 0xbb3fe3, 0xffc34f], 0x71cf64),
  badge(6, '坚果蜜桃雪顶杯', 'cup', 0xffc17f, 0xfff0b3, [0xffa46b, 0xd8a05a, 0xffe087], 0x78bd52),
  badge(7, '椰香桂圆冰碗', 'bowl', 0xffead0, 0x8fe7ff, [0xffffff, 0xe7a858, 0xffd967], 0x7ac568),
  badge(8, '多彩小料奶茶', 'cup', 0xd9a06a, 0x83ddff, [0xff7acd, 0xffd54a, 0x6c55d8], 0x58bd70),
  badge(9, '脆脆莓莓冰沙', 'bowl', 0xf55e92, 0xbdf4ff, [0xff5280, 0xffd447, 0x8e5ee7], 0x75c85d),
  badge(10, '双轨橙柚冰茶', 'cup', 0xff9d35, 0x68d8ff, [0xffd24a, 0xff6b42, 0x7bd85a], 0x5bc46d),
  badge(11, '十二鲜果冰碗', 'bowl', 0xffefb4, 0x9befff, [0xff515f, 0x3c7ee8, 0xffdc54, 0x70d95d], 0x60bf6d),
  badge(12, '续章荔枝水果茶', 'cup', 0xffd9e8, 0x96e8ff, [0xff78a2, 0xfff2f2, 0xffc14f], 0x6ac66a),
  badge(13, '东方梅子冰饮', 'cup', 0xb95fc2, 0xffd87b, [0x8a3f9e, 0xff6b86, 0xffe066], 0x64bd70),
  badge(14, '混搭雪梨刨冰', 'bowl', 0xf7f5dc, 0x89ddff, [0xffd552, 0xff7a4d, 0x7edc70], 0x5ec06c),
  badge(15, '蜜瓜桃桃冰杯', 'cup', 0xbef17a, 0xffb7d0, [0xff9a60, 0xc8f36a, 0xffe45a], 0x5abf65),
  badge(16, '满贯浆果雪山', 'bowl', 0xd46be8, 0xb5efff, [0xff507b, 0x4f6ce8, 0xffd557], 0x73ca62),
  badge(17, '满贯椰椰冰茶', 'cup', 0xfff4d6, 0x7ee0ff, [0xffffff, 0xffcc58, 0x7bd961], 0x55bd67),
  badge(18, '杂烩水果捞碗', 'bowl', 0xffc25f, 0x9defff, [0xff5b61, 0x7f56df, 0xffe156, 0x5fce65], 0x58be6b),
  badge(19, '薄冰青柠杯', 'cup', 0xcff377, 0xa9f3ff, [0xc6f04e, 0xffffff, 0x68d8ff], 0x51b96a),
  badge(20, '四合莲藕冰碗', 'bowl', 0xf2dfc9, 0x88ddff, [0xf2c28a, 0xffe06a, 0xb87bdc], 0x6bc15f),
  badge(21, '果阵红莓冰沙', 'cup', 0xff5d73, 0xffd1e0, [0xff3f5d, 0x405bdc, 0xffd54d], 0x68c767),
  badge(22, '果阵青柠雪碗', 'bowl', 0xaee95e, 0x8ee7ff, [0xb9ef4e, 0xffdd4a, 0x68d9ff], 0x56bf68),
  badge(23, '滋补银耳甜品', 'bowl', 0xffefd5, 0xf6c17d, [0xffffff, 0xc06ad9, 0xffd760], 0x7ac160),
  badge(24, '小料珍珠奶茶', 'cup', 0xcf9863, 0x83dbff, [0x5a3428, 0xff7fc8, 0xffdc56], 0x62bd66),
  badge(25, '重口巧克力冰杯', 'cup', 0x8b5a38, 0xffc968, [0x5b3524, 0xfff2e0, 0xff6a84], 0x68bd59),
  badge(26, '果下芒果椰雪', 'bowl', 0xffc53f, 0xffef91, [0xffa438, 0xffffff, 0xffdd4a], 0x65c45d),
  badge(27, '滋补红枣冰饮', 'cup', 0xb84f45, 0xffd18a, [0xa64038, 0xffda65, 0xf4eee0], 0x6cc062),
  badge(28, '小料仙草冰碗', 'bowl', 0x493d45, 0x8bdcff, [0x302934, 0xffc84a, 0xff78c7], 0x65bd67),
  badge(29, '廿星爆珠水果茶', 'cup', 0xff8b47, 0x92e9ff, [0xff3f6d, 0xffdb4a, 0x5f70e8, 0x61d35b], 0x5ac36b),
  badge(30, '终章龙果冰冠', 'bowl', 0xff56aa, 0xffe06a, [0xff2f91, 0xffffff, 0xffd84e, 0x63d966], 0x59c86b),
];

export function getBowlBadgeDef(levelNumber: number): BowlBadgeDef {
  const clamped = Math.max(1, Math.min(levelNumber, BOWL_BADGES.length));
  return BOWL_BADGES[clamped - 1]!;
}
