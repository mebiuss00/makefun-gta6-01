// The story: three jobs for Rosa Delgado, who runs the garage on 3rd and Coral and always
// needs a driver who does not ask questions — then, once her nephew is safe, an endless
// string of small errands for pocket money. Each mission is a short chain of objectives;
// this module watches the world, notices arrivals, pays out and moves the story on.
import { HEAT, REWARD } from './config.js';
import { EVENT_CASH, EVENT_MISSION, EVENT_PICKUP } from './events.js';

export const MISSIONS = [
  {
    title: 'Harbor Run',
    reward: REWARD.mission1,
    intro: 'Rosa: "A crate of ceramic tiles just came in at the docks. Fetch it, take it to the Grand Palmera — and do not open it."',
  },
  {
    title: 'Golden Hour',
    reward: REWARD.mission2,
    intro: 'Rosa: "A collector has donated a gold convertible to the Marina lot. It belongs in my garage now. Bring it home, gently."',
  },
  {
    title: 'Hot Run',
    reward: REWARD.mission3,
    intro: 'Rosa: "My nephew Leo just landed at the strip, and half the PD is curious. Pick him up and get him to Casa Segura."',
  },
];

const REACH = 66;

export function createMissions(city) {
  return {
    index: 0,
    stage: 0,
    storyDone: false,
    objective: null,
    objectiveText: '',
    errand: null,
    errandCount: 0,
  };
}

function setObjective(state, x, y, text) {
  state.mission.objective = { x, y };
  state.mission.objectiveText = text;
}

function notice(state, title, text) {
  state.notice = { title, text, ttl: 6.5 };
}

export function startMission(state, index) {
  const mission = state.mission;
  mission.index = index;
  mission.stage = 0;
  const def = MISSIONS[index];
  notice(state, `Mission ${index + 1} — ${def.title}`, def.intro);
  const marks = state.city.landmarks;
  if (index === 0) setObjective(state, marks.docks.door.x, marks.docks.door.y, 'Pick up the crate at Palmera Docks');
  else if (index === 1) setObjective(state, state.goldCar.x, state.goldCar.y, 'Steal the gold convertible at Marina Lot');
  else setObjective(state, marks.strip.door.x, marks.strip.door.y, 'Pick up Leo at Palmera Strip');
}

function payAndAdvance(state, events) {
  const def = MISSIONS[state.mission.index];
  state.player.money += def.reward;
  state.stats.earned += def.reward;
  events |= EVENT_CASH | EVENT_MISSION;
  if (state.mission.index >= MISSIONS.length - 1) {
    state.mission.storyDone = true;
    state.mission.index = MISSIONS.length;
    notice(state, 'Story complete', `Rosa: "Leo is safe, Dash. Palmera is yours now — come by the garage when you want work." (+$${def.reward})`);
    startErrand(state);
  } else {
    notice(state, `${def.title} — done`, `Rosa wired you $${def.reward}.`);
    startMission(state, state.mission.index + 1);
  }
  return events;
}

const ERRAND_SPOTS = ['hotel', 'docks', 'garage', 'marina', 'hospital', 'safehouse', 'strip', 'police'];

export function startErrand(state) {
  const mission = state.mission;
  const marks = state.city.landmarks;
  const from = ERRAND_SPOTS[Math.floor(state.random() * ERRAND_SPOTS.length)];
  let to = ERRAND_SPOTS[Math.floor(state.random() * ERRAND_SPOTS.length)];
  if (to === from) to = ERRAND_SPOTS[(ERRAND_SPOTS.indexOf(from) + 3) % ERRAND_SPOTS.length];
  mission.errand = { from, to, phase: 'pickup' };
  mission.errandCount += 1;
  setObjective(state, marks[from].door.x, marks[from].door.y, `Errand: pick up at ${marks[from].name}`);
}

function near(state, x, y, radius) {
  const focus = state.player.car ?? state.player;
  const dx = focus.x - x;
  const dy = focus.y - y;
  return dx * dx + dy * dy < radius * radius;
}

export function updateMissions(state, dt) {
  let events = 0;
  const mission = state.mission;
  const marks = state.city.landmarks;
  if (state.notice) {
    state.notice.ttl -= dt;
    if (state.notice.ttl <= 0) state.notice = null;
  }
  if (state.over) return events;

  if (mission.storyDone) {
    const errand = mission.errand;
    if (!errand) return events;
    const target = errand.phase === 'pickup' ? marks[errand.from].door : marks[errand.to].door;
    if (near(state, target.x, target.y, REACH)) {
      if (errand.phase === 'pickup') {
        errand.phase = 'drop';
        events |= EVENT_PICKUP;
        setObjective(state, marks[errand.to].door.x, marks[errand.to].door.y, `Errand: deliver to ${marks[errand.to].name}`);
        notice(state, 'Errand', `Package on board. Take it to ${marks[errand.to].name}.`);
      } else {
        state.player.money += REWARD.errand;
        state.stats.earned += REWARD.errand;
        events |= EVENT_CASH;
        notice(state, 'Errand done', `+$${REWARD.errand}. Rosa has more work when you want it.`);
        startErrand(state);
      }
    }
    return events;
  }

  if (mission.index === 0) {
    if (mission.stage === 0 && near(state, marks.docks.door.x, marks.docks.door.y, REACH)) {
      mission.stage = 1;
      events |= EVENT_PICKUP;
      setObjective(state, marks.hotel.door.x, marks.hotel.door.y, 'Deliver the crate to the Grand Palmera Hotel');
      notice(state, 'Harbor Run', 'Crate on board. The Grand Palmera is expecting it.');
    } else if (mission.stage === 1 && near(state, marks.hotel.door.x, marks.hotel.door.y, REACH)) {
      events |= payAndAdvance(state, 0);
    }
  } else if (mission.index === 1) {
    if (mission.stage === 0) {
      setObjective(state, state.goldCar.x, state.goldCar.y, 'Steal the gold convertible at Marina Lot');
      if (state.player.car === state.goldCar) {
        mission.stage = 1;
        notice(state, 'Golden Hour', 'That is the car. The PD noticed too — get it to Rosa\'s Garage.');
      }
    } else {
      setObjective(state, marks.garage.door.x, marks.garage.door.y, 'Deliver the gold convertible to Rosa\'s Garage');
      if (state.player.car === state.goldCar && near(state, marks.garage.door.x, marks.garage.door.y, REACH + 14)) {
        events |= payAndAdvance(state, 0);
      }
    }
  } else if (mission.index === 2) {
    if (mission.stage === 0 && near(state, marks.strip.door.x, marks.strip.door.y, REACH)) {
      mission.stage = 1;
      events |= EVENT_PICKUP;
      state.heat = Math.max(state.heat, HEAT.perStar * 2 + 20); // three stars, on the house
      setObjective(state, marks.safehouse.door.x, marks.safehouse.door.y, 'Get Leo to Casa Segura');
      notice(state, 'Hot Run', 'Leo is in. Every cop in Palmera just heard — drive!');
    } else if (mission.stage === 1 && near(state, marks.safehouse.door.x, marks.safehouse.door.y, REACH)) {
      events |= payAndAdvance(state, 0);
    }
  }
  return events;
}
