// The simulation: Palmera's people, cars and consequences, advanced one fixed step at a
// time. The world owns the player (on foot and behind the wheel), traffic, pedestrians,
// collisions, heat and the camera; police, combat and missions live in their own modules
// and work on the same state. step() returns event flags for the boot module to react to.
import { CAR, CITY, HEAT, KIND_GOLD, KIND_POLICE, KIND_PARKED, KIND_TRAFFIC, PED, PLAYER, VIEW } from './config.js';
import { avenueX, buildCity, collideCircle, sidewalkRectAt } from './city.js';
import { createMissions, startErrand, startMission, updateMissions } from './missions.js';
import { topUpTraffic, updateTraffic } from './traffic.js';
import { isWitnessed, updatePolice } from './police.js';
import { damagePed, tryFire, tryMelee, updateBullets } from './combat.js';
import {
  EVENT_CARJACK, EVENT_CRASH, EVENT_ENTER_CAR, EVENT_EXIT_CAR, EVENT_HIT, EVENT_PED_DOWN,
} from './events.js';

function makeParkedCar(random, x, y, angle, kind) {
  const colors = ['#d94f30', '#3e7cb1', '#f2c14e', '#81b29a', '#e07a5f', '#6d6875', '#f4f1de', '#457b9d', '#bc6c25'];
  return {
    x, y, angle, speed: 0,
    color: kind === KIND_GOLD ? '#ffd23f' : colors[Math.floor(random() * colors.length)],
    kind, hp: CAR.health, driver: null, disabled: false,
    topSpeed: kind === KIND_GOLD ? 288 : 226 + random() * 48,
  };
}

function makePed(random, city) {
  const col = Math.floor(random() * CITY.cols);
  const row = Math.floor(random() * CITY.rows);
  const rect = {
    x: col * (CITY.road + CITY.block) + CITY.road + 13,
    y: row * (CITY.road + CITY.block) + CITY.road + 13,
    w: CITY.block - 26,
    h: CITY.block - 26,
  };
  const corner = Math.floor(random() * 4);
  const corners = [
    { x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h },
  ];
  const shirts = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#e07a5f', '#f4f1de', '#bc6c25', '#81b29a'];
  return {
    x: corners[corner].x, y: corners[corner].y, angle: 0, hp: PED.health,
    state: 'walk', corner, rect, fleeTimer: 0, fleeFrom: null, downTimer: 0,
    color: shirts[Math.floor(random() * shirts.length)],
    speedFactor: 0.8 + random() * 0.45,
  };
}

export function createWorld(random) {
  const city = buildCity(random);
  const garage = city.landmarks.garage;
  const state = {
    city, random, time: 0,
    player: {
      x: garage.door.x, y: garage.door.y + 34, angle: -Math.PI / 2, hp: PLAYER.maxHealth,
      money: 0, car: null, meleeCd: 0, fireCd: 0, swing: 0, lastHurt: 99, speedMag: 0,
    },
    cars: [], peds: [], bullets: [],
    heat: 0, bust: 0, over: null, notice: null, prompt: null, nearestCop: null,
    mission: createMissions(city),
    goldCar: null,
    stats: { earned: 0, jacked: 0, busted: 0, wasted: 0, shots: 0 },
    camX: 0, camY: 0, trafficTimer: 0,
  };

  // Parked cars: most bays in both lots, the gold convertible among them at the marina.
  for (const lot of city.lots) {
    const isMarina = Math.abs(lot.x - city.landmarks.marina.rect.x) < 1;
    lot.slots.forEach((slot, index) => {
      if (isMarina && index === 2) {
        state.goldCar = makeParkedCar(random, slot.x, slot.y, slot.angle, KIND_GOLD);
        state.cars.push(state.goldCar);
      } else if (random() < 0.62) {
        state.cars.push(makeParkedCar(random, slot.x, slot.y, slot.angle, KIND_PARKED));
      }
    });
  }
  // Kerbside parking along a few avenues.
  for (let i = 1; i < CITY.cols; i += 1) {
    for (let n = 0; n < 3; n += 1) {
      if (random() < 0.35) continue;
      const y = 200 + random() * (city.height - 400);
      const side = random() < 0.5 ? -1 : 1;
      state.cars.push(makeParkedCar(random, avenueX(i) + side * (CITY.road / 2 - 13), y, Math.PI / 2, KIND_PARKED));
    }
  }
  for (let index = 0; index < PED.count; index += 1) state.peds.push(makePed(random, city));
  topUpTraffic(state, random);
  startMission(state, 0);
  return state;
}

