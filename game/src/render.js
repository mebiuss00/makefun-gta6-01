// Drawing only: the world through a camera, then the HUD, then a panel for the screen the
// game is on. Palmera is drawn flat and sun-soaked — sand, pastel roofs, palm shade — with
// every building, car and pedestrian a few shapes each, so a frame stays cheap. Text that
// holds a number is rebuilt only when the number changes.
import { CAR, CITY, FONT, KIND_GOLD, KIND_POLICE, PALETTE, VIEW } from './config.js';
import { avenueX, avenueY, blockRect } from './city.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

function hash(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };
  let lastCam = { x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.ratio = ratio;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  function drawCity(state) {
    const city = state.city;
    // The peninsula: water all around, sand at the shore, then the grid.
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(lastCam.x - 60, lastCam.y - 60, VIEW.width + 120, VIEW.height + 120);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(-30, -30, city.width + 60, city.height + 60);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, 0, city.width, city.height);

    // Avenues.
    ctx.fillStyle = PALETTE.asphalt;
    for (let i = 0; i <= CITY.cols; i += 1) ctx.fillRect(avenueX(i) - CITY.road / 2, 0, CITY.road, city.height);
    for (let j = 0; j <= CITY.rows; j += 1) ctx.fillRect(0, avenueY(j) - CITY.road / 2, city.width, CITY.road);
    ctx.strokeStyle = 'rgba(232, 227, 213, 0.4)';
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    for (let i = 0; i <= CITY.cols; i += 1) {
      ctx.moveTo(avenueX(i), 0);
      ctx.lineTo(avenueX(i), city.height);
    }
    for (let j = 0; j <= CITY.rows; j += 1) {
      ctx.moveTo(0, avenueY(j));
      ctx.lineTo(city.width, avenueY(j));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Crosswalks.
    ctx.fillStyle = 'rgba(216, 211, 195, 0.35)';
    for (let i = 0; i <= CITY.cols; i += 1) {
      for (let j = 0; j <= CITY.rows; j += 1) {
        const x = avenueX(i);
        const y = avenueY(j);
        ctx.fillRect(x - CITY.road / 2 + 4, y - 34, CITY.road - 8, 9);
        ctx.fillRect(x - CITY.road / 2 + 4, y + 25, CITY.road - 8, 9);
        ctx.fillRect(x - 34, y - CITY.road / 2 + 4, 9, CITY.road - 8);
        ctx.fillRect(x + 25, y - CITY.road / 2 + 4, 9, CITY.road - 8);
      }
    }

    // Blocks: sidewalk first, then what stands on them.
    for (let row = 0; row < CITY.rows; row += 1) {
      for (let col = 0; col < CITY.cols; col += 1) {
        const rect = blockRect(col, row);
        ctx.fillStyle = PALETTE.sidewalk;
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      }
    }
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.parkGrass;
      ctx.fillRect(park.x + 10, park.y + 10, park.w - 20, park.h - 20);
    }
    for (const lot of city.lots) {
      ctx.fillStyle = PALETTE.asphaltDark;
      ctx.fillRect(lot.x + 6, lot.y + 6, lot.w - 12, lot.h - 12);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      for (const slot of lot.slots) {
        ctx.save();
        ctx.translate(slot.x, slot.y);
        ctx.rotate(slot.angle);
        ctx.strokeRect(-20, -11, 40, 22);
        ctx.restore();
      }
    }
    for (const b of city.buildings) {
      ctx.fillStyle = PALETTE.buildingShadow;
      ctx.fillRect(b.x + 9, b.y + 12, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      ctx.fillStyle = 'rgba(30, 25, 20, 0.18)';
      for (let wnd = 0; wnd < 6; wnd += 1) {
        const wx = b.x + 18 + hash(b.x, wnd * 3.1) * (b.w - 52);
        const wy = b.y + 18 + hash(b.y, wnd * 5.7) * (b.h - 52);
        ctx.fillRect(wx, wy, 15, 11);
      }
      if (b.name) text(b.name, b.x + b.w / 2, b.y + 24, 14, 'rgba(25, 22, 18, 0.6)', 'center', true);
    }
    // Landmark names for the open lots, the park and the strip.
    ctx.fillStyle = 'rgba(25, 22, 18, 0.5)';
    for (const key of Object.keys(city.landmarks)) {
      const mark = city.landmarks[key];
      if (mark.kind === 'building') continue;
      text(mark.name, mark.rect.x + mark.rect.w / 2, mark.rect.y + 26, 14, 'rgba(25,22,18,0.5)', 'center', true);
    }
    // Palms.
    for (const tree of city.trees) {
      ctx.fillStyle = '#8a6642';
      ctx.fillRect(tree.x - 2, tree.y - 2, 4, 5);
      ctx.fillStyle = '#3e8914';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y - 4, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#55a630';
      ctx.beginPath();
      ctx.arc(tree.x - 6, tree.y + 1, 7, 0, Math.PI * 2);
      ctx.arc(tree.x + 7, tree.y + 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(state) {
    const objective = state.mission.objective;
    if (!objective) return;
    const t = state.time;
    const grad = ctx.createLinearGradient(0, objective.y - 280, 0, objective.y);
    grad.addColorStop(0, 'rgba(255, 210, 63, 0)');
    grad.addColorStop(1, 'rgba(255, 210, 63, 0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(objective.x - 12, objective.y - 280, 24, 280);
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, 24 + Math.sin(t * 4) * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(objective.x, objective.y - 34 + Math.sin(t * 3.2) * 6);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }

  function drawCar(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(20, 18, 12, 0.3)';
    rr(ctx, -CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width, 6);
    ctx.fill();
    ctx.fillStyle = car.disabled ? '#5a5a5a' : car.color;
    rr(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(15, 23, 32, 0.88)';
    rr(ctx, -7, -CAR.width / 2 + 3, 17, CAR.width - 6, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 244, 190, 0.95)';
    ctx.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 3, 3, 4);
    ctx.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 7, 3, 4);
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-CAR.length / 2 + 5, -CAR.width / 2 - 2, 9, 4);
    ctx.fillRect(-CAR.length / 2 + 5, CAR.width / 2 - 2, 9, 4);
    ctx.fillRect(CAR.length / 2 - 14, -CAR.width / 2 - 2, 9, 4);
    ctx.fillRect(CAR.length / 2 - 14, CAR.width / 2 - 2, 9, 4);
    if (car.kind === KIND_POLICE) {
      ctx.fillStyle = '#f4f1de';
      rr(ctx, -6, -CAR.width / 2 + 2, 15, CAR.width - 4, 3);
      ctx.fill();
      const flash = Math.floor(time * 3.4) % 2 === 0;
      ctx.fillStyle = flash ? '#ef476f' : '#4cc9f0';
      ctx.fillRect(-3, -6, 6, 5);
      ctx.fillStyle = flash ? '#4cc9f0' : '#ef476f';
      ctx.fillRect(-3, 1, 6, 5);
    }
    if (car.kind === KIND_GOLD) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const tw = (time * 2 + car.x) % 1.4;
      ctx.fillRect(6 + tw * 6, -4, 2.4, 2.4);
      ctx.fillRect(-12, 3 - tw * 4, 2.4, 2.4);
    }
    ctx.restore();
    if (car.disabled || car.hp < 42) {
      ctx.fillStyle = 'rgba(90, 90, 90, 0.4)';
      const rise = (time * 14 + car.x) % 18;
      ctx.beginPath();
      ctx.arc(car.x + 8, car.y - 12 - rise, 5 + rise * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPed(ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(1.35);
      ctx.fillStyle = 'rgba(60, 55, 50, 0.85)';
      rr(ctx, -9, -4, 18, 8, 4);
      ctx.fill();
      ctx.fillStyle = '#eec39f';
      ctx.beginPath();
      ctx.arc(11, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(20, 18, 12, 0.25)';
      ctx.beginPath();
      ctx.arc(1.5, 2.5, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(0, 0, 6.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#eec39f';
      ctx.beginPath();
      ctx.arc(Math.cos(ped.angle) * 2, Math.sin(ped.angle) * 2, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.car) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = 'rgba(20, 18, 12, 0.3)';
    ctx.beginPath();
    ctx.arc(2, 3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#118ab2';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#073b4c';
    ctx.beginPath();
    ctx.arc(Math.cos(player.angle) * 3, Math.sin(player.angle) * 3, 4.6, 0, Math.PI * 2);
    ctx.fill();
    if (player.swing > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 24, player.angle - 0.9, player.angle + 0.7);
      ctx.stroke();
    }
    ctx.restore();
    if (state.bust > 0.02) {
      ctx.strokeStyle = PALETTE.danger;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 24, -Math.PI / 2, -Math.PI / 2 + state.bust * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawWorld(state) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW.width, VIEW.height);
    ctx.clip();
    ctx.translate(-lastCam.x, -lastCam.y);
    drawCity(state);
    drawMarker(state);
    for (const car of state.cars) drawCar(car, state.time);
    for (const ped of state.peds) drawPed(ped);
    drawPlayer(state);
    ctx.strokeStyle = '#ffe66d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const bullet of state.bullets) {
      ctx.moveTo(bullet.x - Math.cos(bullet.angle) * 11, bullet.y - Math.sin(bullet.angle) * 11);
      ctx.lineTo(bullet.x, bullet.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function panel(title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.52)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const w = 660;
    const h = 118 + lines.length * 27 + 56;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent ?? PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(title, VIEW.width / 2, y + 62, 42, accent ?? PALETTE.text, 'center', true);
    ctx.textBaseline = 'alphabetic';
    lines.forEach((line, index) => {
      text(line, VIEW.width / 2, y + 108 + index * 27, 18, PALETTE.muted, 'center', false);
    });
    if (prompt) text(prompt, VIEW.width / 2, y + h - 24, 20, PALETTE.gold, 'center', true);
  }

  function drawTitle(state, info) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, 'rgba(10, 12, 20, 0.42)');
    grad.addColorStop(0.55, 'rgba(10, 12, 20, 0.1)');
    grad.addColorStop(1, 'rgba(10, 12, 20, 0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textBaseline = 'alphabetic';
    text('PALMERA', VIEW.width / 2 + 3, 183, 96, 'rgba(0,0,0,0.35)', 'center', true);
    text('PALMERA', VIEW.width / 2, 180, 96, '#ffd23f', 'center', true);
    text('H E A T', VIEW.width / 2, 238, 44, '#fdfdf8', 'center', true);
    text('One city. One wheelman. Every favour comes with sirens.', VIEW.width / 2, 282, 21, PALETTE.text, 'center', false);
    const lines = [
      'WASD / arrows — walk and drive · E — enter or leave a car',
      'Mouse — aim · click or Space — shoot · F — fists · Shift — run',
      'Work Rosa\'s three jobs, mind the stars, do not get caught standing still.',
    ];
    lines.forEach((line, index) => text(line, VIEW.width / 2, 560 + index * 27, 18, PALETTE.muted, 'center', false));
    text(info.hasSave ? 'Enter — continue · N — new game' : 'Enter — start', VIEW.width / 2, 668, 23, PALETTE.gold, 'center', true);
  }

  /** Paint one frame: the world, the HUD on play screens, then the screen's own overlay. */
  function draw(state, screen, info) {
    lastCam = state.camOverride ?? { x: state.camX, y: state.camY };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, info);
      return;
    }
    if (screen !== SCREEN_BUSTED && screen !== SCREEN_WASTED) drawHud(ctx, state, VIEW.width, VIEW.height);
    if (screen === SCREEN_PAUSED) {
      panel('Paused', ['Palmera waits for no one. Well — just this once.'], 'P or Esc — back to it');
    } else if (screen === SCREEN_BUSTED) {
      panel('BUSTED', [`The PD takes $${info.lastFine} for the paperwork.`, 'You walk out of Palmera PD with a clean record and lighter pockets.'], 'Enter — back on the street', PALETTE.danger);
    } else if (screen === SCREEN_WASTED) {
      panel('WASTED', [`St. Coral patches you up for $${info.lastFine}.`, 'The city kept spinning without you. It always does.'], 'Enter — back on the street', PALETTE.danger);
    } else if (screen === SCREEN_COMPLETE) {
      panel('STORY COMPLETE', [
        `Cash earned: $${state.stats.earned} · Cars borrowed: ${state.stats.jacked}`,
        `Busted ${state.stats.busted} · Wasted ${state.stats.wasted} · Shots fired: ${state.stats.shots}`,
        'Leo is safe, Rosa is smiling, and Palmera is still yours to roam.',
      ], 'Enter — keep cruising', PALETTE.gold);
    }
  }

  /** Turn window pixels (a mouse position) into world coordinates. */
  function screenToWorld(sx, sy) {
    const deviceX = sx * view.ratio;
    const deviceY = sy * view.ratio;
    return {
      x: (deviceX - view.x) / view.scale + lastCam.x,
      y: (deviceY - view.y) / view.scale + lastCam.y,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
