// Screenshot staging. Each shot resets the world (the caller rebuilds it from the seed) and
// returns a script: how many fixed steps to run, the control input for each step, and which
// screen to paint at the end. The scripts are pure functions of the step count, so a shot is
// the same picture on every machine — a living title backdrop, a delivery on foot, a police
// chase at four stars, and the story's end at Casa Segura.
import { STEP } from './config.js';
import { avenueX, avenueY } from './city.js';
import { startMission } from './missions.js';
import { SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { moveX: 0, moveY: 0, run: false, interact: false, melee: false, firing: false, aimX: 0, aimY: 0 };

function seconds(n) {
  return Math.round(n / STEP);
}

export function stageShot(name, state) {
  const marks = state.city.landmarks;
  if (name === 'play') {
    // Dario on foot, two blocks out from the docks, hurrying to the crate with traffic passing.
    state.player.x = marks.docks.door.x - 250;
    state.player.y = marks.docks.door.y + 120;
    return {
      screen: SCREEN_PLAY,
      steps: seconds(4.5),
      control(step, world) {
        const target = world.mission.objective ?? marks.docks.door;
        const dx = target.x - world.player.x;
        const dy = target.y - world.player.y;
        return {
          ...IDLE,
          moveX: Math.abs(dx) > 10 ? Math.sign(dx) : 0,
          moveY: Math.abs(dy) > 10 ? Math.sign(dy) : 0,
          run: true,
        };
      },
    };
  }
  if (name === 'chase') {
    // Leo is in, the heat is on: the gold car eastbound on the middle avenue, four stars up.
    startMission(state, 2);
    state.mission.stage = 1;
    state.mission.objective = { x: marks.safehouse.door.x, y: marks.safehouse.door.y };
    state.mission.objectiveText = 'Get Leo to Casa Segura';
    const car = state.goldCar;
    car.x = avenueX(3);
    car.y = avenueY(2) + 25;
    car.angle = 0;
    car.driver = 'player';
    state.player.car = car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.heat = 320;
    return {
      screen: SCREEN_PLAY,
      steps: seconds(6),
      control(step, world) {
        const driven = world.player.car;
        if (!driven) return IDLE;
        let diff = 0 - driven.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const drift = driven.y - (avenueY(2) + 25);
        return {
          ...IDLE,
          moveY: -1,
          moveX: Math.abs(diff) > 0.05 ? Math.sign(diff) : (Math.abs(drift) > 26 ? (drift > 0 ? -1 : 1) : 0),
        };
      },
    };
  }
  if (name === 'end') {
    // The story told: Leo safe, Rosa paid, Dario standing outside Casa Segura.
    state.mission.storyDone = true;
    state.mission.index = 3;
    state.mission.objective = null;
    state.mission.objectiveText = '';
    state.player.money = 1450;
    state.stats.earned = 1450;
    state.stats.jacked = 6;
    state.player.x = marks.safehouse.door.x;
    state.player.y = marks.safehouse.door.y + 30;
    state.player.angle = Math.PI / 2;
    return {
      screen: SCREEN_COMPLETE,
      steps: seconds(2.5),
      control() {
        return IDLE;
      },
    };
  }
  // 'start': the title over a living downtown, camera parked above the central avenues.
  state.camOverride = {
    x: Math.min(state.city.width - 1280, Math.max(0, avenueX(3) - 640)),
    y: Math.min(state.city.height - 720, Math.max(0, avenueY(2) - 360)),
  };
  return {
    screen: SCREEN_TITLE,
    steps: seconds(3.5),
    control() {
      return IDLE;
    },
  };
}
