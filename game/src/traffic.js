// Traffic: the cars Palmera's citizens drive. Each follows the avenue grid in the right-hand
// lane, choosing at every intersection whether to go straight or turn, slowing for the car
// ahead. Parked cars and the gold convertible are placed by the world; this module only moves
// cars that have a traffic driver, and keeps their number up as the player roams.
import { CAR, CITY, KIND_TRAFFIC, TRAFFIC_COUNT } from './config.js';
import { avenueX, avenueY } from './city.js';

const PITCH = CITY.road + CITY.block;

/** A fresh traffic car at an intersection, heading along one avenue in its lane. */
export function makeTrafficCar(random, x, y, axis, dir) {
  const color = ['#d94f30', '#3e7cb1', '#f2c14e', '#81b29a', '#e07a5f', '#6d6875', '#f4f1de', '#457b9d'][Math.floor(random() * 8)];
  return {
    x, y,
    angle: axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
    speed: 0,
    color,
    kind: KIND_TRAFFIC,
    hp: CAR.health,
    driver: 'traffic',
    axis, dir,
    avenue: 0, // index of the avenue it travels on (row for axis x, column for axis y)
    targetX: x, targetY: y,
    factor: 0.82 + random() * 0.36,
    stuck: 0,
  };
}

/** The lane-correct point where the car will next decide its way: an intersection ahead. */
function nextTarget(random, car) {
  if (car.axis === 'x') {
    const current = Math.round((car.x - CITY.road / 2) / PITCH);
    const ahead = current + car.dir;
    const steps = 1 + Math.floor(random() * 2);
    const targetCol = Math.min(CITY.cols, Math.max(0, ahead + car.dir * (steps - 1)));
    car.targetX = avenueX(targetCol);
    car.targetY = avenueY(car.avenue) + (car.dir > 0 ? CITY.lane : -CITY.lane);
  } else {
    const current = Math.round((car.y - CITY.road / 2) / PITCH);
    const ahead = current + car.dir;
    const steps = 1 + Math.floor(random() * 2);
    const targetRow = Math.min(CITY.rows, Math.max(0, ahead + car.dir * (steps - 1)));
    car.targetY = avenueY(targetRow);
    car.targetX = avenueX(car.avenue) + (car.dir > 0 ? -CITY.lane : CITY.lane);
  }
}

/** At an intersection: mostly straight on, sometimes a turn onto the crossing avenue. */
function chooseAtIntersection(random, car) {
  const roll = random();
  // Never aim off the edge of the world: turn back or turn aside instead.
  if (car.axis === 'x') {
    const col = Math.min(CITY.cols, Math.max(0, Math.round((car.x - CITY.road / 2) / PITCH)));
    if (col <= 0 && car.dir < 0) car.dir = 1;
    if (col >= CITY.cols && car.dir > 0) car.dir = -1;
  } else {
    const row = Math.min(CITY.rows, Math.max(0, Math.round((car.y - CITY.road / 2) / PITCH)));
    if (row <= 0 && car.dir < 0) car.dir = 1;
    if (row >= CITY.rows && car.dir > 0) car.dir = -1;
  }
  if (car.axis === 'x') {
    const col = Math.min(CITY.cols, Math.max(0, Math.round((car.x - CITY.road / 2) / PITCH)));
    if (roll < 0.42) {
      // Turn: new axis y, avenue = this column; direction away from the nearest edge bias.
      car.axis = 'y';
      car.avenue = col;
      car.dir = random() < 0.5 ? 1 : -1;
      if (car.y < CITY.road * 1.5) car.dir = 1;
      if (car.y > (CITY.rows * PITCH) - CITY.road) car.dir = -1;
    }
  } else {
    const row = Math.min(CITY.rows, Math.max(0, Math.round((car.y - CITY.road / 2) / PITCH)));
    if (roll < 0.42) {
      car.axis = 'x';
      car.avenue = row;
      car.dir = random() < 0.5 ? 1 : -1;
      if (car.x < CITY.road * 1.5) car.dir = 1;
      if (car.x > (CITY.cols * PITCH) - CITY.road) car.dir = -1;
    }
  }
  nextTarget(random, car);
}

/** Spawn traffic at a far intersection until the city feels lived in. */
export function topUpTraffic(state, random) {
  let count = 0;
  for (const car of state.cars) if (car.kind === KIND_TRAFFIC && car.driver === 'traffic') count += 1;
  let guard = 0;
  while (count < TRAFFIC_COUNT && guard < 24) {
    guard += 1;
    const col = Math.floor(random() * (CITY.cols + 1));
    const row = Math.floor(random() * (CITY.rows + 1));
    const x = avenueX(col);
    const y = avenueY(row);
    const dx = x - state.player.x;
    const dy = y - state.player.y;
    if (dx * dx + dy * dy < 520 * 520) continue;
    const axis = random() < 0.5 ? 'x' : 'y';
    const dir = random() < 0.5 ? 1 : -1;
    const car = makeTrafficCar(random, x, y, axis, dir);
    car.avenue = axis === 'x' ? row : col;
    // Sit in the correct lane for the heading.
    if (axis === 'x') car.y += dir > 0 ? CITY.lane : -CITY.lane;
    else car.x += dir > 0 ? -CITY.lane : CITY.lane;
    nextTarget(random, car);
    state.cars.push(car);
    count += 1;
  }
}

function steerToward(car, dt, targetX, targetY, maxSpeed) {
  const dx = targetX - car.x;
  const dy = targetY - car.y;
  const distance = Math.hypot(dx, dy);
  const wanted = Math.atan2(dy, dx);
  let turn = wanted - car.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, turn * 2.4));
  car.angle += steer * CAR.turnRate * dt * (car.speed < 0 ? -1 : 1);
  const slowForTurn = Math.max(0.35, 1 - Math.abs(turn) * 0.55);
  const goal = maxSpeed * slowForTurn;
  if (car.speed < goal) car.speed = Math.min(goal, car.speed + CAR.trafficAccel * dt);
  else car.speed = Math.max(goal, car.speed - CAR.brake * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return distance;
}

/** Move every traffic-driven car one step; returns nothing — collisions are the world's job. */
export function updateTraffic(state, dt, random) {
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || car.hp <= 0) continue;
    // Slow for a car ahead in the same lane.
    let goal = CAR.trafficSpeed * car.factor;
    for (const other of state.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 62 && side < 20) goal = Math.min(goal, Math.max(0, (ahead - 34) * 3));
    }
    const distance = steerToward(car, dt, car.targetX, car.targetY, goal);
    if (distance < 26) chooseAtIntersection(random, car);
  }
}
