// Keyboard and mouse input. Held keys give movement axes; one-shot presses (confirm, pause,
// interact, melee) are queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice. The mouse aims and fires.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_MELEE = 8;
export const ACTION_NEWGAME = 16;

const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const MELEE = new Set(['KeyF', 'KeyJ']);

const TRACKED = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'Enter',
  'KeyP', 'Escape', 'KeyE', 'KeyF', 'KeyJ', 'KeyN', 'ShiftLeft', 'ShiftRight',
]);

export function createInput(target) {
  const held = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (!TRACKED.has(event.code)) return;
    held.add(event.code);
    if (!event.repeat) {
      if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
      else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
      else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
      else if (MELEE.has(event.code)) actions |= ACTION_MELEE;
      else if (event.code === 'KeyN') actions |= ACTION_NEWGAME;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  target.addEventListener('pointerdown', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });
  window.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });

  return {
    /** Movement axes, each -1, 0 or 1, from WASD or the arrow keys. */
    moveX() {
      return ((held.has('KeyD') || held.has('ArrowRight')) ? 1 : 0) - ((held.has('KeyA') || held.has('ArrowLeft')) ? 1 : 0);
    },
    moveY() {
      return ((held.has('KeyS') || held.has('ArrowDown')) ? 1 : 0) - ((held.has('KeyW') || held.has('ArrowUp')) ? 1 : 0);
    },
    /** True while the trigger is held: the mouse button, or Space. */
    firing() {
      return mouse.down || held.has('Space');
    },
    /** True while either Shift key is held: run on foot. */
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** The mouse position in window pixels; the loop turns it into a world aim point. */
    mouse,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
