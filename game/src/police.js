// The Palmera PD: a wanted level from the player's heat, patrol cars that spawn off-screen
// and hunt, a bust that builds while a cop is close and the player is slow, and — at three
// stars and up — officers who shoot. Losing the heat is simple: break away, stay unwatched,
// and it cools on its own (the world handles the cooling).
import { CAR, HEAT, KIND_POLICE, POLICE, POLICE_COLOR } from './config.js';
import { avenueX, avenueY } from './city.js';
import { EVENT_BUSTED, EVENT_SHOT } from './events.js';

/** The wanted level, 0 to 5: one star per 100 heat, and the first star comes free of charge. */
export function wantedStars(state) {
  if (state.heat <= 0) return 0;
  return Math.min(5, 1 + Math.floor(state.heat / HEAT.perStar));
}

/** True when a living pedestrian or a police car is close enough to see a crime at (x, y). */
export function isWitnessed(state, x, y) {
  const range = HEAT.witnessRange;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < range * range) return true;
  }
  for (const car of state.cars) {
    if (car.kind !== KIND_POLICE) continue;
    const dx = car.x - x;
    const dy = car.y - y;
    if (dx * dx + dy * dy < (range + 80) * (range + 80)) return true;
  }
  return false;
}

/** Where the police hunt: the player's car when driving, the player on foot otherwise. */
export function playerFocus(state) {
  return state.player.car ?? state.player;
}

function spawnPolice(state, random) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const col = Math.floor(random() * 8);
    const row = Math.floor(random() * 6);
    const x = avenueX(col);
    const y = avenueY(row);
    const dx = x - state.player.x;
    const dy = y - state.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < POLICE.spawnDistance || dist > 1150) continue;
    state.cars.push({
      x, y, angle: Math.atan2(state.player.y - y, state.player.x - x), speed: 0,
      color: POLICE_COLOR, kind: KIND_POLICE, hp: CAR.health * 1.5, driver: 'police',
      shootTimer: 1 + random(), stuckTimer: 0, reverseTimer: 0,
    });
    return;
  }
}

function drivePolice(state, car, dt) {
  const focus = playerFocus(state);
  let targetX = focus.x;
  let targetY = focus.y;
  if (car.reverseTimer > 0) {
    car.reverseTimer -= dt;
    car.speed = Math.max(-70, car.speed - POLICE.accel * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    return;
  }
  const dx = targetX - car.x;
  const dy = targetY - car.y;
  const distance = Math.hypot(dx, dy);
  const wanted = Math.atan2(dy, dx);
  let turn = wanted - car.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  car.angle += Math.max(-1, Math.min(1, turn * 2.6)) * CAR.turnRate * dt;
  // Rubber-band just enough to keep the chase honest: far away they hurry, close up they match.
  const cap = distance > 640 ? POLICE.maxSpeed * 1.12 : distance < 130 ? POLICE.maxSpeed * 0.72 : POLICE.maxSpeed;
  if (car.speed < cap) car.speed = Math.min(cap, car.speed + POLICE.accel * dt);
  else car.speed = Math.max(cap, car.speed - CAR.brake * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (Math.abs(car.speed) < 14 && distance > 90) {
    car.stuckTimer += dt;
    if (car.stuckTimer > 1.1) {
      car.stuckTimer = 0;
      car.reverseTimer = 0.55;
    }
  } else car.stuckTimer = 0;
}

export function updatePolice(state, dt, random) {
  let events = 0;
  const stars = wantedStars(state);
  const focus = playerFocus(state);

  let count = 0;
  for (const car of state.cars) if (car.kind === KIND_POLICE) count += 1;
  if (count < Math.min(stars, POLICE.maxCars)) spawnPolice(state, random);

  // Patrols give up and drift off once the heat is gone and they are far away.
  for (let index = state.cars.length - 1; index >= 0; index -= 1) {
    const car = state.cars[index];
    if (car.kind !== KIND_POLICE) continue;
    const dx = car.x - focus.x;
    const dy = car.y - focus.y;
    if ((stars === 0 && dx * dx + dy * dy > 640 * 640) || dx * dx + dy * dy > 1500 * 1500) {
      state.cars.splice(index, 1);
    }
  }

  let nearest = Infinity;
  for (const car of state.cars) {
    if (car.kind !== KIND_POLICE || car.hp <= 0) continue;
    drivePolice(state, car, dt);
    const dx = car.x - focus.x;
    const dy = car.y - focus.y;
    const dist = Math.hypot(dx, dy);
    if (dist < nearest) nearest = dist;
    // At three stars the PD stops asking nicely.
    if (stars >= POLICE.shootStars && dist < POLICE.shootRange) {
      car.shootTimer -= dt;
      if (car.shootTimer <= 0) {
        car.shootTimer = POLICE.shootInterval * (0.8 + random() * 0.5);
        const angle = Math.atan2(focus.y - car.y, focus.x - car.x) + (random() - 0.5) * 0.24;
        state.bullets.push({ x: car.x, y: car.y, angle, speed: 640, travelled: 0, range: POLICE.shootRange + 60, fromPolice: true });
        events |= EVENT_SHOT;
      }
    }
  }
  state.nearestCop = nearest === Infinity ? null : nearest;

  // The bust: a cop close by while the player is slow or on foot fills the ring.
  const focusSpeed = state.player.car ? Math.abs(state.player.car.speed) : state.player.speedMag;
  if (stars > 0 && nearest < POLICE.bustRadius && focusSpeed < 34 && !state.over) {
    state.bust += dt / (state.player.car ? POLICE.bustTimeCar : POLICE.bustTimeFoot);
    if (state.bust >= 1) {
      state.bust = 1;
      state.over = 'busted';
      events |= EVENT_BUSTED;
    }
  } else {
    state.bust = Math.max(0, state.bust - dt * 1.3);
  }
  return events;
}
