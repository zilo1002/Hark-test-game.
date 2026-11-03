// 半亩 · 全部数值配置（平衡调整只需改这里）

export const START_COINS = 50;
export const SAVE_KEY = 'banmu.save.v1';
export const AUTOSAVE_SEC = 10;
export const OFFLINE_CAP_SEC = 2 * 60 * 60; // 离线收益上限 2 小时
export const OFFLINE_MIN_SEC = 20;          // 少于这个不弹离线总结

// 作物：time 成熟秒数；unlock 解锁价；seed 种子价；price 基础售价
export const CROPS = [
  { id: 'scallion',   name: '小葱', time: 8,   unlock: 0,     seed: 2,   price: 7,   color: '#9DB07F' },
  { id: 'radish',     name: '萝卜', time: 15,  unlock: 80,    seed: 4,   price: 14,  color: '#D9CDB8' },
  { id: 'cabbage',    name: '白菜', time: 25,  unlock: 350,   seed: 8,   price: 30,  color: '#A9B98E' },
  { id: 'tomato',     name: '番茄', time: 40,  unlock: 1000,  seed: 16,  price: 60,  color: '#B5574B' },
  { id: 'corn',       name: '玉米', time: 60,  unlock: 2800,  seed: 30,  price: 115, color: '#C9A85A' },
  { id: 'strawberry', name: '草莓', time: 90,  unlock: 7000,  seed: 50,  price: 210, color: '#A8474F' },
  { id: 'pumpkin',    name: '南瓜', time: 150, unlock: 18000, seed: 90,  price: 430, color: '#C07A3E' },
  { id: 'truffle',    name: '松露', time: 240, unlock: 45000, seed: 160, price: 860, color: '#7A6553' },
];

// 田地：3 列 × 4 行，开局 2×2
export const FIELD_COLS = 3;
export const FIELD_ROWS = 4;
export const START_PLOTS = [0, 1, 3, 4];
export const PLOT_UNLOCK_ORDER = [2, 5, 6, 7, 8, 9, 10, 11];
export const PLOT_PRICES = [60, 120, 240, 450, 800, 1400, 2400, 4000];

// 场地坐标（单位：一块地宽 = 1）
export const FIELD_H = 4.6;              // 3 × 4.6 的场地
export const PATH_Y = 4.32;              // 田埂小路
export const BARN_POS = { x: 0.28, y: 4.32 };
export const BOARD_POS = { x: 1.5, y: 4.32 };
export const MARKET_POS = { x: 3.45, y: 4.32 }; // 画面外，挑夫走出去再回来

// 庄园等级：累计金币门槛
export const MANOR_THRESHOLDS = [0, 150, 500, 1500, 4000, 10000, 25000, 60000, 150000, 400000];
export const MANOR_UNLOCKS = {
  2: '雇工：种地工、收割工 · 篱笆',
  3: '挑夫 · 谷仓 · 工具 Lv3',
  4: '管家 · 风车',
  5: '灯笼 · 工具 Lv4',
  6: '垂柳 · 更多雇工',
  7: '远塔 · 工具 Lv5',
  8: '满园灯火',
  9: '月下半亩',
  10: '传家庄园',
};
// 工具等级上限随庄园等级
export function toolCapForManor(lv) {
  if (lv >= 7) return 5;
  if (lv >= 5) return 4;
  if (lv >= 3) return 3;
  return 2;
}