/** Restore a saved visit: cash, story progress and where Dario stood. */
export function applySave(state, save) {
  state.player.money = save.money | 0;
  state.player.hp = Math.min(PLAYER.maxHealth, Math.max(30, save.hp | 0));
  if (typeof save.x === 'number' && typeof save.y === 'number') {
    const [x, y] = collideCircle(state.city, save.x, save.y, PLAYER.radius);
    state.player.x = x;
    state.player.y = y;
  }
  if (save.stats) state.stats = { ...state.stats, ...save.stats };
  if (save.storyDone) {
    state.mission.storyDone = true;
    state.mission.index = 3;
    startErrand(state);
  } else {
    startMission(state, Math.min(2, Math.max(0, save.mission | 0)));
  }
}

/** After a bust or a wasting: the fine, the front steps of the PD or the hospital, a clean slate. */
export function respawn(state, kind) {
  const player = state.player;
  if (player.car) {
    player.car.driver = null;
    player.car = null;
  }
  const fine = Math.floor(player.money * (kind === 'busted' ? 0.15 : 0.1));
  player.money -= fine;
  if (kind === 'busted') state.stats.busted += 1;
  else state.stats.wasted += 1;
  const door = kind === 'busted' ? state.city.landmarks.police.door : state.city.landmarks.hospital.door;
  player.x = door.x;
  player.y = door.y + 30;
  player.hp = kind === 'busted' ? Math.max(player.hp, 60) : PLAYER.maxHealth;
  state.heat = 0;
  state.bust = 0;
  state.over = null;
  state.bullets.length = 0;
  return fine;
}

function updatePeds(state, dt) {
  for (let index = state.peds.length - 1; index >= 0; index -= 1) {
    const ped = state.peds[index];
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) state.peds.splice(index, 1);
      continue;
    }
    let vx = 0;
    let vy = 0;
    let speed = PED.walkSpeed * ped.speedFactor;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const from = ped.fleeFrom ?? state.player;
      const dx = ped.x - from.x;
      const dy = ped.y - from.y;
      const dist = Math.hypot(dx, dy) || 1;
      vx = (dx / dist) * PED.fleeSpeed;
      vy = (dy / dist) * PED.fleeSpeed;
      speed = PED.fleeSpeed;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    } else {
      const rect = ped.rect;
      const corners = [
        { x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y },
        { x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h },
      ];
      const target = corners[(ped.corner + 1) % 4];
      const dx = target.x - ped.x;
      const dy = target.y - ped.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        ped.corner = (ped.corner + 1) % 4;
        if (state.random() < 0.06) ped.corner = (ped.corner + 2) % 4; // sometimes turns back
      } else {
        vx = (dx / dist) * speed;
        vy = (dy / dist) * speed;
      }
    }
    if (vx !== 0 || vy !== 0) ped.angle = Math.atan2(vy, vx);
    const [nx, ny] = collideCircle(state.city, ped.x + vx * dt, ped.y + vy * dt, PED.radius);
    ped.x = nx;
    ped.y = ny;
  }
  while (state.peds.length < PED.count) state.peds.push(makePed(state.random, state.city));
}

function carCrash(state, car, impactSpeed) {
  let events = 0;
  if (impactSpeed < 110) return events;
  car.hp -= (impactSpeed - 90) * 0.16;
  if (car.hp <= 0 && !car.disabled) {
    car.disabled = true;
    if (car.driver === 'traffic') car.driver = null;
  }
  events |= EVENT_CRASH;
  if (car === state.player.car) {
    state.player.hp -= (impactSpeed - 90) * 0.045;
    state.player.lastHurt = 0;
    if (state.player.hp <= 0 && !state.over) {
      state.player.hp = 0;
      state.over = 'wasted';
    }
  }
  return events;
}

