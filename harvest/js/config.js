// 半亩·丰收 — every tunable number lives here.
// World units: the ground plane, x to the east (screen right-down), y to the south (screen left-down).
// The camera is isometric (2:1); see render.js for the projection.

export const CFG = {
  version: 2,
  saveKey: 'banmu-harvest-v2',

  view: {
    landH: 400,        // landscape: projected units visible top→bottom
    landW: 760,        //            …and never fewer than this across
    portW: 400,        // portrait:  projected units visible across
    portH: 640,
    dprCap: 2,
    camLerp: 6,
    stackCull: 40,     // px above screen top where stack drawing stops
    plantCap: 4000,    // max plants drawn per frame (LOD beyond this)
  },

  player: { speed: 135, pickR: 30, harvestR: 22, cutRate: 80, cap: 40, pickRate: 32, dropRate: 34, cashR: 40,
            payTime: 1.3, payMin: 25, body: 10 },
  vehicle: { speed: 180, pickR: 48, harvestR: 40, cutRate: 220, cap: 240, pickRate: 150, dropRate: 120, capMul: 4 },
  worker: { speed: 92, pickR: 26, harvestR: 18, cutRate: 26, cap: 30, pickRate: 18, dropRate: 24 },

  items: {
    wheat:   { name: '小麦',   unit: '捆', price: 1,  step: 4.6 },
    tulip:   { name: '郁金香', unit: '枝', price: 1,  step: 4.0 },
    gold:    { name: '金盏花', unit: '朵', price: 1,  step: 3.4 },
    rose:    { name: '玫瑰',   unit: '枝', price: 2,  step: 4.0 },
    egg:     { name: '鸡蛋',   unit: '个', price: 1,  step: 4.6 },
    potato:  { name: '土豆',   unit: '个', price: 2,  step: 5.2 },
    tomato:  { name: '番茄',   unit: '个', price: 3,  step: 5.6 },
    crate:   { name: '蛋箱',   unit: '箱', price: 10, step: 8.5 },
    ketchup: { name: '番茄酱', unit: '瓶', price: 14, step: 9.5 },
    bouquet: { name: '花束',   unit: '束', price: 7,  step: 8.0 },
    basket:  { name: '花篮',   unit: '个', price: 9,  step: 8.5 },
    perfume: { name: '香水',   unit: '瓶', price: 16, step: 8.5 },
  },

  pile: { cell: 10, layer: 4.4, slope: 3, cap: 3800 },
  crops: {
    wheat:  { grow: 7.0 },
    tulip:  { grow: 9.0 },
    gold:   { grow: 8.0 },
    rose:   { grow: 10.0 },
    potato: { grow: 7.0, spill: 5 },
  },
  producers: { hen: { period: 1.25, burst: 3 }, bush: { period: 1.5, burst: 2 } },
  // checkout desk: long along y. Player unloads on the -x side, customers queue on the +x side toward the east gate.
  counter: { deskW: 30, deskD: 64, deskH: 20, zoneDx: -2, zoneDy: 62, zoneW: 50, zoneH: 44, serveDx: 34, queueGap: 22,
             cashDx: -58, cashDy: 62, stockMax: 300 },
  proc: { bodyW: 56, bodyD: 46, bodyH: 34, zoneDx: -52, zoneW: 42, zoneH: 46 },
  customer: { speed: 120, interval: 0.8, buyMin: 4, buyMax: 12, serveRate: 14, queue: 5, patience: 1.0 },
  tile: { size: 42 },
  fly: { pick: 0.30, drop: 0.24, lay: 0.5, harvest: 0.42, serve: 0.22, produce: 0.5 },
  stars: { twoMul: 1.6 },

  // ---- levels ---------------------------------------------------------------
  // objects: field | coop | counter | proc ; hidden:true = appears from a tile (a hidden field shows as a bare soil plot).
  // tiles: effect = show:[ids] | hens:{coop,n} | up:{key,v} | worker:{from:[ids],to:[ids]} | vehicle | cashier:[ids] | proc:[{id,mul}]
  // deco: paths [x,y,w,h] (flat), hedges [x,y,w,h] (solid), trees [x,y,'round'|'cone'] (solid), bushes [x,y]
  levels: [
    // 1 — tutorial: walk through the wheat, stack it, sell it, open a new field, hire a farmhand
    { name: '金色麦田', W: 720, H: 600, start: [410, 300], par: 150, bill: 5, tutorial: true,
      goal: { type: 'earn', n: 1000 },
      objects: [
        { id: 'F1', type: 'field', crop: 'wheat', x: 40, y: 40, w: 270, h: 240, gap: 9 },
        { id: 'F2', type: 'field', crop: 'wheat', x: 40, y: 320, w: 270, h: 240, gap: 9, hidden: true },
        { id: 'C1', type: 'counter', items: ['wheat'], x: 560, y: 300 },
      ],
      tiles: [
        { id: 'a', x: 360, y: 440, price: 15, icon: 'plot', label: '开新田', effect: { show: ['F2'] } },
        { id: 'b', x: 420, y: 520, price: 190, icon: 'worker', label: '雇园丁', req: ['c'], effect: { worker: { from: ['F1', 'F2'], to: ['C1'] } } },
        { id: 'c', x: 370, y: 140, price: 40, icon: 'cap', label: '大背篓', req: ['a'], effect: { up: { key: 'cap', v: 30 } } },
        { id: 'd', x: 450, y: 70, price: 90, icon: 'speed', label: '跑鞋', req: ['b'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'e', x: 500, y: 520, price: 220, icon: 'worker', label: '雇园丁', req: ['d'], effect: { worker: { from: ['F1', 'F2'], to: ['C1'] } } },
        { id: 'f', x: 530, y: 120, price: 120, icon: 'shears', label: '大镰刀', req: ['b'], effect: { up: { key: 'radius', v: 6 } } },
      ],
      deco: { theme: 'farm', paths: [[330, 250, 390, 100], [430, 350, 100, 250]], hedges: [[620, 470, 90, 22]], trees: [[680, 430, 'round'], [660, 40, 'round']], bushes: [[350, 40], [700, 560], [600, 560]], barn: [640, 120] } },

    // 2 — first flowers: dense tulip beds
    { name: '郁金香花田', W: 760, H: 620, start: [430, 320], par: 200, bill: 5,
      goal: { type: 'earn', n: 1400 },
      objects: [
        { id: 'F1', type: 'field', crop: 'tulip', x: 40, y: 40, w: 280, h: 240, gap: 8 },
        { id: 'F2', type: 'field', crop: 'tulip', x: 40, y: 330, w: 280, h: 250, gap: 8, hidden: true },
        { id: 'C1', type: 'counter', items: ['tulip'], x: 600, y: 320 },
      ],
      tiles: [
        { id: 'a', x: 380, y: 450, price: 25, icon: 'cap', label: '大花篮', effect: { up: { key: 'cap', v: 30 } } },
        { id: 'b', x: 370, y: 360, price: 60, icon: 'plot', label: '种花圃', req: ['a'], effect: { show: ['F2'] } },
        { id: 'c', x: 440, y: 550, price: 90, icon: 'worker', label: '雇园丁', req: ['a'], effect: { worker: { from: ['F1', 'F2'], to: ['C1'] } } },
        { id: 'd', x: 390, y: 150, price: 110, icon: 'speed', label: '跑鞋', req: ['b'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'e', x: 520, y: 560, price: 170, icon: 'worker', label: '雇园丁', req: ['c'], effect: { worker: { from: ['F1', 'F2'], to: ['C1'] } } },
        { id: 'f', x: 480, y: 80, price: 140, icon: 'shears', label: '大剪刀', req: ['d'], effect: { up: { key: 'radius', v: 6 } } },
      ],
      deco: { theme: 'garden', paths: [[350, 270, 410, 100], [470, 370, 90, 250]], hedges: [[660, 480, 90, 22]], trees: [[720, 580, 'cone'], [700, 60, 'round']], bushes: [[600, 40], [720, 200], [640, 580]] } },

    // 3 — the egg mountain
    { name: '鸡蛋堆', W: 760, H: 660, start: [430, 400], par: 210, bill: 5,
      goal: { type: 'collect', item: 'egg', n: 1500 },
      objects: [
        { id: 'K1', type: 'coop', item: 'egg', producer: 'hen', x: 70, y: 70, w: 330, h: 280, n: 4, max: 20, prefill: 1800 },
        { id: 'C1', type: 'counter', items: ['egg'], x: 600, y: 380 },
        { id: 'C2', type: 'counter', items: ['egg'], x: 600, y: 540, hidden: true },
      ],
      tiles: [
        { id: 'a', x: 440, y: 520, price: 20, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 30 } } },
        { id: 'b', x: 460, y: 90, price: 120, icon: 'hen', label: '买鸡', buy: 4, req: ['a'], repeat: { times: 5, mul: 1.4 }, effect: { hens: { coop: 'K1', n: 4 } } },
        { id: 'c', x: 600, y: 540, price: 80, icon: 'counter', label: '出售台', req: ['a'], effect: { show: ['C2'] } },
        { id: 'd', x: 300, y: 430, price: 70, icon: 'speed', label: '跑鞋', req: ['b'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'e', x: 300, y: 530, price: 120, icon: 'cap', label: '大背篓', req: ['d'], effect: { up: { key: 'cap', v: 60 } } },
        { id: 'f', x: 460, y: 200, price: 150, icon: 'magnet', label: '大手', req: ['c'], effect: { up: { key: 'radius', v: 10 } } },
      ],
      deco: { theme: 'farm', paths: [[420, 330, 340, 100]], hedges: [[40, 600, 160, 22]], trees: [[60, 450, 'round'], [720, 40, 'round']], bushes: [[200, 470], [720, 620]], barn: [640, 120] } },

    // 4 — potatoes spill out of the ground; the ride-on mower arrives
    { name: '土豆地', W: 780, H: 720, start: [440, 460], par: 180, bill: 10,
      goal: { type: 'collect', item: 'potato', n: 3400 },
      objects: [
        { id: 'P1', type: 'field', crop: 'potato', x: 60, y: 60, w: 360, h: 300, gap: 30, prefill: 900 },
        { id: 'C1', type: 'counter', items: ['potato'], x: 610, y: 440 },
        { id: 'C2', type: 'counter', items: ['potato'], x: 610, y: 600, hidden: true },
      ],
      tiles: [
        { id: 'a', x: 460, y: 580, price: 30, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 30 } } },
        { id: 'b', x: 610, y: 600, price: 90, icon: 'counter', label: '出售台', req: ['a'], effect: { show: ['C2'] } },
        { id: 'c', x: 480, y: 120, price: 240, icon: 'mower', label: '割草机', req: ['a'], effect: { vehicle: true } },
        { id: 'd', x: 320, y: 460, price: 80, icon: 'speed', label: '跑鞋', req: ['b'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'e', x: 320, y: 560, price: 220, icon: 'cap', label: '大车斗', req: ['c'], effect: { up: { key: 'cap', v: 40 } } },
      ],
      deco: { theme: 'farm', paths: [[440, 390, 340, 100]], hedges: [[40, 660, 200, 22]], trees: [[740, 40, 'round'], [60, 480, 'round']], bushes: [[200, 520], [740, 680]], barn: [640, 160] } },

    // 5 — a sea of golden flowers, and the first machine: bouquets
    { name: '金盏花海', W: 800, H: 660, start: [450, 360], par: 140, bill: 10,
      goal: { type: 'produce', item: 'bouquet', n: 140 },
      objects: [
        { id: 'F1', type: 'field', crop: 'tulip', x: 40, y: 40, w: 250, h: 210, gap: 8 },
        { id: 'G1', type: 'field', crop: 'gold', x: 40, y: 290, w: 320, h: 330, gap: 9 },
        { id: 'C1', type: 'counter', items: ['tulip', 'gold', 'bouquet'], x: 630, y: 340 },
        { id: 'M1', type: 'proc', in: 'gold', out: 'bouquet', ratio: 5, time: 0.5, x: 600, y: 160, outTo: 'C1', hidden: true },
      ],
      tiles: [
        { id: 'a', x: 420, y: 470, price: 40, icon: 'cap', label: '大花篮', effect: { up: { key: 'cap', v: 30 } } },
        { id: 'b', x: 600, y: 160, price: 120, icon: 'bouquet', label: '花束机', req: ['a'], effect: { show: ['M1'] } },
        { id: 'c', x: 420, y: 580, price: 150, icon: 'worker', label: '雇园丁', req: ['b'], effect: { worker: { from: ['G1'], to: ['M1'] } } },
        { id: 'd', x: 400, y: 120, price: 200, icon: 'mower', label: '割草机', req: ['b'], effect: { vehicle: true } },
        { id: 'e', x: 500, y: 600, price: 220, icon: 'worker', label: '雇园丁', req: ['c'], effect: { worker: { from: ['G1'], to: ['M1'] } } },
      ],
      deco: { theme: 'garden', paths: [[380, 300, 420, 90], [470, 140, 90, 200]], hedges: [[700, 520, 90, 22], [700, 40, 22, 90]], trees: [[760, 600, 'cone'], [380, 40, 'round']], bushes: [[700, 600], [740, 160]] } },

    // 6 — tomato bushes drop fruit into the yard; carts and a cashier
    { name: '番茄园', W: 760, H: 660, start: [430, 400], par: 150, bill: 10,
      goal: { type: 'earn', n: 2400 },
      objects: [
        { id: 'T1', type: 'coop', item: 'tomato', producer: 'bush', x: 70, y: 70, w: 330, h: 270, n: 6, max: 18, prefill: 1000 },
        { id: 'C1', type: 'counter', items: ['tomato'], x: 600, y: 380 },
        { id: 'C2', type: 'counter', items: ['tomato'], x: 600, y: 540, hidden: true },
      ],
      tiles: [
        { id: 'a', x: 440, y: 520, price: 30, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 30 } } },
        { id: 'b', x: 460, y: 90, price: 60, icon: 'bush', label: '种番茄', buy: 3, req: ['a'], repeat: { times: 4, mul: 1.5 }, effect: { hens: { coop: 'T1', n: 3 } } },
        { id: 'c', x: 300, y: 430, price: 120, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['T1'], to: ['C1', 'C2'] } } },
        { id: 'd', x: 600, y: 540, price: 160, icon: 'counter', label: '出售台', req: ['b'], effect: { show: ['C2'] } },
        { id: 'e', x: 300, y: 540, price: 240, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['T1'], to: ['C1', 'C2'] } } },
        { id: 'f', x: 460, y: 210, price: 300, icon: 'cashier', label: '收银员', req: ['d'], effect: { cashier: ['C1', 'C2'] } },
      ],
      deco: { theme: 'farm', paths: [[420, 330, 340, 100]], hedges: [[40, 600, 180, 22]], trees: [[60, 450, 'round'], [720, 40, 'round']], bushes: [[200, 470], [720, 620]] } },

    // 7 — eggs into crates
    { name: '蛋箱工坊', W: 780, H: 680, start: [440, 420], par: 140, bill: 10,
      goal: { type: 'produce', item: 'crate', n: 150 },
      objects: [
        { id: 'K1', type: 'coop', item: 'egg', producer: 'hen', x: 70, y: 70, w: 330, h: 270, n: 6, max: 20, prefill: 1200 },
        { id: 'M1', type: 'proc', in: 'egg', out: 'crate', ratio: 6, time: 0.45, x: 620, y: 200, outTo: 'C1' },
        { id: 'C1', type: 'counter', items: ['crate'], x: 630, y: 420 },
      ],
      tiles: [
        { id: 'a', x: 440, y: 540, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 460, y: 90, price: 80, icon: 'hen', label: '买鸡', buy: 4, req: ['a'], repeat: { times: 3, mul: 1.6 }, effect: { hens: { coop: 'K1', n: 4 } } },
        { id: 'c', x: 300, y: 440, price: 150, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
        { id: 'd', x: 720, y: 90, price: 200, icon: 'gear', label: '快机器', req: ['c'], effect: { proc: [{ id: 'M1', mul: 0.6 }] } },
        { id: 'e', x: 300, y: 550, price: 260, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
      ],
      deco: { theme: 'farm', paths: [[420, 360, 360, 100], [510, 180, 80, 180]], hedges: [[40, 620, 180, 22]], trees: [[60, 470, 'round'], [740, 640, 'round']], bushes: [[200, 480], [740, 300]] } },

    // 8 — rose beds behind the stone walls
    { name: '玫瑰园', W: 780, H: 640, start: [430, 330], par: 140, bill: 10,
      goal: { type: 'sell', item: 'rose', n: 900 },
      objects: [
        { id: 'R1', type: 'field', crop: 'rose', x: 40, y: 40, w: 290, h: 240, gap: 9 },
        { id: 'R2', type: 'field', crop: 'rose', x: 40, y: 330, w: 290, h: 270, gap: 9, hidden: true },
        { id: 'F1', type: 'field', crop: 'tulip', x: 380, y: 40, w: 170, h: 140, gap: 8 },
        { id: 'C1', type: 'counter', items: ['rose', 'tulip'], x: 610, y: 340 },
      ],
      tiles: [
        { id: 'a', x: 400, y: 450, price: 40, icon: 'cap', label: '大花篮', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 380, y: 360, price: 70, icon: 'plot', label: '种玫瑰', req: ['a'], effect: { show: ['R2'] } },
        { id: 'c', x: 470, y: 560, price: 120, icon: 'worker', label: '雇园丁', req: ['a'], effect: { worker: { from: ['R1', 'R2'], to: ['C1'] } } },
        { id: 'd', x: 400, y: 260, price: 110, icon: 'speed', label: '跑鞋', req: ['b'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'e', x: 550, y: 580, price: 220, icon: 'worker', label: '雇园丁', req: ['c'], effect: { worker: { from: ['R1', 'R2'], to: ['C1'] } } },
        { id: 'f', x: 640, y: 210, price: 240, icon: 'cashier', label: '收银员', req: ['c'], effect: { cashier: ['C1'] } },
      ],
      deco: { theme: 'garden', paths: [[360, 290, 420, 100]], hedges: [[600, 40, 160, 22], [690, 500, 22, 100]], trees: [[740, 600, 'cone'], [740, 130, 'round']], bushes: [[560, 120], [740, 470]] } },

    // 9 — tomatoes into ketchup
    { name: '番茄酱', W: 780, H: 680, start: [440, 420], par: 130, bill: 10,
      goal: { type: 'sell', item: 'ketchup', n: 150 },
      objects: [
        { id: 'T1', type: 'coop', item: 'tomato', producer: 'bush', x: 70, y: 70, w: 330, h: 270, n: 8, max: 18, prefill: 1000 },
        { id: 'M1', type: 'proc', in: 'tomato', out: 'ketchup', ratio: 5, time: 0.5, x: 620, y: 200, outTo: 'C1' },
        { id: 'C1', type: 'counter', items: ['ketchup'], x: 630, y: 420 },
      ],
      tiles: [
        { id: 'a', x: 440, y: 540, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 460, y: 90, price: 90, icon: 'bush', label: '种番茄', buy: 3, req: ['a'], repeat: { times: 3, mul: 1.6 }, effect: { hens: { coop: 'T1', n: 3 } } },
        { id: 'c', x: 300, y: 440, price: 160, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['T1'], to: ['M1'] } } },
        { id: 'd', x: 300, y: 550, price: 240, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['T1'], to: ['M1'] } } },
        { id: 'e', x: 720, y: 600, price: 200, icon: 'cashier', label: '收银员', req: ['b'], effect: { cashier: ['C1'] } },
      ],
      deco: { theme: 'farm', paths: [[420, 360, 360, 100], [510, 180, 80, 180]], hedges: [[40, 620, 180, 22]], trees: [[60, 470, 'round'], [740, 60, 'round']], bushes: [[200, 480], [560, 640]], barn: [700, 300] } },

    // 10 — tulips into flower baskets
    { name: '花篮工坊', W: 820, H: 700, start: [460, 380], par: 140, bill: 10,
      goal: { type: 'produce', item: 'basket', n: 190 },
      objects: [
        { id: 'F1', type: 'field', crop: 'tulip', x: 40, y: 40, w: 320, h: 270, gap: 8 },
        { id: 'G1', type: 'field', crop: 'gold', x: 40, y: 360, w: 280, h: 300, gap: 9 },
        { id: 'C1', type: 'counter', items: ['tulip', 'gold', 'basket'], x: 650, y: 400 },
        { id: 'M1', type: 'proc', in: 'tulip', out: 'basket', ratio: 6, time: 0.45, x: 620, y: 200, outTo: 'C1' },
      ],
      tiles: [
        { id: 'a', x: 430, y: 520, price: 50, icon: 'cap', label: '大花篮', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 420, y: 140, price: 130, icon: 'worker', label: '雇园丁', req: ['a'], effect: { worker: { from: ['F1'], to: ['M1'] } } },
        { id: 'c', x: 440, y: 620, price: 220, icon: 'mower', label: '割草机', req: ['a'], effect: { vehicle: true } },
        { id: 'd', x: 520, y: 620, price: 160, icon: 'worker', label: '雇园丁', req: ['b'], effect: { worker: { from: ['G1'], to: ['C1'] } } },
        { id: 'e', x: 720, y: 90, price: 200, icon: 'gear', label: '快机器', req: ['b'], effect: { proc: [{ id: 'M1', mul: 0.6 }] } },
        { id: 'f', x: 500, y: 60, price: 260, icon: 'worker', label: '雇园丁', req: ['e'], effect: { worker: { from: ['F1'], to: ['M1'] } } },
      ],
      deco: { theme: 'garden', paths: [[400, 340, 420, 100], [500, 180, 90, 160]], hedges: [[720, 560, 90, 22]], trees: [[780, 650, 'cone'], [780, 260, 'round']], bushes: [[380, 680], [760, 40]] } },

    // 11 — two stands at once: eggs and potatoes
    { name: '鸡蛋土豆', W: 900, H: 780, start: [520, 420], par: 230, bill: 10,
      goal: { type: 'earn', n: 2400 },
      objects: [
        { id: 'K1', type: 'coop', item: 'egg', producer: 'hen', x: 70, y: 70, w: 300, h: 250, n: 6, max: 18, prefill: 1100 },
        { id: 'P1', type: 'field', crop: 'potato', x: 60, y: 400, w: 330, h: 330, gap: 30, prefill: 700 },
        { id: 'C1', type: 'counter', items: ['egg'], x: 740, y: 300 },
        { id: 'C2', type: 'counter', items: ['potato'], x: 740, y: 530 },
      ],
      tiles: [
        { id: 'a', x: 500, y: 560, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 440, y: 90, price: 80, icon: 'hen', label: '买鸡', buy: 4, req: ['a'], repeat: { times: 3, mul: 1.6 }, effect: { hens: { coop: 'K1', n: 4 } } },
        { id: 'c', x: 500, y: 680, price: 300, icon: 'mower', label: '割草机', req: ['a'], effect: { vehicle: true } },
        { id: 'd', x: 440, y: 450, price: 200, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['P1'], to: ['C2'] } } },
        { id: 'e', x: 440, y: 200, price: 220, icon: 'cart', label: '雇小车', req: ['b'], effect: { worker: { from: ['K1'], to: ['C1'] } } },
        { id: 'f', x: 600, y: 680, price: 100, icon: 'speed', label: '跑鞋', req: ['d'], effect: { up: { key: 'speed', v: 25 } } },
      ],
      deco: { theme: 'farm', paths: [[470, 380, 430, 100], [540, 140, 80, 260]], hedges: [[820, 700, 70, 22]], trees: [[860, 60, 'round'], [860, 740, 'round']], bushes: [[600, 40], [440, 740]], barn: [680, 120] } },

    // 12 — roses into perfume
    { name: '玫瑰香水', W: 840, H: 720, start: [470, 400], par: 130, bill: 20,
      goal: { type: 'produce', item: 'perfume', n: 220 },
      objects: [
        { id: 'R1', type: 'field', crop: 'rose', x: 40, y: 40, w: 330, h: 290, gap: 9 },
        { id: 'R2', type: 'field', crop: 'rose', x: 40, y: 380, w: 310, h: 290, gap: 9, hidden: true },
        { id: 'C1', type: 'counter', items: ['rose', 'perfume'], x: 670, y: 430 },
        { id: 'M1', type: 'proc', in: 'rose', out: 'perfume', ratio: 6, time: 0.5, x: 640, y: 220, outTo: 'C1' },
      ],
      tiles: [
        { id: 'a', x: 440, y: 540, price: 50, icon: 'cap', label: '大花篮', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 430, y: 150, price: 150, icon: 'worker', label: '雇园丁', req: ['a'], effect: { worker: { from: ['R1'], to: ['M1'] } } },
        { id: 'c', x: 400, y: 440, price: 110, icon: 'plot', label: '种玫瑰', req: ['a'], effect: { show: ['R2'] } },
        { id: 'd', x: 460, y: 640, price: 220, icon: 'worker', label: '雇园丁', req: ['c'], effect: { worker: { from: ['R2'], to: ['M1'] } } },
        { id: 'e', x: 740, y: 100, price: 260, icon: 'gear', label: '快机器', req: ['b'], effect: { proc: [{ id: 'M1', mul: 0.6 }] } },
        { id: 'f', x: 560, y: 640, price: 260, icon: 'cashier', label: '收银员', req: ['d'], effect: { cashier: ['C1'] } },
      ],
      deco: { theme: 'garden', paths: [[410, 360, 430, 100], [520, 200, 80, 170]], hedges: [[740, 580, 90, 22]], trees: [[800, 680, 'cone'], [800, 300, 'round']], bushes: [[420, 40], [780, 40]] } },

    // 13 — wheat and tomatoes, then a ketchup line
    { name: '麦田番茄', W: 920, H: 780, start: [520, 440], par: 200, bill: 20,
      goal: { type: 'earn', n: 3600 },
      objects: [
        { id: 'F1', type: 'field', crop: 'wheat', x: 40, y: 40, w: 300, h: 300, gap: 9 },
        { id: 'T1', type: 'coop', item: 'tomato', producer: 'bush', x: 70, y: 430, w: 280, h: 300, n: 8, max: 18, prefill: 900 },
        { id: 'M1', type: 'proc', in: 'tomato', out: 'ketchup', ratio: 5, time: 0.5, x: 740, y: 260, outTo: 'C1', hidden: true },
        { id: 'C1', type: 'counter', items: ['wheat', 'tomato', 'ketchup'], x: 750, y: 480 },
      ],
      tiles: [
        { id: 'a', x: 460, y: 540, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 740, y: 260, price: 200, icon: 'ketchup', label: '番茄酱机', req: ['a'], effect: { show: ['M1'] } },
        { id: 'c', x: 440, y: 150, price: 160, icon: 'worker', label: '雇园丁', req: ['a'], effect: { worker: { from: ['F1'], to: ['C1'] } } },
        { id: 'd', x: 440, y: 640, price: 260, icon: 'cart', label: '雇小车', req: ['b'], effect: { worker: { from: ['T1'], to: ['M1'] } } },
        { id: 'e', x: 540, y: 720, price: 360, icon: 'bush', label: '种番茄', buy: 4, req: ['b'], repeat: { times: 2, mul: 1.6 }, effect: { hens: { coop: 'T1', n: 4 } } },
        { id: 'f', x: 560, y: 140, price: 300, icon: 'mower', label: '割草机', req: ['c'], effect: { vehicle: true } },
      ],
      deco: { theme: 'farm', paths: [[380, 380, 540, 100], [640, 140, 80, 260]], hedges: [[820, 680, 90, 22]], trees: [[880, 740, 'round'], [860, 60, 'round']], bushes: [[700, 40], [880, 300]], barn: [420, 300] } },

    // 14 — three flowers, two machines
    { name: '三色花园', W: 920, H: 780, start: [520, 430], par: 250, bill: 20,
      goal: { type: 'earn', n: 3600 },
      objects: [
        { id: 'F1', type: 'field', crop: 'tulip', x: 40, y: 40, w: 270, h: 230, gap: 8 },
        { id: 'R1', type: 'field', crop: 'rose', x: 350, y: 40, w: 250, h: 200, gap: 9 },
        { id: 'G1', type: 'field', crop: 'gold', x: 40, y: 310, w: 290, h: 430, gap: 9 },
        { id: 'C1', type: 'counter', items: ['tulip', 'rose', 'gold', 'bouquet', 'basket'], x: 750, y: 470 },
        { id: 'M1', type: 'proc', in: 'gold', out: 'bouquet', ratio: 5, time: 0.45, x: 560, y: 650, outTo: 'C1', hidden: true },
        { id: 'M2', type: 'proc', in: 'tulip', out: 'basket', ratio: 6, time: 0.45, x: 740, y: 260, outTo: 'C1', hidden: true },
      ],
      tiles: [
        { id: 'a', x: 460, y: 520, price: 50, icon: 'cap', label: '大花篮', effect: { up: { key: 'cap', v: 50 } } },
        { id: 'b', x: 560, y: 650, price: 180, icon: 'bouquet', label: '花束机', req: ['a'], effect: { show: ['M1'] } },
        { id: 'c', x: 740, y: 260, price: 240, icon: 'basket', label: '花篮机', req: ['a'], effect: { show: ['M2'] } },
        { id: 'd', x: 400, y: 600, price: 200, icon: 'worker', label: '雇园丁', req: ['b'], effect: { worker: { from: ['G1'], to: ['M1'] } } },
        { id: 'e', x: 560, y: 300, price: 240, icon: 'worker', label: '雇园丁', req: ['c'], effect: { worker: { from: ['F1'], to: ['M2'] } } },
        { id: 'f', x: 400, y: 700, price: 300, icon: 'mower', label: '割草机', req: ['d'], effect: { vehicle: true } },
        { id: 'g', x: 660, y: 120, price: 280, icon: 'worker', label: '雇园丁', req: ['e'], effect: { worker: { from: ['R1'], to: ['C1'] } } },
      ],
      deco: { theme: 'garden', paths: [[360, 380, 560, 100], [640, 120, 80, 260]], hedges: [[820, 640, 90, 22]], trees: [[880, 740, 'cone'], [860, 60, 'round']], bushes: [[640, 40], [880, 300]] } },

    // 15 — the big estate: eggs, tomatoes, golden flowers, three machines
    { name: '青青大庄园', W: 1000, H: 860, start: [560, 520], par: 250, bill: 50,
      goal: { type: 'earn', n: 4300 },
      objects: [
        { id: 'K1', type: 'coop', item: 'egg', producer: 'hen', x: 70, y: 70, w: 260, h: 220, n: 8, max: 16, prefill: 1200 },
        { id: 'T1', type: 'coop', item: 'tomato', producer: 'bush', x: 460, y: 70, w: 230, h: 220, n: 8, max: 14, prefill: 900 },
        { id: 'G1', type: 'field', crop: 'gold', x: 40, y: 360, w: 320, h: 460, gap: 9 },
        { id: 'C1', type: 'counter', items: ['gold', 'crate', 'ketchup', 'bouquet'], x: 830, y: 540 },
        { id: 'M1', type: 'proc', in: 'egg', out: 'crate', ratio: 6, time: 0.4, x: 820, y: 300, outTo: 'C1' },
        { id: 'M2', type: 'proc', in: 'tomato', out: 'ketchup', ratio: 5, time: 0.45, x: 640, y: 740, outTo: 'C1', hidden: true },
        { id: 'M3', type: 'proc', in: 'gold', out: 'bouquet', ratio: 5, time: 0.45, x: 470, y: 440, outTo: 'C1', hidden: true },
      ],
      tiles: [
        { id: 'a', x: 560, y: 610, price: 60, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 60 } } },
        { id: 'b', x: 720, y: 160, price: 260, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
        { id: 'c', x: 640, y: 740, price: 300, icon: 'ketchup', label: '番茄酱机', req: ['a'], effect: { show: ['M2'] } },
        { id: 'd', x: 470, y: 440, price: 280, icon: 'bouquet', label: '花束机', req: ['a'], effect: { show: ['M3'] } },
        { id: 'e', x: 480, y: 800, price: 340, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['T1'], to: ['M2'] } } },
        { id: 'f', x: 470, y: 540, price: 320, icon: 'worker', label: '雇园丁', req: ['d'], effect: { worker: { from: ['G1'], to: ['M3'] } } },
        { id: 'g', x: 740, y: 800, price: 420, icon: 'mower', label: '割草机', req: ['e'], effect: { vehicle: true } },
        { id: 'h', x: 930, y: 730, price: 450, icon: 'cashier', label: '收银员', req: ['f'], effect: { cashier: ['C1'] } },
      ],
      deco: { theme: 'farm', paths: [[420, 470, 580, 100], [700, 200, 80, 270]], hedges: [[220, 826, 120, 22]], trees: [[960, 820, 'round'], [960, 360, 'round']], bushes: [[700, 40], [960, 40]], barn: [880, 140] } },
  ],

  // ---- meta: restore the farm & manor garden with stars ------------------------------
  meta: [
    { id: 'gate',     name: '修铁门',   cost: 1 },
    { id: 'path',     name: '铺石子路', cost: 2 },
    { id: 'hedge',    name: '修树篱',   cost: 2 },
    { id: 'well',     name: '修水井',   cost: 2 },
    { id: 'fountain', name: '修喷泉',   cost: 3 },
    { id: 'bench',    name: '摆长椅',   cost: 2 },
    { id: 'arch',     name: '玫瑰拱门', cost: 3 },
    { id: 'tree',     name: '樱花树',   cost: 3 },
    { id: 'pond',     name: '睡莲池',   cost: 3 },
    { id: 'gazebo',   name: '白凉亭',   cost: 4 },
    { id: 'barn',     name: '红谷仓',   cost: 4 },
    { id: 'windmill', name: '大风车',   cost: 4 },
    { id: 'greenhouse', name: '玻璃温室', cost: 4 },
    { id: 'manor',    name: '粉刷洋房', cost: 4 },
  ],

};

export function goalText(g) {
  const it = g.item ? CFG.items[g.item] : null;
  switch (g.type) {
    case 'earn': return `赚到 ${g.n} 元`;
    case 'collect': return `收集 ${g.n} ${it.unit}${it.name}`;
    case 'unlock': return `解锁 ${g.n} 个格子`;
    case 'produce': return `做出 ${g.n} ${it.unit}${it.name}`;
    case 'sell': return `卖出 ${g.n} ${it.unit}${it.name}`;
    default: return '';
  }
}
