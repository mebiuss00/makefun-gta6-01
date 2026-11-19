// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The
// game moves between screens — title, play, paused, busted, wasted, story complete — and
// this module owns the moves, the sounds that answer the world's events, and the save game.
//
// ?seed=N fixes the city layout. ?shot=start|play|chase|end (with &seed=N) stages that scene
// instead of running the loop, paints it and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { applySave, createWorld, respawn, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MELEE, ACTION_NEWGAME, ACTION_PAUSE, createInput } from './input.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED,
} from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';
import { clearSave, loadSave, storeSave } from './save.js';
import {
  EVENT_BUSTED, EVENT_CARJACK, EVENT_CASH, EVENT_CRASH, EVENT_ENTER_CAR, EVENT_EXIT_CAR,
  EVENT_HIT, EVENT_HURT, EVENT_MELEE, EVENT_MISSION, EVENT_PED_DOWN, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED,
} from './events.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = createInput(canvas);
const renderer = createRenderer(canvas);
const audio = createAudio();
window.addEventListener('keydown', () => audio.unlock());
window.addEventListener('pointerdown', () => audio.unlock());

function announce(message) {
  if (status) status.textContent = message;
}

function snapshot(world) {
  return {
    money: world.player.money,
    hp: Math.round(world.player.hp),
    x: Math.round(world.player.x),
    y: Math.round(world.player.y),
    mission: world.mission.index,
    storyDone: world.mission.storyDone,
    stats: world.stats,
  };
}

/** Screenshot mode: stage the scene, run its script, paint it, and signal readiness. */
function runShot(name) {
  const world = createWorld(createRandom(seed));
  const script = stageShot(name, world);
  for (let step = 0; step < script.steps; step += 1) {
    stepWorld(world, STEP, script.control(step, world));
  }
  renderer.draw(world, script.screen, { hasSave: false, lastFine: 0 });
  renderer.draw(world, script.screen, { hasSave: false, lastFine: 0 });
  window.__shotReady = true;
  announce(`Palmera Heat — screenshot scene ${name}.`);
}

if (shot) {
  runShot(shot);
} else {
  runGame();
}

function runGame() {
  let world = createWorld(createRandom(seed));
  let save = loadSave();
  let screen = SCREEN_TITLE;
  let lastFine = 0;
  let saveTimer = 0;
  let celebrated = false;
  let lastNotice = null;
  announce('Palmera Heat. Press Enter to start.');

  function startRun(fresh) {
    if (fresh) {
      clearSave();
      save = null;
      world = createWorld(createRandom(seed));
    } else if (save) {
      applySave(world, save);
    }
    celebrated = world.mission.storyDone;
    screen = SCREEN_PLAY;
    audio.missionStart();
    announce('Palmera Heat — playing. Mission 1: Harbor Run.');
  }

  function react(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_MELEE) audio.melee();
    if (events & (EVENT_HIT | EVENT_PED_DOWN)) audio.hit();
    if (events & EVENT_HURT) audio.hurt();
    if (events & EVENT_CRASH) audio.hit();
    if (events & (EVENT_ENTER_CAR | EVENT_EXIT_CAR | EVENT_CARJACK)) audio.door();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CASH) {
      audio.cash();
      storeSave(snapshot(world));
      save = loadSave();
    }
    if (events & EVENT_MISSION) audio.missionStart();
    if (events & EVENT_BUSTED) {
      lastFine = Math.floor(world.player.money * 0.15);
      screen = SCREEN_BUSTED;
      audio.busted();
      announce('Busted. Press Enter to continue.');
    } else if (events & EVENT_WASTED) {
      lastFine = Math.floor(world.player.money * 0.1);
      screen = SCREEN_WASTED;
      audio.wasted();
      announce('Wasted. Press Enter to continue.');
    } else if ((events & EVENT_MISSION) && world.mission.storyDone && !celebrated) {
      celebrated = true;
      screen = SCREEN_COMPLETE;
      announce('Story complete. Press Enter to keep cruising.');
    }
  }

  let previous = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - previous) / 1000;
    previous = now;
    if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;
    let actions = input.takeActions();

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_NEWGAME) startRun(true);
      else if (actions & ACTION_CONFIRM) startRun(false);
      // The title backdrop is a living city: step it gently with nobody playing.
      accumulator += elapsed;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        stepWorld(world, STEP, { moveX: 0, moveY: 0, run: false, interact: false, melee: false, firing: false, aimX: 0, aimY: 0 });
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Palmera Heat — playing.');
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        respawn(world, screen === SCREEN_BUSTED ? 'busted' : 'wasted');
        storeSave(snapshot(world));
        save = loadSave();
        screen = SCREEN_PLAY;
        announce('Back on the street.');
      }
    } else if (screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Palmera Heat — free roam.');
      }
    } else {
      // Play.
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused. Press P to continue.');
      } else {
        accumulator += elapsed;
        const mouse = input.mouse;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          const aim = (mouse.x !== 0 || mouse.y !== 0)
            ? renderer.screenToWorld(mouse.x, mouse.y)
            : { x: world.player.x + Math.cos(world.player.angle) * 120, y: world.player.y + Math.sin(world.player.angle) * 120 };
          const events = stepWorld(world, STEP, {
            moveX: input.moveX(),
            moveY: input.moveY(),
            run: input.running(),
            interact: (actions & ACTION_INTERACT) !== 0,
            melee: (actions & ACTION_MELEE) !== 0,
            firing: input.firing(),
            aimX: aim.x,
            aimY: aim.y,
          });
          // One-shot presses belong to the first step of the frame only.
          actions &= ~(ACTION_INTERACT | ACTION_MELEE);
          react(events);
          if (screen !== SCREEN_PLAY) {
            accumulator = 0;
            break;
          }
        }
        saveTimer += elapsed;
        if (saveTimer > 12) {
          saveTimer = 0;
          storeSave(snapshot(world));
          save = loadSave();
        }
      }
    }

    if (world.notice && world.notice !== lastNotice) {
      lastNotice = world.notice;
      announce(world.notice.title);
    }

    const driven = world.player.car;
    audio.update(elapsed, driven ? driven.speed / (driven.topSpeed ?? 235) : null, world.nearestCop);
    renderer.draw(world, screen, { hasSave: save !== null, lastFine });
  }

  requestAnimationFrame(frame);
}
