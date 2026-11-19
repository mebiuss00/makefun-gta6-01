// All sound is synthesised with WebAudio — no files. A tiny step sequencer plays a laid-back
// tropical loop, an oscillator hums with the car the player drives, a two-tone siren swells
// as police close in, and one-shot blips cover shots, hits, pickups and cash. The context is
// created on the first user gesture (browsers refuse it sooner) and every call is safe before
// that: the game is simply silent until the player first presses a key.

const MUSIC_STEPS = [0, -1, 3, -1, 5, -1, 3, -1, 0, -1, 3, -1, 7, -1, 5, 3, -4, -1, 0, -1, 3, -1, 0, -1, -2, -1, 2, -1, 3, -1, 2, -1];
const MUSIC_ROOT = 220; // A3; the pattern above is semitone offsets from it.
const STEP_SECONDS = 0.24;

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = 0;
  let musicStep = 0;
  let sirenPhase = 0;

  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain();
      master.gain.value = 0.42;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain).connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'square';
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
    } catch {
      context = null;
    }
  }

  function blip(freq, seconds, type, volume, slideTo) {
    if (!context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + seconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + seconds);
  }

  function noise(seconds, volume) {
    if (!context) return;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(master);
    source.start();
  }

  function musicTick(dt) {
    musicTimer -= dt;
    if (musicTimer > 0) return;
    musicTimer += STEP_SECONDS;
    const offset = MUSIC_STEPS[musicStep % MUSIC_STEPS.length];
    musicStep += 1;
    if (offset === -1) return;
    const freq = MUSIC_ROOT * 2 ** (offset / 12);
    blip(freq, 0.22, 'triangle', 0.05);
    if (musicStep % 8 === 0) blip(MUSIC_ROOT / 2, 0.5, 'sine', 0.07);
  }

  return {
    unlock,
    /** Called every frame: drives the music, the engine hum and the siren. */
    update(dt, driveSpeedRatio, nearestCopDistance) {
      if (!context) return;
      musicTick(dt);
      const engineTarget = driveSpeedRatio === null ? 0 : 0.028 + Math.abs(driveSpeedRatio) * 0.05;
      engineGain.gain.setTargetAtTime(engineTarget, context.currentTime, 0.09);
      if (driveSpeedRatio !== null) engineOsc.frequency.setTargetAtTime(55 + Math.abs(driveSpeedRatio) * 130, context.currentTime, 0.09);
      if (nearestCopDistance !== null && nearestCopDistance < 560) {
        sirenPhase += dt * 2.4;
        sirenOsc.frequency.value = Math.floor(sirenPhase) % 2 === 0 ? 680 : 920;
        sirenGain.gain.setTargetAtTime(0.016 * (1 - nearestCopDistance / 560) + 0.004, context.currentTime, 0.1);
      } else {
        sirenGain.gain.setTargetAtTime(0, context.currentTime, 0.12);
      }
    },
    shot() {
      noise(0.09, 0.16);
      blip(190, 0.08, 'square', 0.05, 60);
    },
    melee() {
      blip(120, 0.09, 'sine', 0.16, 50);
    },
    hit() {
      noise(0.06, 0.1);
    },
    hurt() {
      blip(220, 0.16, 'sawtooth', 0.09, 90);
    },
    door() {
      blip(320, 0.07, 'sine', 0.1, 210);
    },
    pickup() {
      blip(660, 0.09, 'triangle', 0.12);
      setTimeout(() => blip(990, 0.12, 'triangle', 0.12), 70);
    },
    cash() {
      blip(880, 0.08, 'triangle', 0.12);
      setTimeout(() => blip(1174, 0.1, 'triangle', 0.12), 60);
      setTimeout(() => blip(1568, 0.16, 'triangle', 0.12), 130);
    },
    missionStart() {
      blip(523, 0.12, 'triangle', 0.1);
      setTimeout(() => blip(784, 0.18, 'triangle', 0.1), 90);
    },
    busted() {
      blip(392, 0.2, 'square', 0.08);
      setTimeout(() => blip(311, 0.2, 'square', 0.08), 160);
      setTimeout(() => blip(233, 0.34, 'square', 0.08), 320);
    },
    wasted() {
      blip(330, 0.5, 'sawtooth', 0.09, 55);
    },
  };
}
