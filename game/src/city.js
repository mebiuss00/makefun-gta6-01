// The city of Palmera: a grid of avenues on a peninsula. buildCity lays out the blocks once —
// pastel buildings with names where the story needs them, parks, parking lots, palm trees —
// and answers the questions the rest of the game asks: where the roads run, what a circle at
// (x, y) bumps into, and where each landmark's front door stands.
import { CITY } from './config.js';

const PITCH = CITY.road + CITY.block;

export const WORLD = {
  width: CITY.cols * CITY.block + (CITY.cols + 1) * CITY.road,
  height: CITY.rows * CITY.block + (CITY.rows + 1) * CITY.road,
};

/** Centre line x of vertical avenue i (0..cols), and y of horizontal avenue j (0..rows). */
export function avenueX(i) {
  return i * PITCH + CITY.road / 2;
}
export function avenueY(j) {
  return j * PITCH + CITY.road / 2;
}

/** The rect of block (col, row), road edge to road edge. */
export function blockRect(col, row) {
  return { x: col * PITCH + CITY.road, y: row * PITCH + CITY.road, w: CITY.block, h: CITY.block };
}

const ROOF_COLORS = ['#e2725b', '#e8a87c', '#f2d38a', '#8fc1a9', '#7fb3d5', '#c39bd3', '#f0e6d2', '#e5989b', '#dda448', '#94b8a0'];

/** Named places the story visits, by block. kind: building | lot | park | strip. */
const LANDMARKS = {
  hotel: { col: 3, row: 0, name: 'GRAND PALMERA HOTEL', kind: 'building', color: '#f2d38a', floors: 9 },
  police: { col: 2, row: 0, name: 'PALMERA PD', kind: 'building', color: '#7fb3d5', floors: 4 },
  park: { col: 2, row: 2, name: 'CORAL PARK', kind: 'park' },
  docks: { col: 6, row: 2, name: 'PALMERA DOCKS', kind: 'building', color: '#94b8a0', floors: 2 },
  garage: { col: 1, row: 3, name: "ROSA'S GARAGE", kind: 'building', color: '#e2725b', floors: 2 },
  marina: { col: 5, row: 1, name: 'MARINA LOT', kind: 'lot' },
  parking: { col: 0, row: 2, name: 'CORAL PARKING', kind: 'lot' },
  hospital: { col: 4, row: 3, name: 'ST. CORAL HOSPITAL', kind: 'building', color: '#f0e6d2', floors: 5 },
  strip: { col: 3, row: 4, name: 'PALMERA STRIP', kind: 'strip' },
  safehouse: { col: 0, row: 4, name: 'CASA SEGURA', kind: 'building', color: '#e8a87c', floors: 3 },
};

function landmarkAt(col, row) {
  for (const key of Object.keys(LANDMARKS)) {
    const mark = LANDMARKS[key];
    if (mark.col === col && mark.row === row) return { key, ...mark };
  }
  return null;
}

/** Parking slots across a lot: two rows of angled bays along its middle. */
function lotSlots(rect) {
  const slots = [];
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < 4; i += 1) {
      slots.push({
        x: rect.x + 34 + i * 52,
        y: rect.y + 52 + row * 108,
        angle: row === 0 ? Math.PI / 2 : -Math.PI / 2,
      });
    }
  }
  return slots;
}

