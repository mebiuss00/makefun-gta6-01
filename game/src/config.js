// Every tuning number and colour for Palmera Heat in one place. The world is measured in
// pixels; the camera shows a 1280x720 window of it. No rule below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The logical size of the camera view. */
export const VIEW = { width: 1280, height: 720 };

export const CITY = {
  road: 100, // width of one road, kerb to kerb
  block: 236, // one city block, road edge to road edge
  cols: 7,
  rows: 5,
  walk: 24, // sidewalk width inside a block, around its building
  lane: 25, // traffic lane offset from a road's centre line
};

export const PLAYER = {
  radius: 10,
  walkSpeed: 178,
  runSpeed: 252,
  maxHealth: 100,
  regenPerSecond: 2.2,
  regenDelay: 6,
  meleeRange: 34,
  meleeArc: 1.15,
  meleeDamage: 34,
  meleeCooldown: 0.38,
  fireRate: 7,
  bulletSpeed: 760,
  bulletRange: 460,
  bulletDamage: 26,
};

export const CAR = {
  radius: 17,
  length: 44,
  width: 22,
  trafficSpeed: 148,
  trafficAccel: 150,
  playerAccel: 300,
  brake: 460,
  drag: 0.55,
  maxReverse: 90,
  turnRate: 2.6,
  health: 120,
};

export const KIND_TRAFFIC = 'traffic';
export const KIND_PARKED = 'parked';
export const KIND_POLICE = 'police';
export const KIND_GOLD = 'gold';

export const CAR_COLORS = ['#d94f30', '#3e7cb1', '#f2c14e', '#81b29a', '#e07a5f', '#6d6875', '#f4f1de', '#457b9d', '#bc6c25', '#606c38'];
export const GOLD_COLOR = '#ffd23f';
export const POLICE_COLOR = '#1d3557';

export const PED = {
  radius: 8,
  walkSpeed: 52,
  fleeSpeed: 150,
  health: 40,
  count: 20,
};

export const TRAFFIC_COUNT = 13;

/** Wanted heat: crimes add it, hiding lets it cool. Stars are 100 heat each, five at most. */
export const HEAT = {
  max: 500,
  perStar: 100,
  decayPerSecond: 5,
  jackTraffic: 55,
  jackParked: 18,
  hitPedCar: 85,
  meleeHit: 26,
  meleeKill: 110,
  shotFired: 9,
  shotHitCar: 16,
  ramPolice: 55,
  witnessRange: 390,
};

export const POLICE = {
  maxCars: 5,
  spawnDistance: 560,
  accel: 320,
  maxSpeed: 318,
  bustRadius: 52,
  bustTimeFoot: 1.5,
  bustTimeCar: 2.1,
  shootStars: 3,
  shootRange: 330,
  shootDamage: 6,
  shootInterval: 1.15,
};

export const REWARD = { mission1: 300, mission2: 450, mission3: 700, errand: 120 };
export const BUST_FINE = 0.15;
export const WASTE_FINE = 0.1;

export const PALETTE = {
  water: '#2e86ab',
  waterDeep: '#1f6f8f',
  sand: '#ecd9a0',
  grass: '#79b473',
  parkGrass: '#5da75d',
  sidewalk: '#b8b2a7',
  asphalt: '#3c4048',
  asphaltDark: '#33373e',
  laneMark: '#e8e3d5',
  crosswalk: '#d8d3c3',
  kerb: '#8f8a7d',
  buildingShadow: 'rgba(40, 30, 20, 0.28)',
  text: '#fdfdf8',
  muted: '#cfd4d1',
  panel: 'rgba(16, 20, 28, 0.82)',
  panelEdge: '#ffd23f',
  gold: '#ffd23f',
  danger: '#ef476f',
  health: '#6bcb77',
  healthLow: '#ef476f',
  wanted: '#ffd23f',
  marker: '#ffd23f',
  policeDot: '#4cc9f0',
  playerDot: '#ffffff',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the save game is kept between visits (this browser only). */
export const SAVE_KEY = 'palmera-heat.save.v1';
export const BEST_KEY = 'palmera-heat.best.v1';