function drivePlayerCar(state, dt, ctrl) {
  let events = 0;
  const car = state.player.car;
  const top = car.topSpeed ?? 235;
  if (ctrl.moveY < 0) car.speed += CAR.playerAccel * dt;
  else if (ctrl.moveY > 0) car.speed -= (car.speed > 4 ? CAR.brake : CAR.playerAccel * 0.6) * dt;
  car.speed -= car.speed * CAR.drag * dt;
  if (Math.abs(car.speed) < 3 && ctrl.moveY === 0) car.speed = 0;
  car.speed = Math.min(top, Math.max(-CAR.maxReverse, car.speed));
  if (Math.abs(car.speed) > 4 && ctrl.moveX !== 0) {
    car.angle += ctrl.moveX * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 90) * (car.speed < 0 ? -1 : 1);
  }
  const speedBefore = Math.abs(car.speed);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const [cx, cy] = collideCircle(state.city, car.x, car.y, CAR.radius);
  const correction = Math.hypot(cx - car.x, cy - car.y);
  car.x = cx;
  car.y = cy;
  if (correction > 3.5 && speedBefore > 60) {
    events |= carCrash(state, car, speedBefore);
    car.speed = -car.speed * 0.22;
  }
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  state.player.speedMag = Math.abs(car.speed);
  if (ctrl.interact && Math.abs(car.speed) < 12) {
    car.driver = null;
    state.player.car = null;
    const side = car.angle + Math.PI / 2;
    const [px, py] = collideCircle(state.city, car.x + Math.cos(side) * 30, car.y + Math.sin(side) * 30, PLAYER.radius);
    state.player.x = px;
    state.player.y = py;
    events |= EVENT_EXIT_CAR;
  }
  return events;
}

function walkPlayer(state, dt, ctrl) {
  let events = 0;
  const player = state.player;
  const speed = ctrl.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let vx = ctrl.moveX;
  let vy = ctrl.moveY;
  const len = Math.hypot(vx, vy);
  if (len > 0) {
    vx = (vx / len) * speed;
    vy = (vy / len) * speed;
    player.angle = Math.atan2(vy, vx);
  }
  const [nx, ny] = collideCircle(state.city, player.x + vx * dt, player.y + vy * dt, PLAYER.radius);
  player.speedMag = dt > 0 ? Math.hypot(nx - player.x, ny - player.y) / dt : 0;
  player.x = nx;
  player.y = ny;

  if (ctrl.melee) events |= tryMelee(state);
  if (ctrl.firing) events |= tryFire(state, ctrl.aimX, ctrl.aimY);

  if (ctrl.interact) {
    let best = null;
    let bestDist = 46;
    for (const car of state.cars) {
      if (car.disabled || car.kind === KIND_POLICE) continue;
      const dist = Math.hypot(car.x - player.x, car.y - player.y);
      if (dist < bestDist) {
        best = car;
        bestDist = dist;
      }
    }
    if (best) {
      if (best.driver === 'traffic') {
        if (Math.abs(best.speed) < 42) {
          // Yank the driver out: a new pedestrian, running.
          state.peds.push({
            x: best.x + 22, y: best.y, angle: 0, hp: PED.health, state: 'flee', fleeTimer: 3,
            fleeFrom: { x: player.x, y: player.y }, color: '#118ab2', corner: 0,
            rect: sidewalkRectAt(best.x, best.y), downTimer: 0, speedFactor: 1,
          });
          best.driver = null;
          state.heat = Math.min(HEAT.max, state.heat + (isWitnessed(state, best.x, best.y) ? HEAT.jackTraffic : HEAT.jackTraffic * 0.4));
          state.stats.jacked += 1;
          events |= EVENT_CARJACK;
        }
      } else {
        if (best.kind === KIND_GOLD) state.heat = Math.max(state.heat, HEAT.perStar * 2 + 5);
        else if (isWitnessed(state, best.x, best.y)) state.heat = Math.min(HEAT.max, state.heat + HEAT.jackParked);
        state.stats.jacked += best.kind === KIND_PARKED || best.kind === KIND_GOLD ? 1 : 0;
        events |= EVENT_ENTER_CAR;
      }
      if (events & (EVENT_CARJACK | EVENT_ENTER_CAR)) {
        best.driver = 'player';
        state.player.car = best;
        player.x = best.x;
        player.y = best.y;
      }
    }
  }
  return events;
}

