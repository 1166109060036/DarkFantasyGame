// Hand-placed world layout. North is -Z, east is +X. The map spans -320..320 on both axes.

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

// Abandoned railway: from the flooded swamp up to the old station by the pasture.
export const RAIL = [
  [-175, 284], [-120, 258], [-75, 232], [-35, 196], [0, 150], [35, 100], [75, 55], [105, 25], [120, 12],
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