// 工具：cost[i] 为升到 Lv(i+2) 的价格
export const TOOLS = {
  hoe: {
    name: ['锄头', '锄头', '宽锄', '犁', '铁犁'],
    cost: [150, 800, 3000, 12000],
    effect: ['每次点击播种 1 块', '每次点击播种一整行', '播种一整行，种子 -10%', '每次点击播种整片田', '播种整片田，种子 -20%'],
    area: ['one', 'row', 'row', 'field', 'field'],
    seedDiscount: [0, 0, 0.1, 0.1, 0.2],
  },
  sickle: {
    name: ['镰刀', '镰刀', '长镰', '钐刀', '金镰'],
    cost: [180, 900, 3500, 14000],
    effect: ['每次点击收割 1 块', '每次点击收割一整行', '收割一整行，10% 双倍收成', '每次点击收割整片田', '收割整片田，20% 双倍收成'],
    area: ['one', 'row', 'row', 'field', 'field'],
    double: [0, 0, 0.1, 0.1, 0.2],
  },
  water: {
    name: ['水壶', '喷壶', '水车', '洒水器', '自动洒水器'],
    cost: [250, 1200, 5000, 20000],
    effect: ['生长速度 ×1.00', '生长速度 ×1.15', '生长速度 ×1.30', '生长速度 ×1.50', '生长速度 ×1.75'],
    speed: [1, 1.15, 1.3, 1.5, 1.75],
  },
  cart: {
    name: ['竹筐', '独轮车', '推车', '双轮车', '马车'],
    cost: [200, 1000, 4500, 18000],
    effect: ['售价 ×1.00', '售价 ×1.10', '售价 ×1.20', '售价 ×1.35', '售价 ×1.50'],
    sell: [1, 1.1, 1.2, 1.35, 1.5],
  },
  barn: {
    name: ['草棚', '仓房', '谷仓', '大谷仓', '粮仓'],
    cost: [120, 600, 2500, 9000],
    effect: ['容量 30', '容量 60', '容量 120', '容量 250', '容量 500'],
    cap: [30, 60, 120, 250, 500],
  },
};
export const TOOL_ORDER = ['hoe', 'sickle', 'water', 'cart', 'barn'];

// 雇工
export const WORKERS = {
  planter:   { name: '种地工', desc: '走到空地，播下你选的种子', base: 180,  growth: 1.7, max: 4, manor: 2 },
  harvester: { name: '收割工', desc: '走去收成熟的菜，装满筐送回仓库', base: 300, growth: 1.7, max: 4, manor: 2 },
  porter:    { name: '挑夫',   desc: '仓库快满时挑去集市卖掉', base: 300,  growth: 2.2, max: 2, manor: 3 },
  butler:    { name: '管家',   desc: '仓库里货够了就替你交订单', base: 1200, growth: 2.5, max: 2, manor: 4 },
};
export const WORKER_ORDER = ['planter', 'harvester', 'porter', 'butler'];
export const WORKER_MAX_BONUS_MANOR = 6; // 庄园 Lv6 起每种雇工上限 +1
export const WORKER_LEVEL = {
  speed: [1.2, 1.4, 1.65, 1.95, 2.3],      // 步速（块/秒）
  work:  [0.6, 0.5, 0.42, 0.35, 0.28],       // 每个动作耗时（秒）
  basket: [5, 8, 12, 16, 20],               // 收割工筐容量
  porterCap: [12, 25, 45, 80, 140],        // 挑夫一担容量
  butlerBonus: [0, 0.1, 0.2, 0.3, 0.45],   // 管家交单额外赏钱
  costMult: [2, 5, 12, 30],                // 升级价 = base × costMult[lv-1]
};
export const PORTER_THRESHOLD = 0.6; // 仓库占用 ≥60% 时挑夫出发

// 集市
export const PRICE_DRIFT_SEC = 60;
export const PRICE_DRIFT = 0.15;

// 订单
export const ORDER_COUNT = 3;
export const ORDER_CLIENTS = ['镇上的面馆', '河边茶寮', '李家酒坊', '书院伙房', '驿站', '绣坊王婶', '城南药铺', '渡口船家', '寺里斋堂', '县衙后厨', '戏班子', '陈记包子铺'];
export const ORDER_REWARD_MULT = [1.6, 2.0];
export const ORDER_SWAP_COOLDOWN = 30;

export const INCOME_WINDOW = 60;
