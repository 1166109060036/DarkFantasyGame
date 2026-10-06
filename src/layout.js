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
];

export const SPAWN = { x: -112, z: 254, toward: { x: -75, z: 232 } };

export const LOST_SHEEP = [[-128, 186], [-105, -55], [30, -118]];

export const WISP_SPAWNS = [
  [-40, 205], [-10, 230], [20, 215], [-70, 175], [10, 185], [45, 240], [-120, 225], [-60, 260],
  [-5, -125], [6, -200], [-12, -238], [14, -236],
];

export const CANYON_ARCH_Z = -160;
export const CANYON_STEPS_Z = -185;