export function buildCity(random) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];
  const landmarks = {};

  for (let row = 0; row < CITY.rows; row += 1) {
    for (let col = 0; col < CITY.cols; col += 1) {
      const rect = blockRect(col, row);
      const mark = landmarkAt(col, row);
      if (mark && mark.kind === 'park') {
        parks.push(rect);
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: rect.x + 30 + random() * (rect.w - 60), y: rect.y + 30 + random() * (rect.h - 60) });
        }
        landmarks[mark.key] = { ...mark, rect, door: { x: rect.x + rect.w / 2, y: rect.y + rect.h + 14 } };
        continue;
      }
      if (mark && (mark.kind === 'lot' || mark.kind === 'strip')) {
        const lot = { ...rect, slots: mark.kind === 'lot' ? lotSlots(rect) : [] };
        lots.push(lot);
        landmarks[mark.key] = { ...mark, rect, door: { x: rect.x + rect.w / 2, y: rect.y + rect.h + 14 } };
        continue;
      }
      const inset = CITY.walk;
      const building = {
        x: rect.x + inset,
        y: rect.y + inset,
        w: rect.w - inset * 2,
        h: rect.h - inset * 2,
        color: mark ? mark.color : ROOF_COLORS[Math.floor(random() * ROOF_COLORS.length)],
        floors: mark ? mark.floors : 2 + Math.floor(random() * 7),
        name: mark ? mark.name : null,
      };
      buildings.push(building);
      if (mark) {
        landmarks[mark.key] = { ...mark, rect, door: { x: building.x + building.w / 2, y: building.y + building.h + CITY.walk / 2 + 8 } };
      }
      // Palms along the sidewalk corners of ordinary blocks.
      if (random() < 0.75) trees.push({ x: rect.x + 12, y: rect.y + 12 });
      if (random() < 0.75) trees.push({ x: rect.x + rect.w - 12, y: rect.y + rect.h - 12 });
    }
  }

  return { buildings, parks, lots, trees, landmarks, width: WORLD.width, height: WORLD.height };
}

/** True when (x, y) is on asphalt: inside any avenue's band. */
export function isOnRoad(x, y) {
  const inVertical = x >= 0 && x <= WORLD.width && (x % PITCH) < CITY.road;
  const inHorizontal = y >= 0 && y <= WORLD.height && (y % PITCH) < CITY.road;
  return inVertical || inHorizontal;
}

/**
 * Push a circle out of every building it overlaps and keep it inside the world. Returns the
 * corrected [x, y]; buildings are the only solid things in Palmera.
 */
export function collideCircle(city, x, y, radius) {
  let cx = Math.min(WORLD.width - radius, Math.max(radius, x));
  let cy = Math.min(WORLD.height - radius, Math.max(radius, y));
  for (let index = 0; index < city.buildings.length; index += 1) {
    const b = city.buildings[index];
    const nearX = Math.min(b.x + b.w, Math.max(b.x, cx));
    const nearY = Math.min(b.y + b.h, Math.max(b.y, cy));
    const dx = cx - nearX;
    const dy = cy - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      cx = nearX + (dx / dist) * radius;
      cy = nearY + (dy / dist) * radius;
    } else {
      // Centre inside the rect: leave by the nearest face.
      const left = cx - b.x;
      const right = b.x + b.w - cx;
      const top = cy - b.y;
      const bottom = b.y + b.h - cy;
      const min = Math.min(left, right, top, bottom);
      if (min === left) cx = b.x - radius;
      else if (min === right) cx = b.x + b.w + radius;
      else if (min === top) cy = b.y - radius;
      else cy = b.y + b.h + radius;
    }
  }
  return [cx, cy];
}

/** The sidewalk loop (a block's inset rect) around the block that holds (x, y). */
export function sidewalkRectAt(x, y) {
  const col = Math.min(CITY.cols - 1, Math.max(0, Math.floor((x - CITY.road) / PITCH)));
  const row = Math.min(CITY.rows - 1, Math.max(0, Math.floor((y - CITY.road) / PITCH)));
  const rect = blockRect(col, row);
  return { x: rect.x + 13, y: rect.y + 13, w: rect.w - 26, h: rect.h - 26 };
}

/** The point on the road network nearest to (x, y): used by police and respawns. */
export function nearestRoadPoint(x, y) {
  const col = Math.min(CITY.cols, Math.max(0, Math.round((x - CITY.road / 2) / PITCH)));
  const row = Math.min(CITY.rows, Math.max(0, Math.round((y - CITY.road / 2) / PITCH)));
  const onVertical = Math.abs(x - avenueX(col)) < Math.abs(y - avenueY(row));
  return onVertical ? { x: avenueX(col), y } : { x, y: avenueY(row) };
}
