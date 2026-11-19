// Combat: fists and a pistol for the player on foot, bullets for both sides, and the damage
// that ends with someone down — a pedestrian on the pavement, a car smoking at the kerb, or
// the player wasted. Crimes the city sees add heat; crimes it does not, do not.
import { CAR, HEAT, KIND_POLICE, PLAYER } from './config.js';
import { EVENT_HIT, EVENT_HURT, EVENT_MELEE, EVENT_PED_DOWN, EVENT_SHOT, EVENT_WASTED } from './events.js';
import { isWitnessed, playerFocus } from './police.js';
import { sidewalkRectAt } from './city.js';

export function damagePlayer(state, amount) {
  if (state.over) return 0;
  state.player.hp -= amount;
  state.player.lastHurt = 0;
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.over = 'wasted';
    return EVENT_HURT | EVENT_WASTED;
  }
  return EVENT_HURT;
}

export function damagePed(state, ped, amount) {
  if (ped.state === 'down') return 0;
  ped.hp -= amount;
  if (ped.hp <= 0) {
    ped.state = 'down';
    ped.downTimer = 7;
    return EVENT_PED_DOWN;
  }
  ped.state = 'flee';
  ped.fleeTimer = 2.6;
  ped.fleeFrom = { x: state.player.x, y: state.player.y };
  return 0;
}

function damageCar(state, car, amount) {
  car.hp -= amount;
  if (car.hp <= 0 && !car.disabled) {
    car.disabled = true;
    car.speed = 0;
    if (car.driver === 'traffic') {
      // The driver bails out and runs for it.
      car.driver = null;
      state.peds.push({
        x: car.x + 20, y: car.y + 10, angle: 0, hp: 40, state: 'flee', fleeTimer: 3,
        fleeFrom: { x: state.player.x, y: state.player.y }, color: '#e07a5f',
        rect: sidewalkRectAt(car.x, car.y), corner: 0, downTimer: 0, speedFactor: 1,
      });
    }
  }
}

/** A swing of the fists in the way the player faces. */
export function tryMelee(state) {
  const player = state.player;
  if (player.car || player.meleeCd > 0 || state.over) return 0;
  player.meleeCd = PLAYER.meleeCooldown;
  player.swing = 0.16;
  let events = EVENT_MELEE;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    if (dx * dx + dy * dy > (PLAYER.meleeRange + 8) * (PLAYER.meleeRange + 8)) continue;
    let diff = Math.atan2(dy, dx) - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > PLAYER.meleeArc) continue;
    const killed = ped.hp <= PLAYER.meleeDamage;
    events |= damagePed(state, ped, PLAYER.meleeDamage) | EVENT_HIT;
    if (isWitnessed(state, ped.x, ped.y)) state.heat = Math.min(HEAT.max, state.heat + (killed ? HEAT.meleeKill : HEAT.meleeHit));
  }
  return events;
}

/** One pistol shot toward the aim point. */
export function tryFire(state, aimX, aimY) {
  const player = state.player;
  if (player.car || player.fireCd > 0 || state.over) return 0;
  player.fireCd = 1 / PLAYER.fireRate;
  const angle = Math.atan2(aimY - player.y, aimX - player.x);
  player.angle = angle;
  state.bullets.push({
    x: player.x + Math.cos(angle) * 14,
    y: player.y + Math.sin(angle) * 14,
    angle, speed: PLAYER.bulletSpeed, travelled: 0, range: PLAYER.bulletRange, fromPolice: false,
  });
  state.stats.shots += 1;
  if (isWitnessed(state, player.x, player.y)) state.heat = Math.min(HEAT.max, state.heat + HEAT.shotFired);
  // Gunfire panics the pavement nearby.
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    if (dx * dx + dy * dy < 210 * 210 && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeTimer = 2.2;
      ped.fleeFrom = { x: player.x, y: player.y };
    }
  }
  return EVENT_SHOT;
}

function pointInBuilding(state, x, y) {
  for (const b of state.city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

export function updateBullets(state, dt) {
  let events = 0;
  for (let index = state.bullets.length - 1; index >= 0; index -= 1) {
    const bullet = state.bullets[index];
    let dead = false;
    // Two substeps a frame, so a fast bullet cannot jump clean over a thin target.
    for (let sub = 0; sub < 2 && !dead; sub += 1) {
      const step = (bullet.speed * dt) / 2;
      bullet.x += Math.cos(bullet.angle) * step;
      bullet.y += Math.sin(bullet.angle) * step;
      bullet.travelled += step;
      if (bullet.travelled > bullet.range || pointInBuilding(state, bullet.x, bullet.y)) {
        dead = true;
        break;
      }
      if (bullet.fromPolice) {
        const focus = playerFocus(state);
        const radius = state.player.car ? CAR.radius : 10;
        const dx = focus.x - bullet.x;
        const dy = focus.y - bullet.y;
        if (dx * dx + dy * dy < radius * radius) {
          dead = true;
          if (state.player.car) damageCar(state, state.player.car, 4);
          else events |= damagePlayer(state, 6);
        }
      } else {
        for (const ped of state.peds) {
          if (ped.state === 'down') continue;
          const dx = ped.x - bullet.x;
          const dy = ped.y - bullet.y;
          if (dx * dx + dy * dy < 100) {
            dead = true;
            const killed = ped.hp <= PLAYER.bulletDamage;
            events |= damagePed(state, ped, PLAYER.bulletDamage) | EVENT_HIT;
            if (isWitnessed(state, ped.x, ped.y)) state.heat = Math.min(HEAT.max, state.heat + (killed ? HEAT.meleeKill : HEAT.meleeHit));
            break;
          }
        }
        if (dead) break;
        for (const car of state.cars) {
          if (car === state.player.car) continue;
          const dx = car.x - bullet.x;
          const dy = car.y - bullet.y;
          if (dx * dx + dy * dy < (CAR.radius + 2) * (CAR.radius + 2)) {
            dead = true;
            damageCar(state, car, PLAYER.bulletDamage);
            events |= EVENT_HIT;
            if (car.kind === KIND_POLICE) state.heat = Math.min(HEAT.max, state.heat + HEAT.ramPolice);
            else if (isWitnessed(state, car.x, car.y)) state.heat = Math.min(HEAT.max, state.heat + HEAT.shotHitCar);
            break;
          }
        }
      }
    }
    if (dead) state.bullets.splice(index, 1);
  }
  return events;
}
