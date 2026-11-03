// 半亩·丰收 — every tunable number lives here.
// World units: ~1 unit = 1 CSS px at default zoom. y grows downward (toward the camera).

export const CFG = {
  version: 1,
  saveKey: 'banmu-harvest-v1',

  view: {
    tilt: 0.78,        // vertical squash of the ground plane (2.5D tilted top-down)
    viewWidth: 360,    // world units visible across a portrait screen
    minViewWidth: 360, // landscape / desktop never zooms out more than this
    dprCap: 2,
    camLerp: 6,
    stackCull: 40,     // px above screen top where stack drawing stops
  },

  player: { speed: 135, pickR: 30, harvestR: 22, cap: 30, pickRate: 32, dropRate: 30, cashR: 42,
            payTime: 1.3, payMin: 25, body: 10 },
  vehicle: { speed: 185, pickR: 50, harvestR: 40, cap: 260, pickRate: 150, dropRate: 110, capMul: 4 },
  worker: { speed: 95, pickR: 26, harvestR: 20, cap: 24, pickRate: 18, dropRate: 22 },

  items: {
    wheat:   { name: '小麦',   price: 3,  step: 6.5 },
    egg:     { name: '鸡蛋',   price: 1,  step: 4.6 },
    potato:  { name: '土豆',   price: 2,  step: 5.2 },
    tomato:  { name: '番茄',   price: 3,  step: 5.6 },
    crate:   { name: '蛋箱',   price: 10, step: 8.5 },
    ketchup: { name: '番茄酱', price: 14, step: 9.5 },
  },

  pile: { cell: 10, layer: 4.4, slope: 3, cap: 3800 },
  crops: {
    wheat:  { grow: 5.0, yield: 1 },
    potato: { grow: 7.0, spill: 5 },
  },
  producers: {
    hen:  { period: 1.25, burst: 3 },
    bush: { period: 1.5,  burst: 2 },
  },
  counter: { zoneDx: -66, zoneDy: 4, zoneW: 52, zoneH: 52, serveDx: 60, serveDy: -2, queueGap: 24,
             cashDx: 2, cashDy: 54, standW: 80, standH: 34 },
  proc: { bodyW: 74, bodyH: 44, zoneDx: 72, zoneDy: 8, zoneW: 50, zoneH: 50, outCap: 240 },
  customer: { speed: 130, interval: 0.8, buyMin: 4, buyMax: 12, serveRate: 14, queue: 5, patience: 1.0 },
  tile: { size: 48 },
  fly: { pick: 0.30, drop: 0.24, lay: 0.5, harvest: 0.32, serve: 0.22, produce: 0.35 },
  stars: { twoMul: 1.6 },

  // ---- levels -------------------------------------------------------------
  // objects: field | coop | counter | proc ; hidden:true = appears from a tile.
  // tiles: effect = show:[ids] | hens:{coop,n} | up:{key,v} | worker:{from:[ids],to:[ids]} | vehicle | cashier:id | proc:{id,mul}
  levels: [
    { name: '麦田', W: 560, H: 1000, start: [270, 650], par: 120, bill: 5,
      goal: { type: 'earn', n: 1000 },
      tutorial: true,
      objects: [
        { id: 'F1', type: 'field', crop: 'wheat', x: 186, y: 420, cols: 6, rows: 4, gap: 28 },
        { id: 'F2', type: 'field', crop: 'wheat', x: 186, y: 262, cols: 6, rows: 4, gap: 28, hidden: true },
        { id: 'F3', type: 'field', crop: 'wheat', x: 384, y: 420, cols: 4, rows: 4, gap: 28, hidden: true },
        { id: 'C1', type: 'counter', item: 'wheat', x: 330, y: 720 },
      ],
      tiles: [
        { id: 'a', x: 270, y: 318, price: 15, icon: 'field', label: '麦田', effect: { show: ['F2'] } },
        { id: 'b', x: 120, y: 640, price: 30, icon: 'cap', label: '大背篓', req: ['a'], effect: { up: { key: 'cap', v: 20 } } },
        { id: 'c', x: 440, y: 476, price: 60, icon: 'field', label: '麦田', req: ['a'], effect: { show: ['F3'] } },
        { id: 'd', x: 120, y: 770, price: 140, icon: 'worker', label: '雇工', req: ['b'], effect: { worker: { from: ['F1', 'F2', 'F3'], to: ['C1'] } } },
        { id: 'e', x: 120, y: 890, price: 90, icon: 'speed', label: '跑鞋', req: ['c'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'f', x: 270, y: 890, price: 240, icon: 'worker', label: '雇工', req: ['d'], effect: { worker: { from: ['F1', 'F2', 'F3'], to: ['C1'] } } },
      ] },

    { name: '鸡蛋堆', W: 600, H: 1040, start: [250, 640], par: 230, bill: 5,
      goal: { type: 'collect', item: 'egg', n: 1500 },
      objects: [
        { id: 'K1', type: 'coop', item: 'egg', producer: 'hen', x: 130, y: 200, w: 340, h: 280, n: 4, max: 24, prefill: 1800 },
        { id: 'C1', type: 'counter', item: 'egg', x: 330, y: 760 },
        { id: 'C2', type: 'counter', item: 'egg', x: 330, y: 900, hidden: true },
      ],
      tiles: [
        { id: 'a', x: 120, y: 620, price: 20, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 30 } } },
        { id: 'b', x: 470, y: 600, price: 120, icon: 'hen', label: '买鸡', buy: 4, req: ['a'], repeat: { times: 5, mul: 1.4 }, effect: { hens: { coop: 'K1', n: 4 } } },
        { id: 'c', x: 330, y: 900, price: 80, icon: 'counter', label: '摊位', req: ['a'], effect: { show: ['C2'] } },
        { id: 'd', x: 120, y: 760, price: 70, icon: 'speed', label: '跑鞋', req: ['b'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'e', x: 120, y: 900, price: 120, icon: 'cap', label: '大背篓', req: ['d'], effect: { up: { key: 'cap', v: 60 } } },
        { id: 'f', x: 470, y: 980, price: 150, icon: 'magnet', label: '大手', req: ['c'], effect: { up: { key: 'radius', v: 10 } } },
      ] },

    { name: '土豆地', W: 600, H: 1100, start: [300, 760], par: 150, bill: 10,
      goal: { type: 'collect', item: 'potato', n: 2600 },
      objects: [
        { id: 'P1', type: 'field', crop: 'potato', x: 120, y: 200, cols: 12, rows: 9, gap: 30, prefill: 900 },
        { id: 'C1', type: 'counter', item: 'potato', x: 330, y: 820 },
        { id: 'C2', type: 'counter', item: 'potato', x: 330, y: 960, hidden: true },
      ],
      tiles: [
        { id: 'a', x: 120, y: 690, price: 30, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 30 } } },
        { id: 'b', x: 330, y: 960, price: 90, icon: 'counter', label: '摊位', req: ['a'], effect: { show: ['C2'] } },
        { id: 'c', x: 480, y: 640, price: 260, icon: 'mower', label: '小红车', req: ['a'], effect: { vehicle: true } },
        { id: 'd', x: 120, y: 820, price: 80, icon: 'speed', label: '跑鞋', req: ['b'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'e', x: 120, y: 960, price: 220, icon: 'cap', label: '大车斗', req: ['c'], effect: { up: { key: 'cap', v: 40 } } },
      ] },

    { name: '番茄园', W: 600, H: 1060, start: [300, 720], par: 180, bill: 10,
      goal: { type: 'earn', n: 2600 },
      objects: [
        { id: 'T1', type: 'coop', item: 'tomato', producer: 'bush', x: 130, y: 200, w: 340, h: 260, n: 6, max: 20, prefill: 1000 },
        { id: 'C1', type: 'counter', item: 'tomato', x: 330, y: 760 },
        { id: 'C2', type: 'counter', item: 'tomato', x: 330, y: 900, hidden: true },
      ],
      tiles: [
        { id: 'a', x: 120, y: 610, price: 30, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 30 } } },
        { id: 'b', x: 470, y: 590, price: 60, icon: 'bush', label: '种番茄', buy: 3, req: ['a'], repeat: { times: 4, mul: 1.5 }, effect: { hens: { coop: 'T1', n: 3 } } },
        { id: 'c', x: 120, y: 750, price: 120, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['T1'], to: ['C1', 'C2'] } } },
        { id: 'd', x: 330, y: 900, price: 160, icon: 'counter', label: '摊位', req: ['b'], effect: { show: ['C2'] } },
        { id: 'e', x: 120, y: 890, price: 240, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['T1'], to: ['C1', 'C2'] } } },
        { id: 'f', x: 470, y: 990, price: 300, icon: 'cashier', label: '收银员', req: ['d'], effect: { cashier: ['C1', 'C2'] } },
      ] },

    { name: '蛋箱工坊', W: 620, H: 1160, start: [310, 800], par: 140, bill: 10,
      goal: { type: 'produce', item: 'crate', n: 90 },
      objects: [
        { id: 'K1', type: 'coop', item: 'egg', producer: 'hen', x: 140, y: 190, w: 340, h: 250, n: 6, max: 20, prefill: 1200 },
        { id: 'M1', type: 'proc', in: 'egg', out: 'crate', ratio: 6, time: 0.45, x: 310, y: 580 },
        { id: 'C1', type: 'counter', item: 'crate', x: 410, y: 820 },
      ],
      tiles: [
        { id: 'a', x: 130, y: 720, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 540, y: 700, price: 80, icon: 'hen', label: '买鸡', buy: 4, req: ['a'], repeat: { times: 3, mul: 1.6 }, effect: { hens: { coop: 'K1', n: 4 } } },
        { id: 'c', x: 130, y: 860, price: 150, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
        { id: 'd', x: 130, y: 1000, price: 200, icon: 'gear', label: '快机器', req: ['c'], effect: { proc: { id: 'M1', mul: 0.6 } } },
        { id: 'e', x: 310, y: 1000, price: 260, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['M1'], to: ['C1'] } } },
      ] },

    { name: '番茄酱', W: 620, H: 1160, start: [310, 800], par: 135, bill: 10,
      goal: { type: 'sell', item: 'ketchup', n: 70 },
      objects: [
        { id: 'T1', type: 'coop', item: 'tomato', producer: 'bush', x: 140, y: 190, w: 340, h: 250, n: 8, max: 20, prefill: 1000 },
        { id: 'M1', type: 'proc', in: 'tomato', out: 'ketchup', ratio: 5, time: 0.5, x: 310, y: 580 },
        { id: 'C1', type: 'counter', item: 'ketchup', x: 410, y: 820 },
      ],
      tiles: [
        { id: 'a', x: 130, y: 720, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 540, y: 700, price: 90, icon: 'bush', label: '种番茄', buy: 3, req: ['a'], repeat: { times: 3, mul: 1.6 }, effect: { hens: { coop: 'T1', n: 3 } } },
        { id: 'c', x: 130, y: 860, price: 160, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['T1'], to: ['M1'] } } },
        { id: 'd', x: 310, y: 1000, price: 240, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['M1'], to: ['C1'] } } },
        { id: 'e', x: 130, y: 1000, price: 200, icon: 'cashier', label: '收银员', req: ['b'], effect: { cashier: ['C1'] } },
      ] },

    { name: '鸡蛋土豆', W: 760, H: 1180, start: [380, 840], par: 205, bill: 10,
      goal: { type: 'unlock', n: 8 },
      objects: [
        { id: 'K1', type: 'coop', item: 'egg', producer: 'hen', x: 60, y: 200, w: 290, h: 260, n: 6, max: 18, prefill: 1100 },
        { id: 'P1', type: 'field', crop: 'potato', x: 420, y: 200, cols: 9, rows: 9, gap: 30, prefill: 700 },
        { id: 'C1', type: 'counter', item: 'egg', x: 250, y: 880, flip: true },
        { id: 'C2', type: 'counter', item: 'potato', x: 510, y: 880 },
        { id: 'C3', type: 'counter', item: 'egg', x: 250, y: 1020, flip: true, hidden: true },
        { id: 'C4', type: 'counter', item: 'potato', x: 510, y: 1020, hidden: true },
      ],
      tiles: [
        { id: 'a', x: 380, y: 600, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 150, y: 560, price: 80, icon: 'hen', label: '买鸡', buy: 4, req: ['a'], repeat: { times: 3, mul: 1.6 }, effect: { hens: { coop: 'K1', n: 4 } } },
        { id: 'c', x: 250, y: 1020, price: 120, icon: 'counter', label: '摊位', req: ['a'], effect: { show: ['C3'] } },
        { id: 'd', x: 510, y: 1020, price: 140, icon: 'counter', label: '摊位', req: ['a'], effect: { show: ['C4'] } },
        { id: 'e', x: 380, y: 720, price: 320, icon: 'mower', label: '小红车', req: ['c', 'd'], effect: { vehicle: true } },
        { id: 'f', x: 600, y: 600, price: 200, icon: 'cart', label: '雇小车', req: ['d'], effect: { worker: { from: ['P1'], to: ['C2', 'C4'] } } },
      ] },

    { name: '麦田番茄', W: 760, H: 1180, start: [380, 840], par: 255, bill: 20,
      goal: { type: 'earn', n: 3600 },
      objects: [
        { id: 'F1', type: 'field', crop: 'wheat', x: 70, y: 220, cols: 8, rows: 6, gap: 30 },
        { id: 'T1', type: 'coop', item: 'tomato', producer: 'bush', x: 430, y: 200, w: 290, h: 260, n: 8, max: 18, prefill: 900 },
        { id: 'M1', type: 'proc', in: 'tomato', out: 'ketchup', ratio: 5, time: 0.5, x: 560, y: 610, hidden: true },
        { id: 'C1', type: 'counter', item: 'wheat', x: 250, y: 880, flip: true },
        { id: 'C2', type: 'counter', item: 'tomato', x: 520, y: 880 },
        { id: 'C3', type: 'counter', item: 'ketchup', x: 520, y: 1030, hidden: true },
      ],
      tiles: [
        { id: 'a', x: 380, y: 620, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 560, y: 610, price: 200, icon: 'ketchup', label: '番茄酱机', req: ['a'], effect: { show: ['M1', 'C3'] } },
        { id: 'c', x: 160, y: 620, price: 160, icon: 'worker', label: '雇工', req: ['a'], effect: { worker: { from: ['F1'], to: ['C1'] } } },
        { id: 'd', x: 380, y: 1030, price: 260, icon: 'cart', label: '雇小车', req: ['b'], effect: { worker: { from: ['T1'], to: ['M1'] } } },
        { id: 'e', x: 160, y: 1030, price: 300, icon: 'cart', label: '雇小车', req: ['d'], effect: { worker: { from: ['M1'], to: ['C3'] } } },
        { id: 'f', x: 380, y: 740, price: 360, icon: 'bush', label: '种番茄', buy: 4, req: ['b'], repeat: { times: 2, mul: 1.6 }, effect: { hens: { coop: 'T1', n: 4 } } },
      ] },

    { name: '双工坊', W: 780, H: 1220, start: [390, 880], par: 270, bill: 20,
      goal: { type: 'earn', n: 5600 },
      objects: [
        { id: 'K1', type: 'coop', item: 'egg', producer: 'hen', x: 60, y: 190, w: 290, h: 250, n: 8, max: 18, prefill: 1100 },
        { id: 'T1', type: 'coop', item: 'tomato', producer: 'bush', x: 430, y: 190, w: 290, h: 250, n: 8, max: 18, prefill: 900 },
        { id: 'M1', type: 'proc', in: 'egg', out: 'crate', ratio: 6, time: 0.4, x: 200, y: 600 },
        { id: 'M2', type: 'proc', in: 'tomato', out: 'ketchup', ratio: 5, time: 0.45, x: 580, y: 600 },
        { id: 'C1', type: 'counter', item: 'crate', x: 250, y: 900, flip: true },
        { id: 'C2', type: 'counter', item: 'ketchup', x: 530, y: 900 },
      ],
      tiles: [
        { id: 'a', x: 390, y: 700, price: 50, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 50 } } },
        { id: 'b', x: 120, y: 1050, price: 220, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
        { id: 'c', x: 660, y: 1050, price: 240, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['T1'], to: ['M2'] } } },
        { id: 'd', x: 390, y: 1050, price: 400, icon: 'mower', label: '小红车', req: ['b', 'c'], effect: { vehicle: true } },
        { id: 'e', x: 300, y: 1130, price: 360, icon: 'cashier', label: '收银员', req: ['b'], effect: { cashier: ['C1', 'C2'] } },
        { id: 'f', x: 480, y: 1130, price: 450, icon: 'gear', label: '快机器', req: ['c'], effect: { proc: { id: 'M1', mul: 0.6 }, proc2: { id: 'M2', mul: 0.6 } } },
      ] },

    { name: '青青大农场', W: 860, H: 1360, start: [430, 980], par: 320, bill: 50,
      goal: { type: 'earn', n: 5500 },
      objects: [
        { id: 'K1', type: 'coop', item: 'egg', producer: 'hen', x: 50, y: 190, w: 270, h: 240, n: 8, max: 18, prefill: 1200 },
        { id: 'P1', type: 'field', crop: 'potato', x: 330, y: 190, cols: 7, rows: 8, gap: 30, prefill: 600 },
        { id: 'T1', type: 'coop', item: 'tomato', producer: 'bush', x: 580, y: 190, w: 230, h: 240, n: 8, max: 16, prefill: 900 },
        { id: 'M1', type: 'proc', in: 'egg', out: 'crate', ratio: 6, time: 0.4, x: 180, y: 620 },
        { id: 'M2', type: 'proc', in: 'tomato', out: 'ketchup', ratio: 5, time: 0.45, x: 680, y: 620, hidden: true },
        { id: 'C1', type: 'counter', item: 'crate', x: 230, y: 1000, flip: true },
        { id: 'C2', type: 'counter', item: 'potato', x: 430, y: 1160 },
        { id: 'C3', type: 'counter', item: 'ketchup', x: 630, y: 1000, hidden: true },
      ],
      tiles: [
        { id: 'a', x: 430, y: 720, price: 60, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 50 } } },
        { id: 'b', x: 680, y: 620, price: 260, icon: 'ketchup', label: '番茄酱机', req: ['a'], effect: { show: ['M2', 'C3'] } },
        { id: 'c', x: 430, y: 840, price: 420, icon: 'mower', label: '小红车', req: ['a'], effect: { vehicle: true } },
        { id: 'd', x: 110, y: 1180, price: 300, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
        { id: 'e', x: 750, y: 1180, price: 340, icon: 'cart', label: '雇小车', req: ['b'], effect: { worker: { from: ['T1'], to: ['M2'] } } },
        { id: 'f', x: 260, y: 1280, price: 400, icon: 'cart', label: '雇小车', req: ['d'], effect: { worker: { from: ['P1'], to: ['C2'] } } },
        { id: 'g', x: 600, y: 1280, price: 500, icon: 'cashier', label: '收银员', req: ['e'], effect: { cashier: ['C1', 'C2', 'C3'] } },
      ] },
  ],

  // ---- meta: restore the farmhouse with stars --------------------------------
  meta: [
    { id: 'fence',     name: '修篱笆',   cost: 1 },
    { id: 'path',      name: '铺小路',   cost: 2 },
    { id: 'flowers',   name: '种花坛',   cost: 2 },
    { id: 'well',      name: '修水井',   cost: 3 },
    { id: 'scarecrow', name: '稻草人',   cost: 2 },
    { id: 'tree',      name: '苹果树',   cost: 3 },
    { id: 'paint',     name: '刷新房子', cost: 4 },
    { id: 'windmill',  name: '大风车',   cost: 4 },
    { id: 'pond',      name: '小池塘',   cost: 3 },
    { id: 'barn',      name: '红谷仓',   cost: 4 },
  ],
};

export function goalText(g) {
  const nm = g.item ? CFG.items[g.item].name : '';
  switch (g.type) {
    case 'earn': return `赚到 ${g.n} 金币`;
    case 'collect': return `收集 ${g.n} 个${nm}`;
    case 'unlock': return `解锁 ${g.n} 个格子`;
    case 'produce': return `做出 ${g.n} 个${nm}`;
    case 'sell': return `卖出 ${g.n} 瓶${nm}`;
    default: return '';
  }
}
