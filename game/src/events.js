// Event flags: world.step returns a bitmask of these so the boot module can react — play a
// sound, save the game, change screens — without the simulation knowing about any of that.
export const EVENT_SHOT = 1;
export const EVENT_MELEE = 2;
export const EVENT_HIT = 4;
export const EVENT_HURT = 8;
export const EVENT_PED_DOWN = 16;
export const EVENT_CARJACK = 32;
export const EVENT_ENTER_CAR = 64;
export const EVENT_EXIT_CAR = 128;
export const EVENT_PICKUP = 256;
export const EVENT_CASH = 512;
export const EVENT_MISSION = 1024;
export const EVENT_BUSTED = 2048;
export const EVENT_WASTED = 4096;
export const EVENT_CRASH = 8192;