function collideCarsAndPeds(state, dt) {
  let events = 0;
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = CAR.radius * 2 - 4;
      if (dist === 0 || dist >= min) continue;
      const push = (min - dist) / 2;
      const ux = dx / dist;
      const uy = dy / dist;
      const aMovable = a.driver !== null || a === state.player.car;
      const bMovable = b.driver !== null || b === state.player.car;
      if (aMovable || a.driver === 'player') { a.x -= ux * push; a.y -= uy * push; }
      if (bMovable || b.driver === 'player') { b.x += ux * push; b.y += uy * push; }
      const closing = Math.abs(a.speed) + Math.abs(b.speed);
      if (closing > 130) {
        events |= carCrash(state, a, closing * 0.7);
        events |= carCrash(state, b, closing * 0.7);
        if (a.kind === KIND_POLICE || b.kind === KIND_POLICE) {
          if (a === state.player.car || b === state.player.car) state.heat = Math.min(HEAT.max, state.heat + HEAT.ramPolice * dt * 8);
        }
      }
      if (a.driver) a.speed *= 0.86;
      if (b.driver) b.speed *= 0.86;
    }
    // Cars versus pedestrians: nobody wins.
    if (Math.abs(a.speed) > 26) {
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        const dx = ped.x - a.x;
        const dy = ped.y - a.y;
        if (dx * dx + dy * dy < (CAR.radius + PED.radius) * (CAR.radius + PED.radius)) {
          events |= damagePed(state, ped, 100) | EVENT_HIT;
          if (a === state.player.car || a.driver === 'player') {
            state.heat = Math.min(HEAT.max, state.heat + HEAT.hitPedCar);
          } else if (a.kind === KIND_POLICE) {
            // The PD's driving is its own business.
          }
          a.speed *= 0.8;
        }
      }
    }
    const [cx, cy] = collideCircle(state.city, a.x, a.y, CAR.radius);
    a.x = cx;
    a.y = cy;
  }
  return events;
}

function computePrompt(state) {
  const player = state.player;
  if (player.car) {
    state.prompt = Math.abs(player.car.speed) < 12 ? 'E — get out' : null;
    return;
  }
  let best = null;
  let bestDist = 46;
  for (const car of state.cars) {
    if (car.disabled || car.kind === KIND_POLICE) continue;
    const dist = Math.hypot(car.x - player.x, car.y - player.y);
    if (dist < bestDist) {
      best = car;
      bestDist = dist;
    }
  }
  if (!best) {
    state.prompt = null;
  } else if (best.kind === KIND_GOLD) state.prompt = 'E — steal the gold convertible';
  else if (best.driver === 'traffic') state.prompt = Math.abs(best.speed) < 42 ? 'E — carjack' : null;
  else state.prompt = 'E — drive';
}

/**
 * One fixed step. ctrl: { moveX, moveY, run, interact, melee, firing, aimX, aimY } — the
 * one-shot fields (interact, melee) are true only on the step the press belongs to.
 */
export function stepWorld(state, dt, ctrl) {
  let events = 0;
  if (state.over) return events;
  state.time += dt;
  const player = state.player;
  player.meleeCd = Math.max(0, player.meleeCd - dt);
  player.fireCd = Math.max(0, player.fireCd - dt);
  player.swing = Math.max(0, player.swing - dt);
  player.lastHurt += dt;
  if (player.lastHurt > PLAYER.regenDelay && player.hp > 0) {
    player.hp = Math.min(PLAYER.maxHealth, player.hp + PLAYER.regenPerSecond * dt);
  }

  if (player.car) events |= drivePlayerCar(state, dt, ctrl);
  else events |= walkPlayer(state, dt, ctrl);

  events |= updateBullets(state, dt);
  updateTraffic(state, dt, state.random);
  state.trafficTimer -= dt;
  if (state.trafficTimer <= 0) {
    state.trafficTimer = 1.5;
    topUpTraffic(state, state.random);
  }
  updatePeds(state, dt);
  events |= collideCarsAndPeds(state, dt);
  events |= updatePolice(state, dt, state.random);
  events |= updateMissions(state, dt);

  // Heat cools only while no patrol is close enough to keep the pressure on.
  const focus = player.car ?? player;
  let copNear = false;
  for (const car of state.cars) {
    if (car.kind !== KIND_POLICE) continue;
    const dx = car.x - focus.x;
    const dy = car.y - focus.y;
    if (dx * dx + dy * dy < 430 * 430) {
      copNear = true;
      break;
    }
  }
  if (!copNear) state.heat = Math.max(0, state.heat - HEAT.decayPerSecond * dt);

  computePrompt(state);
  state.camX = Math.min(state.city.width - VIEW.width, Math.max(0, focus.x - VIEW.width / 2));
  state.camY = Math.min(state.city.height - VIEW.height, Math.max(0, focus.y - VIEW.height / 2));
  return events;
}
