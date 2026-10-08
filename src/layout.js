// Hand-placed world layout. North is -Z, east is +X. The map spans -800..800 on both axes: the
// old valley of Moonmire in the middle (-300..300) and four wild regions around it.

export const WATER_LEVEL = 0;

export const PASTURE = { x: 170, z: -30 };   // Crow shepherd's moonlit hill
export const FENCE_R = 42;
export const TOAD = { x: -160, z: 30 };       // Giant mushroom in the western forest
export const TEMPLE = { x: 0, z: -252 };      // Sunken temple behind the northern cliffs

// River from the temple courtyard, through the canyon, down into the southern swamp.
export const RIVER = [
  [0, -222], [4, -185], [-2, -150], [-12, -110], [-25, -60], [-30, -10],
  [-18, 50], [-35, 110], [-62, 150], [-85, 195], [-95, 240],
];

// Abandoned railway: from the drowned city's lake shore, through the flooded swamp, up to the old
// station by the pasture.
export const RAIL = [
  [-128, 418], [-176, 392], [-212, 344], [-175, 284], [-120, 258], [-75, 232], [-35, 196], [0, 150], [35, 100], [75, 55], [105, 25], [120, 12],
];

export const PATHS = [
  [[120, 12], [90, 0], [50, -5], [0, 10], [-60, 25], [-110, 30], [-150, 32]],
  [[0, 10], [-4, -60], [6, -110], [-2, -142]],
  [[78, 15], [80, -2]],
  [[-150, 32], [-160, -20], [-168, -62], [-176, -62]],
];

export const SPAWN = { x: -112, z: 254, toward: { x: -75, z: 232 } };

export const LOST_SHEEP = [[-128, 186], [-105, -55], [30, -118]];

export const WISP_SPAWNS = [
  [-40, 205], [-10, 230], [20, 215], [-70, 175], [10, 185], [45, 240], [-120, 225], [-60, 260],
  [-5, -125], [6, -200], [-12, -238], [14, -236],
];

export const CANYON_ARCH_Z = -160;
export const CANYON_STEPS_Z = -185;

// ---- Giants & new places ----
export const CASTLE = { x: 196, z: 172, top: 92 };   // floating castle island over its own lake
export const HEAD = { x: -218, z: -62 };              // the sleeping stone king, half buried
export const STREAM = [[-186, -132], [-183, -95], [-181, -62], [-186, -28], [-200, 4], [-214, 30]];
export const RIBCAGE = { x: -22, z: 178 };            // colossal skeleton straddling the railway
export const TAVERN = { x: 78, z: 22 };               // "The Melting Candle" inn
export const HOUSES = [[50, 30, 0.3], [64, -24, 2.9], [97, -24, 3.3], [40, 6, 1.6]];

// Discoverable locations (shown as a title card the first time you get close).
export const LOCATIONS = [
  { id: 'swamp', name: 'บึงแสงจันทร์', x: -40, z: 220, r: 60 },
  { id: 'ribcage', name: 'ซี่โครงอสูร', x: RIBCAGE.x, z: RIBCAGE.z, r: 40 },
  { id: 'village', name: 'หมู่บ้านสถานีร้าง', x: TAVERN.x, z: TAVERN.z, r: 45 },
  { id: 'pasture', name: 'เนินจันทร์', x: PASTURE.x, z: PASTURE.z, r: 50 },
  { id: 'castle', name: 'ปราสาทแขวนฟ้า', x: CASTLE.x, z: CASTLE.z, r: 95 },
  { id: 'toad', name: 'เห็ดยักษ์', x: TOAD.x, z: TOAD.z, r: 30 },
  { id: 'head', name: 'ราชาหินผู้หลับใหล', x: HEAD.x, z: HEAD.z, r: 70 },
  { id: 'canyon', name: 'หุบผาซุ้มประตู', x: 0, z: -165, r: 30 },
  { id: 'temple', name: 'วิหารจมน้ำ', x: TEMPLE.x, z: TEMPLE.z, r: 40 },
];

// ---- Enemies ----
// Scarecrows stand inert by night and wake in the daylight gloom around the moon hill.
export const STRAW_SPAWNS = [[112, -72], [214, -84], [232, 12], [124, 64], [62, -46], [205, 36], [150, 40]];
// Shadow wolf packs in the western forest: [x, z, count]
export const WOLF_PACKS = [[-125, -15, 3], [-205, 75, 2], [-95, 95, 2], [-150, -100, 3], [-60, -40, 2]];
// Leeches lurk in the swamp water at night (snapped to the nearest deep water).
export const LEECH_SPAWNS = [[-60, 182], [12, 205], [-128, 232], [35, 250], [-85, 150], [-10, 240]];
// The stone knight guards the east end of the bridge to the stone king.
export const KNIGHT_POS = { x: HEAD.x + 52, z: HEAD.z };

// The blacksmith's open-air forge on the west side of the village.
export const SMITH = { x: 52, z: 14 };

