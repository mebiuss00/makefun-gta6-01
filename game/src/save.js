// The save game: one JSON record in localStorage — cash, story progress, health, where the
// player stood, and a few lifetime stats for the end screen. Storage can be off (private
// windows); every function then quietly does nothing and the visit plays unsaved.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save !== 'object' || save === null || typeof save.money !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Unsaved visit: nothing to do.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing was stored anyway.
  }
}
