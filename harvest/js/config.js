// 半亩·丰收 — every tunable number lives here.
// World units: the ground plane, x to the east (screen right-down), y to the south (screen left-down).
// The camera looks down from the south-east (see render3d.js), so screen-right is +x −y.

export const CFG = {
  version: 4,
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

  // caps: a full load is one satisfying swath. When the stack is full you STOP cutting (plants stay standing)
  // and the guide arrow sends you to the counter / machine. capUp multiplies every 大背篓 tile's +v.
  player: { speed: 135, pickR: 30, harvestR: 34, cutRate: 80, cap: 100, capUp: 2, pickRate: 50, dropRate: 70, cashR: 40,
            payTime: 1.3, payMin: 25, body: 10 },
  vehicle: { speed: 180, pickR: 56, harvestR: 58, cutRate: 220, cap: 300, pickRate: 150, dropRate: 160, capMul: 4 },
  worker: { speed: 92, pickR: 28, harvestR: 26, cutRate: 26, cap: 50, pickRate: 30, dropRate: 40 },
  // 园丁换铲车: gardeners ride small loaders (bigger swath, faster, much bigger load on the rear bed)
  loader: { speed: 122, pickR: 40, harvestR: 42, cap: 150, pickRate: 60, dropRate: 90, body: 14 },
  // 园丁成长: Lv1→Lv5, one level every `per` delivery trips; each level +speed% and +cap%
  workerLv: { per: 3, max: 5, speed: 0.08, cap: 0.10 },
  // 金色作物: ~1 in 150 field plants sparkles gold; cutting one pays mul × the crop price straight away
  golden: { chance: 1 / 150, mul: 10 },
  // 丰收狂热: every plant cut / item picked fills the meter; full → `dur` s of fever. Carrying a load freezes the
  // meter; empty-handed and not cutting for `grace` s drains it at `drain`/s. Fever never lifts the stack cap.
  fever: { perItem: 1 / 260, grace: 1.5, drain: 0.45, dur: 6, speedMul: 1.4, radiusMul: 1.4 },
  // VIP 顾客: crown, thought bubble, pays `mul` × and showers coins
  vip: { chance: 0.1, mul: 2 },
  sprinkler: { growMul: 2 },

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
    // v3.3 — levels 16–30: forest, dairy, orchards, berries, sheep, bees
    log:      { name: '木头',   unit: '根', price: 2,  step: 5.0 },
    plank:    { name: '木板',   unit: '块', price: 12, step: 3.6 },
    chair:    { name: '木椅',   unit: '把', price: 40, step: 9.5 },
    milk:     { name: '牛奶',   unit: '瓶', price: 2,  step: 7.0 },
    cheese:   { name: '奶酪',   unit: '块', price: 15, step: 6.0 },
    icecream: { name: '冰淇淋', unit: '个', price: 16, step: 8.5 },
    corn:     { name: '玉米',   unit: '根', price: 1,  step: 4.2 },
    popcorn:  { name: '爆米花', unit: '桶', price: 9,  step: 8.5 },
    pumpkin:  { name: '南瓜',   unit: '个', price: 4,  step: 7.0 },
    pie:      { name: '南瓜派', unit: '个', price: 20, step: 4.6 },
    berry:    { name: '草莓',   unit: '颗', price: 2,  step: 3.8 },
    jam:      { name: '果酱',   unit: '罐', price: 13, step: 7.0 },
    wool:     { name: '羊毛',   unit: '团', price: 2,  step: 6.0 },
    yarn:     { name: '毛线',   unit: '卷', price: 13, step: 6.0 },
    honey:    { name: '蜂蜜',   unit: '罐', price: 3,  step: 6.6 },
    apple:    { name: '苹果',   unit: '个', price: 2,  step: 5.4 },
    juice:    { name: '苹果汁', unit: '瓶', price: 13, step: 8.5 },
  },

  pile: { cell: 10, layer: 4.4, slope: 3, cap: 3800 },
  crops: {
    wheat:  { grow: 7.0 },
    tulip:  { grow: 9.0 },
    gold:   { grow: 8.0 },
    rose:   { grow: 10.0 },
    potato: { grow: 7.0, spill: 5 },
    // trees are a 'field' of big plants: walk into them to chop (each tree drops `yield` logs), stumps regrow
    log:     { grow: 11.0, yield: 3 },
    corn:    { grow: 7.0 },
    pumpkin: { grow: 9.0 },
    berry:   { grow: 8.0 },
  },
  // gap: spacing of the stalls along the fences (cows / sheep / hives / apple trees are bigger than hens)
  producers: { hen: { period: 1.25, burst: 3 }, bush: { period: 1.5, burst: 2 },
               cow: { period: 1.6, burst: 3, gap: 50 }, sheep: { period: 1.5, burst: 2, gap: 44 },
               hive: { period: 1.3, burst: 2, gap: 40 }, appletree: { period: 1.7, burst: 3, gap: 54 } },
  // checkout desk: long along y. Player unloads on the -x side, customers queue on the +x side toward the east gate.
  counter: { deskW: 30, deskD: 64, deskH: 20, zoneDx: -2, zoneDy: 62, zoneW: 50, zoneH: 44, serveDx: 34, queueGap: 22,
             cashDx: -58, cashDy: 62, stockMax: 300 },
  proc: { bodyW: 56, bodyD: 46, bodyH: 34, zoneDx: -52, zoneW: 42, zoneH: 46, chainMax: 60 },
  customer: { speed: 120, interval: 0.8, buyMin: 4, buyMax: 12, serveRate: 14, queue: 5, patience: 1.0 },
  tile: { size: 42 },
  fly: { pick: 0.30, drop: 0.24, lay: 0.5, harvest: 0.42, serve: 0.22, produce: 0.5 },
  stars: { twoMul: 1.6 },

  // ---- levels ---------------------------------------------------------------
  // objects: field | coop | counter | proc ; hidden:true = appears from a tile (a hidden field shows as a bare soil plot).
  // tiles: effect = show:[ids] | hens:{coop,n} | up:{key,v} | worker:{from:[ids],to:[ids]} | vehicle | cashier:[ids] | proc:[{id,mul}]
  //                | upgradeWorkers:'loader' (every gardener in the level, also later hires) | sprinkler:[field ids] (regrow ×2)
  // deco: paths [x,y,w,h] (flat), hedges [x,y,w,h] (solid), trees [x,y,'round'|'cone'] (solid), bushes [x,y]
  levels: [
    // 1 — tutorial: walk through the wheat, stack it, sell it, open a new field, hire a farmhand
    { name: '金色麦田', W: 720, H: 600, start: [410, 300], par: 140, bill: 5, tutorial: true,
      goal: { type: 'earn', n: 1400 },
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
        { id: 'g', x: 450, y: 200, price: 340, icon: 'loader', label: '园丁换铲车', req: ['b'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 640, y: 210, price: 260, icon: 'cashier', label: '店员', req: ['b'], effect: { cashier: ['C1'] } },
      ],
      deco: { theme: 'farm', paths: [[330, 250, 390, 100], [430, 350, 100, 250]], hedges: [[620, 470, 90, 22]], trees: [[680, 430, 'round'], [660, 40, 'round']], bushes: [[350, 40], [700, 560], [600, 560]], barn: [640, 120] } },

    // 2 — first flowers: dense tulip beds
    { name: '郁金香花田', W: 760, H: 620, start: [430, 320], par: 190, bill: 5,
      goal: { type: 'earn', n: 2000 },
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
        { id: 'g', x: 480, y: 200, price: 160, icon: 'loader', label: '园丁换铲车', req: ['c'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 680, y: 200, price: 200, icon: 'cashier', label: '店员', req: ['c'], effect: { cashier: ['C1'] } },
        { id: 'i', x: 370, y: 270, price: 150, icon: 'sprinkler', label: '洒水器', req: ['b'], effect: { sprinkler: ['F1', 'F2'] } },
      ],
      deco: { theme: 'garden', paths: [[350, 270, 410, 100], [470, 370, 90, 250]], hedges: [[660, 480, 90, 22]], trees: [[720, 580, 'cone'], [700, 60, 'round']], bushes: [[600, 40], [720, 200], [640, 580]] } },

    // 3 — the egg mountain
    { name: '鸡蛋堆', W: 760, H: 660, start: [430, 400], par: 200, bill: 5,
      goal: { type: 'collect', item: 'egg', n: 4350 },
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
        { id: 'g', x: 460, y: 310, price: 50, icon: 'cart', label: '鸡蛋搬运工', req: ['a'], repeat: { times: 2, mul: 2.2 }, effect: { worker: { from: ['K1'], to: ['C1', 'C2'] } } },
        { id: 'h', x: 700, y: 250, price: 70, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1', 'C2'] } },
      ],
      deco: { theme: 'farm', paths: [[420, 330, 340, 100]], hedges: [[40, 600, 160, 22]], trees: [[60, 450, 'round'], [720, 40, 'round']], bushes: [[200, 470], [720, 620]], barn: [640, 120] } },

    // 4 — potatoes spill out of the ground; the ride-on mower arrives
    { name: '土豆地', W: 780, H: 720, start: [440, 460], par: 160, bill: 10,
      goal: { type: 'collect', item: 'potato', n: 4600 },
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
        { id: 'f', x: 480, y: 260, price: 160, icon: 'cashier', label: '店员', req: ['b'], effect: { cashier: ['C1', 'C2'] } },
      ],
      deco: { theme: 'farm', paths: [[440, 390, 340, 100]], hedges: [[40, 660, 200, 22]], trees: [[740, 40, 'round'], [60, 480, 'round']], bushes: [[200, 520], [740, 680]], barn: [640, 160] } },

    // 5 — a sea of golden flowers, and the first machine: bouquets
    { name: '金盏花海', W: 800, H: 660, start: [450, 360], par: 160, bill: 10,
      goal: { type: 'produce', item: 'bouquet', n: 200 },
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
        { id: 'g', x: 500, y: 250, price: 270, icon: 'loader', label: '园丁换铲车', req: ['c'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 720, y: 250, price: 220, icon: 'cashier', label: '店员', req: ['b'], effect: { cashier: ['C1'] } },
        { id: 'i', x: 390, y: 250, price: 160, icon: 'sprinkler', label: '洒水器', req: ['b'], effect: { sprinkler: ['F1', 'G1'] } },
      ],
      deco: { theme: 'garden', paths: [[380, 300, 420, 90], [470, 140, 90, 200]], hedges: [[700, 520, 90, 22], [700, 40, 22, 90]], trees: [[760, 600, 'cone'], [380, 40, 'round']], bushes: [[700, 600], [740, 160]] } },

    // 6 — tomato bushes drop fruit into the yard; carts and a cashier
    { name: '番茄园', W: 760, H: 660, start: [430, 400], par: 160, bill: 10,
      goal: { type: 'earn', n: 3300 },
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
        { id: 'f', x: 460, y: 210, price: 300, icon: 'cashier', label: '店员', req: ['d'], effect: { cashier: ['C1', 'C2'] } },
      ],
      deco: { theme: 'farm', paths: [[420, 330, 340, 100]], hedges: [[40, 600, 180, 22]], trees: [[60, 450, 'round'], [720, 40, 'round']], bushes: [[200, 470], [720, 620]] } },

    // 7 — eggs into crates
    { name: '蛋箱工坊', W: 780, H: 680, start: [440, 420], par: 160, bill: 10,
      goal: { type: 'produce', item: 'crate', n: 310 },
      objects: [
        { id: 'K1', type: 'coop', item: 'egg', producer: 'hen', x: 70, y: 70, w: 330, h: 270, n: 6, max: 20, prefill: 1200 },
        { id: 'M1', type: 'proc', in: 'egg', out: 'crate', ratio: 6, time: 0.45, x: 620, y: 200, outTo: 'C1' },
        { id: 'C1', type: 'counter', items: ['crate'], x: 630, y: 420 },
      ],
      tiles: [
        { id: 'a', x: 440, y: 540, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 460, y: 90, price: 80, icon: 'hen', label: '买鸡', buy: 4, req: ['a'], repeat: { times: 3, mul: 1.6 }, effect: { hens: { coop: 'K1', n: 4 } } },
        { id: 'c', x: 300, y: 440, price: 100, icon: 'cart', label: '鸡蛋搬运工', req: ['a'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
        { id: 'd', x: 720, y: 90, price: 200, icon: 'gear', label: '快机器', req: ['c'], effect: { proc: [{ id: 'M1', mul: 0.6 }] } },
        { id: 'e', x: 300, y: 550, price: 260, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
        { id: 'g', x: 480, y: 240, price: 200, icon: 'cashier', label: '店员', req: ['c'], effect: { cashier: ['C1'] } },
      ],
      deco: { theme: 'farm', paths: [[420, 360, 360, 100], [510, 180, 80, 180]], hedges: [[40, 620, 180, 22]], trees: [[60, 470, 'round'], [740, 640, 'round']], bushes: [[200, 480], [740, 300]] } },

    // 8 — rose beds behind the stone walls
    { name: '玫瑰园', W: 780, H: 640, start: [430, 330], par: 150, bill: 10,
      goal: { type: 'sell', item: 'rose', n: 1050 },
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
        { id: 'f', x: 640, y: 210, price: 240, icon: 'cashier', label: '店员', req: ['c'], effect: { cashier: ['C1'] } },
        { id: 'g', x: 480, y: 470, price: 220, icon: 'loader', label: '园丁换铲车', req: ['c'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 560, y: 250, price: 140, icon: 'sprinkler', label: '洒水器', req: ['b'], effect: { sprinkler: ['R1', 'R2'] } },
      ],
      deco: { theme: 'garden', paths: [[360, 290, 420, 100]], hedges: [[600, 40, 160, 22], [690, 500, 22, 100]], trees: [[740, 600, 'cone'], [740, 130, 'round']], bushes: [[560, 120], [740, 470]] } },

    // 9 — tomatoes into ketchup
    { name: '番茄酱', W: 780, H: 680, start: [440, 420], par: 140, bill: 10,
      goal: { type: 'sell', item: 'ketchup', n: 190 },
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
        { id: 'e', x: 720, y: 600, price: 200, icon: 'cashier', label: '店员', req: ['b'], effect: { cashier: ['C1'] } },
      ],
      deco: { theme: 'farm', paths: [[420, 360, 360, 100], [510, 180, 80, 180]], hedges: [[40, 620, 180, 22]], trees: [[60, 470, 'round'], [740, 60, 'round']], bushes: [[200, 480], [560, 640]], barn: [700, 300] } },

    // 10 — tulips into flower baskets
    { name: '花篮工坊', W: 820, H: 700, start: [460, 380], par: 160, bill: 10,
      goal: { type: 'produce', item: 'basket', n: 370 },
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
        { id: 'g', x: 440, y: 250, price: 240, icon: 'loader', label: '园丁换铲车', req: ['b'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 760, y: 300, price: 220, icon: 'cashier', label: '店员', req: ['b'], effect: { cashier: ['C1'] } },
        { id: 'i', x: 380, y: 410, price: 160, icon: 'sprinkler', label: '洒水器', req: ['a'], effect: { sprinkler: ['F1', 'G1'] } },
      ],
      deco: { theme: 'garden', paths: [[400, 340, 420, 100], [500, 180, 90, 160]], hedges: [[720, 560, 90, 22]], trees: [[780, 650, 'cone'], [780, 260, 'round']], bushes: [[380, 680], [760, 40]] } },

    // 11 — two stands at once: eggs and potatoes
    { name: '鸡蛋土豆', W: 900, H: 780, start: [520, 420], par: 220, bill: 10,
      goal: { type: 'earn', n: 3650 },
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
        { id: 'e', x: 440, y: 200, price: 90, icon: 'cart', label: '鸡蛋搬运工', req: ['a'], effect: { worker: { from: ['K1'], to: ['C1'] } } },
        { id: 'f', x: 600, y: 680, price: 100, icon: 'speed', label: '跑鞋', req: ['d'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'g', x: 600, y: 300, price: 160, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1', 'C2'] } },
      ],
      deco: { theme: 'farm', paths: [[470, 380, 430, 100], [540, 140, 80, 260]], hedges: [[820, 700, 70, 22]], trees: [[860, 60, 'round'], [860, 740, 'round']], bushes: [[600, 40], [440, 740]], barn: [680, 120] } },

    // 12 — roses into perfume
    { name: '玫瑰香水', W: 840, H: 720, start: [470, 400], par: 150, bill: 20,
      goal: { type: 'produce', item: 'perfume', n: 350 },
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
        { id: 'f', x: 560, y: 640, price: 260, icon: 'cashier', label: '店员', req: ['d'], effect: { cashier: ['C1'] } },
        { id: 'g', x: 480, y: 280, price: 270, icon: 'loader', label: '园丁换铲车', req: ['b'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 530, y: 520, price: 170, icon: 'sprinkler', label: '洒水器', req: ['c'], effect: { sprinkler: ['R1', 'R2'] } },
      ],
      deco: { theme: 'garden', paths: [[410, 360, 430, 100], [520, 200, 80, 170]], hedges: [[740, 580, 90, 22]], trees: [[800, 680, 'cone'], [800, 300, 'round']], bushes: [[420, 40], [780, 40]] } },

    // 13 — wheat and tomatoes, then a ketchup line
    { name: '麦田番茄', W: 920, H: 780, start: [520, 440], par: 200, bill: 20,
      goal: { type: 'earn', n: 5100 },
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
        { id: 'g', x: 560, y: 250, price: 290, icon: 'loader', label: '园丁换铲车', req: ['c'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 860, y: 380, price: 240, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1'] } },
      ],
      deco: { theme: 'farm', paths: [[380, 380, 540, 100], [640, 140, 80, 260]], hedges: [[820, 680, 90, 22]], trees: [[880, 740, 'round'], [860, 60, 'round']], bushes: [[700, 40], [880, 300]], barn: [420, 300] } },

    // 14 — three flowers, two machines
    { name: '三色花园', W: 920, H: 780, start: [520, 430], par: 210, bill: 20,
      goal: { type: 'earn', n: 6150 },
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
        { id: 'h', x: 470, y: 420, price: 360, icon: 'loader', label: '园丁换铲车', req: ['d'], effect: { upgradeWorkers: 'loader' } },
        { id: 'i', x: 850, y: 360, price: 260, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1'] } },
        { id: 'j', x: 630, y: 320, price: 200, icon: 'sprinkler', label: '洒水器', req: ['a'], effect: { sprinkler: ['F1', 'R1', 'G1'] } },
      ],
      deco: { theme: 'garden', paths: [[360, 380, 560, 100], [640, 120, 80, 260]], hedges: [[820, 640, 90, 22]], trees: [[880, 740, 'cone'], [860, 60, 'round']], bushes: [[640, 40], [880, 300]] } },

    // 15 — the big estate: eggs, tomatoes, golden flowers, three machines
    { name: '青青大庄园', W: 1000, H: 860, start: [560, 520], par: 240, bill: 50,
      goal: { type: 'earn', n: 7650 },
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
        { id: 'b', x: 720, y: 160, price: 180, icon: 'cart', label: '鸡蛋搬运工', req: ['a'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
        { id: 'c', x: 640, y: 740, price: 300, icon: 'ketchup', label: '番茄酱机', req: ['a'], effect: { show: ['M2'] } },
        { id: 'd', x: 470, y: 440, price: 280, icon: 'bouquet', label: '花束机', req: ['a'], effect: { show: ['M3'] } },
        { id: 'e', x: 480, y: 800, price: 340, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['T1'], to: ['M2'] } } },
        { id: 'f', x: 470, y: 540, price: 320, icon: 'worker', label: '雇园丁', req: ['d'], effect: { worker: { from: ['G1'], to: ['M3'] } } },
        { id: 'g', x: 740, y: 800, price: 420, icon: 'mower', label: '割草机', req: ['e'], effect: { vehicle: true } },
        { id: 'h', x: 930, y: 730, price: 450, icon: 'cashier', label: '店员', req: ['f'], effect: { cashier: ['C1'] } },
        { id: 'i', x: 640, y: 470, price: 520, icon: 'loader', label: '园丁换铲车', req: ['f'], effect: { upgradeWorkers: 'loader' } },
      ],
      deco: { theme: 'farm', paths: [[420, 470, 580, 100], [700, 200, 80, 270]], hedges: [[220, 826, 120, 22]], trees: [[960, 820, 'round'], [960, 360, 'round']], bushes: [[700, 40], [960, 40]], barn: [880, 140] } },

    // ======================= v3.3: levels 16–30 =======================
    // 16 — into the woods: walk into the trees to chop them, logs stack on your back, stumps regrow
    { name: '林间伐木', W: 800, H: 660, start: [450, 330], par: 150, bill: 10,
      goal: { type: 'earn', n: 2150 },
      objects: [
        { id: 'T1', type: 'field', crop: 'log', x: 40, y: 40, w: 300, h: 250, gap: 30 },
        { id: 'T2', type: 'field', crop: 'log', x: 40, y: 340, w: 300, h: 280, gap: 30, hidden: true },
        { id: 'C1', type: 'counter', items: ['log'], x: 630, y: 330 },
      ],
      tiles: [
        { id: 'a', x: 400, y: 470, price: 30, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 30 } } },
        { id: 'b', x: 390, y: 380, price: 70, icon: 'plot', label: '开林地', req: ['a'], effect: { show: ['T2'] } },
        { id: 'c', x: 460, y: 580, price: 120, icon: 'lumber', label: '雇伐木工', req: ['a'], effect: { worker: { from: ['T1', 'T2'], to: ['C1'] } } },
        { id: 'd', x: 410, y: 150, price: 100, icon: 'speed', label: '跑鞋', req: ['b'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'e', x: 540, y: 590, price: 200, icon: 'lumber', label: '雇伐木工', req: ['c'], effect: { worker: { from: ['T1', 'T2'], to: ['C1'] } } },
        { id: 'f', x: 500, y: 80, price: 150, icon: 'axe', label: '大斧头', req: ['d'], effect: { up: { key: 'radius', v: 6 } } },
        { id: 'g', x: 500, y: 210, price: 260, icon: 'truck', label: '换运木车', req: ['c'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 700, y: 200, price: 220, icon: 'cashier', label: '店员', req: ['c'], effect: { cashier: ['C1'] } },
        { id: 'i', x: 400, y: 270, price: 150, icon: 'sprinkler', label: '育林水', req: ['b'], effect: { sprinkler: ['T1', 'T2'] } },
      ],
      deco: { theme: 'farm', paths: [[360, 290, 440, 90], [440, 370, 90, 260]], hedges: [[640, 560, 140, 22]], trees: [[760, 600, 'cone'], [760, 60, 'cone']], bushes: [[620, 40], [760, 470]] } },

    // 17 — the sawmill: logs in, planks out
    { name: '锯木厂', W: 820, H: 680, start: [460, 400], par: 150, bill: 10,
      goal: { type: 'produce', item: 'plank', n: 270 },
      objects: [
        { id: 'T1', type: 'field', crop: 'log', x: 40, y: 40, w: 320, h: 300, gap: 30 },
        { id: 'T2', type: 'field', crop: 'log', x: 40, y: 390, w: 300, h: 250, gap: 30, hidden: true },
        { id: 'M1', type: 'proc', in: 'log', out: 'plank', ratio: 5, time: 0.5, x: 640, y: 200, outTo: 'C1' },
        { id: 'C1', type: 'counter', items: ['log', 'plank'], x: 650, y: 420 },
      ],
      tiles: [
        { id: 'a', x: 440, y: 540, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 420, y: 150, price: 140, icon: 'lumber', label: '雇伐木工', req: ['a'], effect: { worker: { from: ['T1'], to: ['M1'] } } },
        { id: 'c', x: 400, y: 450, price: 90, icon: 'plot', label: '开林地', req: ['a'], effect: { show: ['T2'] } },
        { id: 'd', x: 460, y: 640, price: 220, icon: 'lumber', label: '雇伐木工', req: ['c'], effect: { worker: { from: ['T2'], to: ['M1'] } } },
        { id: 'e', x: 740, y: 90, price: 220, icon: 'saw', label: '快锯片', req: ['b'], effect: { proc: [{ id: 'M1', mul: 0.6 }] } },
        { id: 'f', x: 560, y: 640, price: 240, icon: 'cashier', label: '店员', req: ['d'], effect: { cashier: ['C1'] } },
        { id: 'g', x: 480, y: 280, price: 260, icon: 'truck', label: '换运木车', req: ['b'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 530, y: 520, price: 170, icon: 'sprinkler', label: '育林水', req: ['c'], effect: { sprinkler: ['T1', 'T2'] } },
      ],
      deco: { theme: 'farm', paths: [[380, 350, 440, 100], [500, 180, 90, 170]], hedges: [[700, 560, 100, 22]], trees: [[780, 640, 'cone'], [780, 280, 'cone']], bushes: [[400, 40], [780, 40]] } },

    // 18 — dairy cows: milk bottles pile up in the pasture, carry them to the stand
    { name: '奶牛牧场', W: 780, H: 680, start: [440, 420], par: 170, bill: 10,
      goal: { type: 'collect', item: 'milk', n: 3050 },
      objects: [
        { id: 'K1', type: 'coop', item: 'milk', producer: 'cow', x: 80, y: 80, w: 330, h: 280, n: 3, max: 12, prefill: 900 },
        { id: 'C1', type: 'counter', items: ['milk'], x: 620, y: 400 },
        { id: 'C2', type: 'counter', items: ['milk'], x: 620, y: 560, hidden: true },
      ],
      tiles: [
        { id: 'a', x: 460, y: 530, price: 25, icon: 'cap', label: '大奶篮', effect: { up: { key: 'cap', v: 30 } } },
        { id: 'b', x: 470, y: 90, price: 110, icon: 'cow', label: '买奶牛', buy: 3, req: ['a'], repeat: { times: 4, mul: 1.5 }, effect: { hens: { coop: 'K1', n: 3 } } },
        { id: 'c', x: 620, y: 560, price: 90, icon: 'counter', label: '出售台', req: ['a'], effect: { show: ['C2'] } },
        { id: 'd', x: 300, y: 450, price: 80, icon: 'speed', label: '跑鞋', req: ['b'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'e', x: 300, y: 560, price: 130, icon: 'cap', label: '大奶篮', req: ['d'], effect: { up: { key: 'cap', v: 60 } } },
        { id: 'f', x: 470, y: 200, price: 160, icon: 'magnet', label: '大手', req: ['c'], effect: { up: { key: 'radius', v: 10 } } },
        { id: 'g', x: 470, y: 310, price: 60, icon: 'milker', label: '挤奶工', req: ['a'], repeat: { times: 2, mul: 2.2 }, effect: { worker: { from: ['K1'], to: ['C1', 'C2'] } } },
        { id: 'h', x: 710, y: 250, price: 80, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1', 'C2'] } },
      ],
      deco: { theme: 'farm', paths: [[420, 370, 360, 100]], hedges: [[40, 620, 160, 22]], trees: [[60, 460, 'round'], [740, 40, 'round']], bushes: [[200, 470], [740, 640]], barn: [640, 120] } },

    // 19 — milk into cheese
    { name: '奶酪工坊', W: 800, H: 680, start: [450, 420], par: 160, bill: 10,
      goal: { type: 'produce', item: 'cheese', n: 280 },
      objects: [
        { id: 'K1', type: 'coop', item: 'milk', producer: 'cow', x: 80, y: 80, w: 330, h: 270, n: 4, max: 12, prefill: 800 },
        { id: 'M1', type: 'proc', in: 'milk', out: 'cheese', ratio: 6, time: 0.45, x: 640, y: 200, outTo: 'C1' },
        { id: 'C1', type: 'counter', items: ['cheese'], x: 650, y: 420 },
      ],
      tiles: [
        { id: 'a', x: 450, y: 540, price: 40, icon: 'cap', label: '大奶篮', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 480, y: 90, price: 90, icon: 'cow', label: '买奶牛', buy: 3, req: ['a'], repeat: { times: 3, mul: 1.6 }, effect: { hens: { coop: 'K1', n: 3 } } },
        { id: 'c', x: 300, y: 450, price: 110, icon: 'milker', label: '挤奶工', req: ['a'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
        { id: 'd', x: 740, y: 90, price: 210, icon: 'gear', label: '快机器', req: ['c'], effect: { proc: [{ id: 'M1', mul: 0.6 }] } },
        { id: 'e', x: 300, y: 560, price: 260, icon: 'milker', label: '挤奶工', req: ['c'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
        { id: 'g', x: 490, y: 250, price: 210, icon: 'cashier', label: '店员', req: ['c'], effect: { cashier: ['C1'] } },
      ],
      deco: { theme: 'farm', paths: [[430, 360, 370, 100], [520, 180, 80, 180]], hedges: [[40, 620, 180, 22]], trees: [[60, 470, 'round'], [760, 640, 'round']], bushes: [[200, 480], [760, 300]] } },

    // 20 — a sea of corn, the mower, and a popcorn machine
    { name: '玉米地', W: 820, H: 700, start: [460, 400], par: 180, bill: 10,
      goal: { type: 'earn', n: 3000 },
      objects: [
        { id: 'F1', type: 'field', crop: 'corn', x: 40, y: 40, w: 320, h: 300, gap: 10 },
        { id: 'F2', type: 'field', crop: 'corn', x: 40, y: 390, w: 320, h: 270, gap: 10, hidden: true },
        { id: 'C1', type: 'counter', items: ['corn', 'popcorn'], x: 660, y: 420 },
        { id: 'M1', type: 'proc', in: 'corn', out: 'popcorn', ratio: 6, time: 0.45, x: 640, y: 200, outTo: 'C1', hidden: true },
      ],
      tiles: [
        { id: 'a', x: 430, y: 520, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 640, y: 200, price: 140, icon: 'popcorn', label: '爆米花机', req: ['a'], effect: { show: ['M1'] } },
        { id: 'c', x: 400, y: 440, price: 80, icon: 'plot', label: '开新田', req: ['a'], effect: { show: ['F2'] } },
        { id: 'd', x: 440, y: 620, price: 160, icon: 'worker', label: '雇园丁', req: ['b'], effect: { worker: { from: ['F1', 'F2'], to: ['M1'] } } },
        { id: 'e', x: 430, y: 130, price: 220, icon: 'mower', label: '割草机', req: ['b'], effect: { vehicle: true } },
        { id: 'f', x: 540, y: 630, price: 230, icon: 'worker', label: '雇园丁', req: ['d'], effect: { worker: { from: ['F1', 'F2'], to: ['M1'] } } },
        { id: 'g', x: 480, y: 250, price: 280, icon: 'loader', label: '园丁换铲车', req: ['d'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 760, y: 300, price: 220, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1'] } },
        { id: 'i', x: 520, y: 520, price: 160, icon: 'sprinkler', label: '洒水器', req: ['c'], effect: { sprinkler: ['F1', 'F2'] } },
      ],
      deco: { theme: 'farm', paths: [[380, 350, 440, 100], [500, 180, 90, 170]], hedges: [[720, 580, 90, 22]], trees: [[780, 660, 'round'], [780, 60, 'round']], bushes: [[380, 680], [560, 40]] } },

    // 21 — strawberry beds and jam
    { name: '草莓园', W: 800, H: 660, start: [450, 360], par: 170, bill: 10,
      goal: { type: 'produce', item: 'jam', n: 220 },
      objects: [
        { id: 'B1', type: 'field', crop: 'berry', x: 40, y: 40, w: 300, h: 270, gap: 9 },
        { id: 'B2', type: 'field', crop: 'berry', x: 40, y: 350, w: 300, h: 270, gap: 9, hidden: true },
        { id: 'M1', type: 'proc', in: 'berry', out: 'jam', ratio: 5, time: 0.5, x: 630, y: 180, outTo: 'C1', hidden: true },
        { id: 'C1', type: 'counter', items: ['berry', 'jam'], x: 640, y: 380 },
      ],
      tiles: [
        { id: 'a', x: 420, y: 480, price: 40, icon: 'cap', label: '大果篮', effect: { up: { key: 'cap', v: 30 } } },
        { id: 'b', x: 630, y: 180, price: 120, icon: 'jam', label: '果酱机', req: ['a'], effect: { show: ['M1'] } },
        { id: 'c', x: 380, y: 380, price: 70, icon: 'plot', label: '种草莓', req: ['a'], effect: { show: ['B2'] } },
        { id: 'd', x: 440, y: 590, price: 150, icon: 'worker', label: '雇园丁', req: ['b'], effect: { worker: { from: ['B1', 'B2'], to: ['M1'] } } },
        { id: 'e', x: 520, y: 600, price: 220, icon: 'worker', label: '雇园丁', req: ['d'], effect: { worker: { from: ['B1', 'B2'], to: ['M1'] } } },
        { id: 'f', x: 420, y: 140, price: 110, icon: 'speed', label: '跑鞋', req: ['b'], effect: { up: { key: 'speed', v: 25 } } },
        { id: 'g', x: 500, y: 260, price: 260, icon: 'loader', label: '园丁换铲车', req: ['d'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 730, y: 270, price: 210, icon: 'cashier', label: '店员', req: ['b'], effect: { cashier: ['C1'] } },
        { id: 'i', x: 520, y: 470, price: 150, icon: 'sprinkler', label: '洒水器', req: ['c'], effect: { sprinkler: ['B1', 'B2'] } },
      ],
      deco: { theme: 'garden', paths: [[360, 320, 440, 90], [460, 160, 90, 180]], hedges: [[700, 520, 90, 22]], trees: [[760, 610, 'cone'], [380, 40, 'round']], bushes: [[700, 610], [760, 160]] } },

    // 22 — fat orange pumpkins and a pie oven
    { name: '南瓜地', W: 840, H: 720, start: [470, 400], par: 180, bill: 20,
      goal: { type: 'earn', n: 5500 },
      objects: [
        { id: 'P1', type: 'field', crop: 'pumpkin', x: 40, y: 40, w: 330, h: 300, gap: 22 },
        { id: 'P2', type: 'field', crop: 'pumpkin', x: 40, y: 390, w: 330, h: 290, gap: 22, hidden: true },
        { id: 'M1', type: 'proc', in: 'pumpkin', out: 'pie', ratio: 4, time: 0.5, x: 660, y: 210, outTo: 'C1', hidden: true },
        { id: 'C1', type: 'counter', items: ['pumpkin', 'pie'], x: 670, y: 430 },
      ],
      tiles: [
        { id: 'a', x: 450, y: 540, price: 50, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 660, y: 210, price: 160, icon: 'pie', label: '南瓜派烤炉', req: ['a'], effect: { show: ['M1'] } },
        { id: 'c', x: 410, y: 450, price: 90, icon: 'plot', label: '种南瓜', req: ['a'], effect: { show: ['P2'] } },
        { id: 'd', x: 460, y: 650, price: 180, icon: 'worker', label: '雇园丁', req: ['b'], effect: { worker: { from: ['P1', 'P2'], to: ['M1'] } } },
        { id: 'e', x: 450, y: 130, price: 260, icon: 'mower', label: '割草机', req: ['b'], effect: { vehicle: true } },
        { id: 'f', x: 560, y: 660, price: 260, icon: 'worker', label: '雇园丁', req: ['d'], effect: { worker: { from: ['P1', 'P2'], to: ['M1'] } } },
        { id: 'g', x: 500, y: 270, price: 300, icon: 'loader', label: '园丁换铲车', req: ['d'], effect: { upgradeWorkers: 'loader' } },
        { id: 'h', x: 780, y: 310, price: 240, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1'] } },
        { id: 'i', x: 540, y: 540, price: 170, icon: 'sprinkler', label: '洒水器', req: ['c'], effect: { sprinkler: ['P1', 'P2'] } },
      ],
      deco: { theme: 'farm', paths: [[400, 360, 440, 100], [520, 190, 90, 170]], hedges: [[740, 600, 90, 22]], trees: [[800, 680, 'round'], [800, 60, 'round']], bushes: [[600, 40], [400, 700]], barn: [600, 100] } },

    // 23 — fluffy sheep, wool into yarn
    { name: '羊毛牧场', W: 800, H: 700, start: [450, 430], par: 160, bill: 20,
      goal: { type: 'sell', item: 'yarn', n: 290 },
      objects: [
        { id: 'S1', type: 'coop', item: 'wool', producer: 'sheep', x: 80, y: 80, w: 330, h: 280, n: 4, max: 14, prefill: 900 },
        { id: 'M1', type: 'proc', in: 'wool', out: 'yarn', ratio: 5, time: 0.45, x: 640, y: 210, outTo: 'C1' },
        { id: 'C1', type: 'counter', items: ['wool', 'yarn'], x: 650, y: 430 },
      ],
      tiles: [
        { id: 'a', x: 450, y: 550, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 480, y: 90, price: 90, icon: 'sheep', label: '买绵羊', buy: 3, req: ['a'], repeat: { times: 3, mul: 1.6 }, effect: { hens: { coop: 'S1', n: 3 } } },
        { id: 'c', x: 300, y: 460, price: 150, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['S1'], to: ['M1'] } } },
        { id: 'd', x: 300, y: 570, price: 240, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['S1'], to: ['M1'] } } },
        { id: 'e', x: 740, y: 100, price: 220, icon: 'gear', label: '快纺车', req: ['c'], effect: { proc: [{ id: 'M1', mul: 0.6 }] } },
        { id: 'f', x: 740, y: 620, price: 200, icon: 'cashier', label: '店员', req: ['b'], effect: { cashier: ['C1'] } },
      ],
      deco: { theme: 'farm', paths: [[430, 370, 370, 100], [520, 190, 80, 180]], hedges: [[40, 640, 180, 22]], trees: [[60, 480, 'round'], [760, 330, 'round']], bushes: [[200, 490], [560, 660]] } },

    // 24 — beehives beside the tulips: honey jars
    { name: '蜂蜜花田', W: 820, H: 700, start: [460, 420], par: 200, bill: 20,
      goal: { type: 'sell', item: 'honey', n: 950 },
      objects: [
        { id: 'H1', type: 'coop', item: 'honey', producer: 'hive', x: 80, y: 80, w: 300, h: 260, n: 4, max: 12, prefill: 700 },
        { id: 'F1', type: 'field', crop: 'tulip', x: 40, y: 420, w: 300, h: 240, gap: 8 },
        { id: 'C1', type: 'counter', items: ['honey', 'tulip'], x: 660, y: 300 },
        { id: 'C2', type: 'counter', items: ['honey'], x: 660, y: 520, hidden: true },
      ],
      tiles: [
        { id: 'a', x: 460, y: 560, price: 40, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 450, y: 90, price: 90, icon: 'hive', label: '添蜂箱', buy: 3, req: ['a'], repeat: { times: 3, mul: 1.6 }, effect: { hens: { coop: 'H1', n: 3 } } },
        { id: 'c', x: 660, y: 520, price: 100, icon: 'counter', label: '出售台', req: ['a'], effect: { show: ['C2'] } },
        { id: 'd', x: 440, y: 300, price: 140, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['H1'], to: ['C1', 'C2'] } } },
        { id: 'e', x: 430, y: 650, price: 160, icon: 'worker', label: '雇园丁', req: ['b'], effect: { worker: { from: ['F1'], to: ['C1'] } } },
        { id: 'f', x: 560, y: 180, price: 180, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1', 'C2'] } },
        { id: 'g', x: 540, y: 660, price: 120, icon: 'speed', label: '跑鞋', req: ['d'], effect: { up: { key: 'speed', v: 25 } } },
      ],
      deco: { theme: 'garden', paths: [[400, 250, 420, 100], [500, 350, 90, 270]], hedges: [[740, 640, 70, 22]], trees: [[780, 40, 'cone'], [380, 660, 'round']], bushes: [[600, 40], [780, 440]] } },

    // 25 — apple orchard: apples fall into the grass, a juice press
    { name: '苹果园', W: 820, H: 700, start: [460, 430], par: 170, bill: 20,
      goal: { type: 'produce', item: 'juice', n: 340 },
      objects: [
        { id: 'A1', type: 'coop', item: 'apple', producer: 'appletree', x: 80, y: 80, w: 340, h: 280, n: 4, max: 11, prefill: 800 },
        { id: 'M1', type: 'proc', in: 'apple', out: 'juice', ratio: 5, time: 0.5, x: 650, y: 210, outTo: 'C1' },
        { id: 'C1', type: 'counter', items: ['apple', 'juice'], x: 660, y: 440 },
      ],
      tiles: [
        { id: 'a', x: 460, y: 560, price: 40, icon: 'cap', label: '大果篮', effect: { up: { key: 'cap', v: 40 } } },
        { id: 'b', x: 490, y: 90, price: 100, icon: 'appletree', label: '种苹果树', buy: 2, req: ['a'], repeat: { times: 3, mul: 1.6 }, effect: { hens: { coop: 'A1', n: 2 } } },
        { id: 'c', x: 310, y: 470, price: 150, icon: 'cart', label: '雇小车', req: ['a'], effect: { worker: { from: ['A1'], to: ['M1'] } } },
        { id: 'd', x: 310, y: 580, price: 250, icon: 'cart', label: '雇小车', req: ['c'], effect: { worker: { from: ['A1'], to: ['M1'] } } },
        { id: 'e', x: 750, y: 100, price: 230, icon: 'gear', label: '快榨汁机', req: ['c'], effect: { proc: [{ id: 'M1', mul: 0.6 }] } },
        { id: 'f', x: 500, y: 250, price: 210, icon: 'cashier', label: '店员', req: ['b'], effect: { cashier: ['C1'] } },
      ],
      deco: { theme: 'farm', paths: [[440, 380, 380, 100], [530, 190, 80, 190]], hedges: [[40, 640, 180, 22]], trees: [[60, 490, 'round'], [780, 650, 'round']], bushes: [[200, 500], [780, 320]] } },

    // 26 — logs → planks → chairs: one machine feeds the next
    { name: '木椅工坊', W: 880, H: 740, start: [500, 420], par: 180, bill: 20,
      goal: { type: 'produce', item: 'chair', n: 130 },
      objects: [
        { id: 'T1', type: 'field', crop: 'log', x: 40, y: 40, w: 330, h: 300, gap: 30 },
        { id: 'T2', type: 'field', crop: 'log', x: 40, y: 390, w: 330, h: 300, gap: 30, hidden: true },
        { id: 'M1', type: 'proc', in: 'log', out: 'plank', ratio: 4, time: 0.45, x: 640, y: 160, outTo: 'M2' },
        { id: 'M2', type: 'proc', in: 'plank', out: 'chair', ratio: 3, time: 0.6, x: 760, y: 330, outTo: 'C1' },
        { id: 'C1', type: 'counter', items: ['log', 'chair'], x: 720, y: 520 },
      ],
      tiles: [
        { id: 'a', x: 460, y: 560, price: 50, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 50 } } },
        { id: 'b', x: 450, y: 150, price: 160, icon: 'lumber', label: '雇伐木工', req: ['a'], effect: { worker: { from: ['T1'], to: ['M1'] } } },
        { id: 'c', x: 420, y: 460, price: 100, icon: 'plot', label: '开林地', req: ['a'], effect: { show: ['T2'] } },
        { id: 'd', x: 480, y: 670, price: 240, icon: 'lumber', label: '雇伐木工', req: ['c'], effect: { worker: { from: ['T2'], to: ['M1'] } } },
        { id: 'e', x: 520, y: 280, price: 300, icon: 'truck', label: '换运木车', req: ['b'], effect: { upgradeWorkers: 'loader' } },
        { id: 'f', x: 840, y: 180, price: 260, icon: 'saw', label: '快锯片', req: ['b'], effect: { proc: [{ id: 'M1', mul: 0.6 }, { id: 'M2', mul: 0.6 }] } },
        { id: 'g', x: 600, y: 680, price: 260, icon: 'cashier', label: '店员', req: ['d'], effect: { cashier: ['C1'] } },
        { id: 'h', x: 560, y: 460, price: 180, icon: 'sprinkler', label: '育林水', req: ['c'], effect: { sprinkler: ['T1', 'T2'] } },
      ],
      deco: { theme: 'farm', paths: [[400, 360, 480, 100], [520, 130, 90, 230]], hedges: [[780, 660, 90, 22]], trees: [[840, 700, 'cone'], [840, 60, 'cone']], bushes: [[420, 40], [840, 440]] } },

    // 27 — cows and strawberries: ice cream and jam
    { name: '冰淇淋牧场', W: 920, H: 780, start: [520, 440], par: 200, bill: 20,
      goal: { type: 'earn', n: 8000 },
      objects: [
        { id: 'K1', type: 'coop', item: 'milk', producer: 'cow', x: 80, y: 80, w: 300, h: 250, n: 5, max: 11, prefill: 800 },
        { id: 'B1', type: 'field', crop: 'berry', x: 40, y: 420, w: 320, h: 310, gap: 9 },
        { id: 'M1', type: 'proc', in: 'milk', out: 'icecream', ratio: 6, time: 0.45, x: 760, y: 200, outTo: 'C1' },
        { id: 'M2', type: 'proc', in: 'berry', out: 'jam', ratio: 5, time: 0.5, x: 560, y: 680, outTo: 'C1', hidden: true },
        { id: 'C1', type: 'counter', items: ['berry', 'icecream', 'jam'], x: 770, y: 470 },
      ],
      tiles: [
        { id: 'a', x: 480, y: 560, price: 50, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 50 } } },
        { id: 'b', x: 560, y: 200, price: 180, icon: 'milker', label: '挤奶工', req: ['a'], effect: { worker: { from: ['K1'], to: ['M1'] } } },
        { id: 'c', x: 560, y: 680, price: 200, icon: 'jam', label: '果酱机', req: ['a'], effect: { show: ['M2'] } },
        { id: 'd', x: 440, y: 640, price: 220, icon: 'worker', label: '雇园丁', req: ['c'], effect: { worker: { from: ['B1'], to: ['M2'] } } },
        { id: 'e', x: 460, y: 90, price: 200, icon: 'cow', label: '买奶牛', buy: 3, req: ['a'], repeat: { times: 2, mul: 1.6 }, effect: { hens: { coop: 'K1', n: 3 } } },
        { id: 'f', x: 420, y: 740, price: 300, icon: 'mower', label: '割草机', req: ['d'], effect: { vehicle: true } },
        { id: 'g', x: 870, y: 370, price: 260, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1'] } },
        { id: 'h', x: 600, y: 420, price: 300, icon: 'loader', label: '园丁换铲车', req: ['d'], effect: { upgradeWorkers: 'loader' } },
        { id: 'i', x: 650, y: 320, price: 200, icon: 'sprinkler', label: '洒水器', req: ['d'], effect: { sprinkler: ['B1'] } },
      ],
      deco: { theme: 'farm', paths: [[420, 380, 500, 100], [640, 140, 80, 260]], hedges: [[820, 680, 90, 22]], trees: [[880, 740, 'round'], [880, 60, 'round']], bushes: [[700, 40], [880, 300]], barn: [600, 90] } },

    // 28 — timber and dairy side by side: planks and cheese
    { name: '林场牧场', W: 940, H: 800, start: [530, 460], par: 210, bill: 20,
      goal: { type: 'earn', n: 7450 },
      objects: [
        { id: 'T1', type: 'field', crop: 'log', x: 40, y: 40, w: 300, h: 280, gap: 30 },
        { id: 'K1', type: 'coop', item: 'milk', producer: 'cow', x: 80, y: 440, w: 280, h: 300, n: 4, max: 11, prefill: 700 },
        { id: 'M1', type: 'proc', in: 'log', out: 'plank', ratio: 5, time: 0.45, x: 640, y: 160, outTo: 'C1' },
        { id: 'M2', type: 'proc', in: 'milk', out: 'cheese', ratio: 6, time: 0.45, x: 640, y: 700, outTo: 'C1', hidden: true },
        { id: 'C1', type: 'counter', items: ['log', 'plank', 'cheese'], x: 790, y: 440 },
      ],
      tiles: [
        { id: 'a', x: 480, y: 560, price: 50, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 50 } } },
        { id: 'b', x: 440, y: 130, price: 170, icon: 'lumber', label: '雇伐木工', req: ['a'], effect: { worker: { from: ['T1'], to: ['M1'] } } },
        { id: 'c', x: 640, y: 700, price: 200, icon: 'cheese', label: '奶酪机', req: ['a'], effect: { show: ['M2'] } },
        { id: 'd', x: 450, y: 650, price: 230, icon: 'milker', label: '挤奶工', req: ['c'], effect: { worker: { from: ['K1'], to: ['M2'] } } },
        { id: 'e', x: 460, y: 250, price: 300, icon: 'truck', label: '换运木车', req: ['b'], effect: { upgradeWorkers: 'loader' } },
        { id: 'f', x: 500, y: 760, price: 260, icon: 'cow', label: '买奶牛', buy: 3, req: ['c'], repeat: { times: 2, mul: 1.6 }, effect: { hens: { coop: 'K1', n: 3 } } },
        { id: 'g', x: 890, y: 330, price: 280, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1'] } },
        { id: 'h', x: 600, y: 380, price: 200, icon: 'sprinkler', label: '育林水', req: ['b'], effect: { sprinkler: ['T1'] } },
      ],
      deco: { theme: 'farm', paths: [[400, 390, 540, 100], [520, 120, 80, 280]], hedges: [[840, 720, 90, 22]], trees: [[900, 760, 'cone'], [900, 60, 'cone']], bushes: [[720, 40], [900, 600]] } },

    // 29 — the harvest fair: corn, pumpkins and apples, three machines
    { name: '秋收集市', W: 980, H: 820, start: [560, 460], par: 210, bill: 50,
      goal: { type: 'earn', n: 10550 },
      objects: [
        { id: 'F1', type: 'field', crop: 'corn', x: 40, y: 40, w: 300, h: 260, gap: 10 },
        { id: 'P1', type: 'field', crop: 'pumpkin', x: 40, y: 350, w: 300, h: 220, gap: 22 },
        { id: 'A1', type: 'coop', item: 'apple', producer: 'appletree', x: 80, y: 640, w: 260, h: 150, n: 4, max: 7, prefill: 500 },
        { id: 'M1', type: 'proc', in: 'corn', out: 'popcorn', ratio: 6, time: 0.45, x: 700, y: 140, outTo: 'C1' },
        { id: 'M2', type: 'proc', in: 'pumpkin', out: 'pie', ratio: 4, time: 0.5, x: 700, y: 330, outTo: 'C1', hidden: true },
        { id: 'M3', type: 'proc', in: 'apple', out: 'juice', ratio: 5, time: 0.5, x: 700, y: 720, outTo: 'C1', hidden: true },
        { id: 'C1', type: 'counter', items: ['corn', 'pumpkin', 'popcorn', 'pie', 'juice'], x: 840, y: 480 },
      ],
      tiles: [
        { id: 'a', x: 500, y: 560, price: 60, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 60 } } },
        { id: 'b', x: 460, y: 140, price: 180, icon: 'worker', label: '雇园丁', req: ['a'], effect: { worker: { from: ['F1'], to: ['M1'] } } },
        { id: 'c', x: 700, y: 330, price: 240, icon: 'pie', label: '南瓜派烤炉', req: ['a'], effect: { show: ['M2'] } },
        { id: 'd', x: 470, y: 400, price: 260, icon: 'worker', label: '雇园丁', req: ['c'], effect: { worker: { from: ['P1'], to: ['M2'] } } },
        { id: 'e', x: 700, y: 720, price: 260, icon: 'juice', label: '榨汁机', req: ['a'], effect: { show: ['M3'] } },
        { id: 'f', x: 480, y: 720, price: 280, icon: 'cart', label: '雇小车', req: ['e'], effect: { worker: { from: ['A1'], to: ['M3'] } } },
        { id: 'g', x: 580, y: 250, price: 360, icon: 'mower', label: '割草机', req: ['b'], effect: { vehicle: true } },
        { id: 'h', x: 930, y: 370, price: 380, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1'] } },
        { id: 'i', x: 600, y: 470, price: 420, icon: 'loader', label: '园丁换铲车', req: ['d'], effect: { upgradeWorkers: 'loader' } },
      ],
      deco: { theme: 'farm', paths: [[420, 420, 560, 100], [560, 100, 80, 320]], hedges: [[880, 740, 90, 22]], trees: [[940, 780, 'round'], [940, 60, 'round']], bushes: [[800, 40], [940, 620]] } },

    // 30 — the big estate: forest, cows, sheep and strawberries, four machines
    { name: '半亩大庄园', W: 1100, H: 940, start: [620, 520], par: 250, bill: 50,
      goal: { type: 'earn', n: 12600 },
      objects: [
        { id: 'T1', type: 'field', crop: 'log', x: 40, y: 40, w: 280, h: 260, gap: 30 },
        { id: 'K1', type: 'coop', item: 'milk', producer: 'cow', x: 420, y: 70, w: 260, h: 200, n: 4, max: 9, prefill: 600 },
        { id: 'B1', type: 'field', crop: 'berry', x: 40, y: 360, w: 300, h: 260, gap: 9 },
        { id: 'S1', type: 'coop', item: 'wool', producer: 'sheep', x: 80, y: 690, w: 260, h: 210, n: 4, max: 9, prefill: 600 },
        { id: 'M1', type: 'proc', in: 'log', out: 'plank', ratio: 5, time: 0.45, x: 900, y: 170, outTo: 'C1' },
        { id: 'M2', type: 'proc', in: 'milk', out: 'cheese', ratio: 6, time: 0.45, x: 900, y: 330, outTo: 'C1', hidden: true },
        { id: 'M3', type: 'proc', in: 'berry', out: 'jam', ratio: 5, time: 0.5, x: 560, y: 420, outTo: 'C1', hidden: true },
        { id: 'M4', type: 'proc', in: 'wool', out: 'yarn', ratio: 5, time: 0.45, x: 620, y: 820, outTo: 'C1', hidden: true },
        { id: 'C1', type: 'counter', items: ['berry', 'plank', 'cheese', 'jam', 'yarn'], x: 940, y: 560 },
      ],
      tiles: [
        { id: 'a', x: 620, y: 620, price: 60, icon: 'cap', label: '大背篓', effect: { up: { key: 'cap', v: 60 } } },
        { id: 'b', x: 360, y: 330, price: 200, icon: 'lumber', label: '雇伐木工', req: ['a'], effect: { worker: { from: ['T1'], to: ['M1'] } } },
        { id: 'c', x: 900, y: 330, price: 240, icon: 'cheese', label: '奶酪机', req: ['a'], effect: { show: ['M2'] } },
        { id: 'd', x: 740, y: 330, price: 260, icon: 'milker', label: '挤奶工', req: ['c'], effect: { worker: { from: ['K1'], to: ['M2'] } } },
        { id: 'e', x: 560, y: 420, price: 240, icon: 'jam', label: '果酱机', req: ['a'], effect: { show: ['M3'] } },
        { id: 'f', x: 420, y: 520, price: 260, icon: 'worker', label: '雇园丁', req: ['e'], effect: { worker: { from: ['B1'], to: ['M3'] } } },
        { id: 'g', x: 620, y: 820, price: 280, icon: 'yarn', label: '毛线机', req: ['a'], effect: { show: ['M4'] } },
        { id: 'h', x: 460, y: 820, price: 280, icon: 'cart', label: '雇小车', req: ['g'], effect: { worker: { from: ['S1'], to: ['M4'] } } },
        { id: 'i', x: 760, y: 470, price: 480, icon: 'truck', label: '换铲车运木车', req: ['f'], effect: { upgradeWorkers: 'loader' } },
        { id: 'j', x: 1040, y: 420, price: 450, icon: 'cashier', label: '店员', req: ['a'], effect: { cashier: ['C1'] } },
        { id: 'k', x: 760, y: 620, price: 400, icon: 'gear', label: '快机器', req: ['d'], effect: { proc: [{ id: 'M1', mul: 0.6 }, { id: 'M2', mul: 0.6 }, { id: 'M3', mul: 0.6 }, { id: 'M4', mul: 0.6 }] } },
      ],
      deco: { theme: 'farm', paths: [[480, 560, 620, 100], [760, 200, 80, 360]], hedges: [[960, 860, 120, 22]], trees: [[1060, 900, 'round'], [1060, 60, 'cone']], bushes: [[760, 40], [1060, 760]], barn: [760, 900 - 790] } },
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
    // page 2 (v3.3): the timber & dairy farm, restored with stars from levels 16–30
    { id: 'logpile',    name: '码木材堆', cost: 2, page: 2 },
    { id: 'fence2',     name: '修牧场栅栏', cost: 2, page: 2 },
    { id: 'cornrow',    name: '种玉米垄', cost: 2, page: 2 },
    { id: 'hives',      name: '摆蜂箱',   cost: 2, page: 2 },
    { id: 'scarecrow',  name: '扎稻草人', cost: 2, page: 2 },
    { id: 'pumpkins',   name: '堆大南瓜', cost: 2, page: 2 },
    { id: 'cows',       name: '牵来奶牛', cost: 3, page: 2 },
    { id: 'orchard',    name: '种苹果树', cost: 3, page: 2 },
    { id: 'sheepfold',  name: '搭羊圈',   cost: 3, page: 2 },
    { id: 'watertower', name: '修水塔',   cost: 3, page: 2 },
    { id: 'silo',       name: '盖粮仓',   cost: 3, page: 2 },
    { id: 'sawmill',    name: '建锯木棚', cost: 4, page: 2 },
    { id: 'dairy',      name: '建奶牛棚', cost: 4, page: 2 },
    { id: 'tractor',    name: '开来拖拉机', cost: 4, page: 2 },
    { id: 'lodge',      name: '翻新原木屋', cost: 5, page: 2 },
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