// ---- The Pale Ones ----
// gaunts roam at night around the village fringe, the forest, ruins, the railway and the north
export const GAUNT_SPAWNS = [
  [30, 44], [112, -44], [100, 62], [-130, 8], [-182, -28], [-92, -82], [-226, 24], [-104, -12],
  [42, 104], [-8, 138], [222, -58], [140, -86], [12, -122], [-24, -232], [-60, 120], [160, 110],
];
// a few lurk in the deep western forest even by day
export const GAUNT_DAY_SPAWNS = [[-200, -40], [-160, 70], [-238, -10]];
export const CRAWLER_SPAWNS = [[-70, 190], [-20, 222], [30, 228], [-140, 210], [-170, 40], [-120, 120], [-200, -80], [80, 190]];
// she waits where the dead linger, and only moves when you look away
export const WEEPER_SPAWNS = [[-22, 166], [-70, 262], [-144, -100], [8, -246]];
export const BRUTE_SPAWNS = [[CASTLE.x - 78, CASTLE.z + 18], [236, 34], [-2, -132]];
// extra packs for the older enemies
export const EXTRA_WOLF_PACKS = [[-230, -60, 3], [-170, 150, 2]];
export const EXTRA_STRAW_SPAWNS = [[184, -110], [250, -20], [96, -100], [70, 80]];
export const EXTRA_LEECH_SPAWNS = [[-110, 260], [60, 230], [-30, 270]];

// ---- The wild beyond the valley (the world grew from 640 m to 1600 m) ----
// north: the bell-tower highlands
export const BELLTOWER = { x: 140, z: -560 };
export const STONES = { x: -300, z: -470 };
// east: abandoned farmland
export const WINDMILL = { x: 560, z: -60 };
export const FARMS = { x: 470, z: 190 };
// south: the drowned city in its lake
export const LAKE = { x: -60, z: 590, r: 175 };
export const DROWNED = { x: -60, z: 600 };
export const PIER = { x: 150, z: 470 };
// west: the dark forest
export const HANGTREE = { x: -560, z: 20 };
export const HUNTER = { x: -470, z: 300 };

// roads out of the valley (graded into the ground, drawn on the map)
export const ROADS = [
  [[110, -118], [128, -200], [118, -280], [150, -360], [128, -440], [140, -520]],          // north, up to the bell tower
  [[118, -440], [-40, -470], [-180, -480], [-282, -470]],                                     // across the highland to the stones
  [[120, 12], [200, 4], [300, -6], [420, -30], [540, -56]],                                   // east to the windmill
  [[420, -30], [450, 60], [470, 168]],                                                       // and down to the farms
  [[196, 262], [180, 350], [160, 450]],                                                      // south from the castle lake to the pier
  [[-150, 32], [-250, 30], [-360, 22], [-460, 18], [-536, 20]],                              // west into the dark forest
  [[-360, 22], [-400, 140], [-450, 280]],                                                    // and on to the hunters' camp
  [[-128, 418], [-20, 430], [80, 452], [150, 470]],                                          // along the lake shore
];

export const WILD_LOCATIONS = [
  { id: 'belltower', name: 'หอระฆังบนยอดเขา', x: BELLTOWER.x, z: BELLTOWER.z, r: 55 },
  { id: 'stones', name: 'ลานหินตั้งแห่งลมหนาว', x: STONES.x, z: STONES.z, r: 45 },
  { id: 'windmill', name: 'กังหันลมร้าง', x: WINDMILL.x, z: WINDMILL.z, r: 45 },
  { id: 'farms', name: 'ไร่ข้าวโพดร้าง', x: FARMS.x, z: FARMS.z, r: 60 },
  { id: 'drowned', name: 'เมืองจมใต้ทะเลสาบ', x: DROWNED.x, z: DROWNED.z, r: 130 },
  { id: 'pier', name: 'ท่าเรือผุ', x: PIER.x, z: PIER.z, r: 35 },
  { id: 'hangtree', name: 'ต้นไม้แขวนคอ', x: HANGTREE.x, z: HANGTREE.z, r: 50 },
  { id: 'hunter', name: 'เพิงนายพรานที่หายไป', x: HUNTER.x, z: HUNTER.z, r: 35 },
];
LOCATIONS.push(...WILD_LOCATIONS);

// the wild's own inhabitants
export const WILD_SPAWNS = {
  wolf: [[-420, -40, 3], [-520, 160, 3], [-620, -120, 2], [-380, 260, 2], [260, -420, 2], [-120, -620, 3], [380, -520, 2]],
  gaunt: [[-480, -80], [-600, 100], [-430, 330], [-500, 260], [300, 120], [460, 240], [600, 40], [-200, 420], [40, 420]],
  gauntDay: [[-560, -30], [-520, 60], [-640, 10]],
  crawler: [[-540, 0], [-590, 50], [-30, 470], [-160, 470], [60, 500], [-460, 300]],
  weeper: [[BELLTOWER.x - 8, BELLTOWER.z + 10], [-300, -460], [-90, 520], [-560, 34]],
  straw: [[440, 150], [500, 210], [470, 240], [520, 120], [560, -20], [600, -100], [380, 60], [420, 220]],
  brute: [[160, -500], [540, -80], [-560, -40], [-20, 520]],
  wisp: [[-100, 470], [0, 480], [-200, 500], [120, 520], [-300, -440], [-280, -500], [-560, 40]],
  leech: [[-60, 470], [40, 540], [-180, 560], [-120, 660], [60, 660]],
};
