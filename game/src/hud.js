// The heads-up display, drawn in screen space over the world: health and cash, the wanted
// stars, the current objective, Rosa's messages as a banner, the contextual prompt, and the
// minimap — Palmera at a glance, with traffic, police, the gold car and the objective on it.
import { CITY, FONT, PALETTE, PLAYER } from './config.js';
import { MISSIONS } from './missions.js';
import { wantedStars } from './police.js';

function text(ctx, value, x, y, size, color, align) {
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function wrapText(ctx, value, x, y, maxWidth, lineHeight, size, color) {
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  const words = value.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else line = trial;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

export function drawMinimap(ctx, state, x, y, w, h) {
  const world = state.city;
  const sx = w / world.width;
  const sy = h / world.height;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 16, 22, 0.78)';
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.strokeRect(x - 6, y - 6, w + 12, h + 12);
  ctx.fillStyle = '#274b63';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#cbbd8d';
  ctx.fillRect(x, y, w, h);
  // Avenues.
  ctx.fillStyle = '#565b63';
  for (let i = 0; i <= CITY.cols; i += 1) ctx.fillRect(x + (i * (CITY.road + CITY.block)) * sx, y, CITY.road * sx, h);
  for (let j = 0; j <= CITY.rows; j += 1) ctx.fillRect(x, y + (j * (CITY.road + CITY.block)) * sy, w, CITY.road * sy);
  const dot = (wx, wy, color, size) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + wx * sx - size / 2, y + wy * sy - size / 2, size, size);
  };
  for (const car of state.cars) {
    if (car.kind === 'police') dot(car.x, car.y, PALETTE.policeDot, 5);
    else if (car === state.goldCar) dot(car.x, car.y, PALETTE.gold, 5);
  }
  const objective = state.mission.objective;
  if (objective) {
    const pulse = 5 + Math.sin(state.time * 5) * 1.6;
    ctx.beginPath();
    ctx.fillStyle = PALETTE.gold;
    ctx.arc(x + objective.x * sx, y + objective.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a small arrow in facing direction.
  const focus = state.player.car ?? state.player;
  ctx.save();
  ctx.translate(x + focus.x * sx, y + focus.y * sy);
  ctx.rotate(focus.angle);
  ctx.fillStyle = PALETTE.playerDot;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.4);
  ctx.lineTo(-5, 4.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function drawHud(ctx, state, width, height) {
  const player = state.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Health bar and cash, top left.
  ctx.fillStyle = 'rgba(10, 16, 22, 0.55)';
  ctx.fillRect(18, 16, 224, 30);
  ctx.fillStyle = player.hp > 30 ? PALETTE.health : PALETTE.healthLow;
  ctx.fillRect(21, 19, 218 * Math.max(0, player.hp) / PLAYER.maxHealth, 24);
  text(ctx, `DARIO — ${Math.ceil(player.hp)}`, 28, 37, 17, '#0d1117', 'left');
  text(ctx, `$${player.money}`, 20, 76, 30, PALETTE.gold, 'left');

  // Wanted stars, top right.
  const stars = wantedStars(state);
  let starText = '';
  for (let i = 0; i < 5; i += 1) starText += i < stars ? '★' : '☆';
  text(ctx, starText, width - 20, 44, 34, stars > 0 ? PALETTE.wanted : 'rgba(255,255,255,0.4)', 'right');
  if (state.player.car) {
    text(ctx, `${Math.round(Math.abs(state.player.car.speed) * 0.36)} km/h`, width - 20, 76, 20, PALETTE.text, 'right');
  }

  // Mission line, top centre — or Rosa's banner while she is talking.
  if (state.notice) {
    const bw = 640;
    const bx = (width - bw) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(bx, 14, bw, 86);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.strokeRect(bx, 14, bw, 86);
    text(ctx, state.notice.title, width / 2, 40, 20, PALETTE.gold, 'center');
    wrapText(ctx, state.notice.text, width / 2, 64, bw - 36, 19, 16, PALETTE.text);
  } else if (!state.mission.storyDone) {
    const def = MISSIONS[state.mission.index];
    text(ctx, def ? def.title : '', width / 2, 34, 19, PALETTE.gold, 'center');
    text(ctx, state.mission.objectiveText, width / 2, 58, 16, PALETTE.text, 'center');
  } else {
    text(ctx, 'Free roam — Rosa\'s errands pay $120', width / 2, 34, 19, PALETTE.gold, 'center');
    text(ctx, state.mission.objectiveText, width / 2, 58, 16, PALETTE.text, 'center');
  }

  // Contextual prompt, bottom centre.
  if (state.prompt) {
    ctx.font = `20px ${FONT}`;
    const w = ctx.measureText(state.prompt).width + 36;
    ctx.fillStyle = 'rgba(10, 16, 22, 0.66)';
    ctx.fillRect((width - w) / 2, height - 118, w, 34);
    text(ctx, state.prompt, width / 2, height - 94, 20, PALETTE.text, 'center');
  }

  drawMinimap(ctx, state, width - 216, height - 168, 196, 142);
  ctx.restore();
}
