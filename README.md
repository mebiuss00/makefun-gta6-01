# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mebiuss00/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mebiuss00/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Palmera Heat** — an original top-down open-world crime game that runs in the browser, written in plain JavaScript ES modules with no libraries, no build step and no network calls. You are Dario "Dash" Vega, a wheelman new in Palmera, a sun-soaked peninsula city of pastel roofs and palm shade. Rosa Delgado, who runs the garage on the west side, has work for a driver who does not ask questions.

**The city.** A 7×5 grid of avenues with working traffic that follows the lanes and chooses its way at every intersection, pedestrians strolling the sidewalks, parked cars in lots and at kerbs, and named places the story visits: the Grand Palmera Hotel, Palmera Docks, the Marina Lot, Palmera PD, St. Coral Hospital, the Palmera Strip and Casa Segura.

**The game.** Walk or drive anywhere (enter any parked car, carjack traffic that is slow enough). Crimes the city witnesses — carjacking, reckless driving, fists, gunfire — raise a five-star wanted level; police cars spawn off-screen, chase, ram, and at three stars start shooting. Stay close and slow in front of a cop and the bust ring fills; break away and stay unseen and the heat cools. Get busted or wasted and you wake up at the PD or the hospital, poorer by the fine. Combat is fists (F) and a mouse-aimed pistol (click or Space), with health on pedestrians, cars that smoke and die, and a player health bar that recovers when the fighting stops.

**The story.** Three missions from Rosa form one thread — *Harbor Run* (fetch a crate from the docks to the Grand Palmera), *Golden Hour* (steal the gold convertible from the Marina Lot and bring it home), and *Hot Run* (pick up her nephew Leo at the strip under three stars of heat and get him to Casa Segura) — paying $300, $450 and $700. After the story, Rosa's repeatable errands pay $120 a run in free roam. Progress, cash and stats save to `localStorage`, so a visit can be continued where it left off.

**Controls.** WASD / arrows — walk and drive · E — enter or leave a car · mouse — aim · click or Space — shoot · F — fists · Shift — run · P / Esc — pause.

**Layout.** `main.ts` is the hand-in entrypoint (copies `game/` and `screenshots/` to the output and writes the dossier with the vendored library in `vendor/`, which is make.fun's own, byte for byte). The game lives in `game/`: `index.html` plus one module a job under `game/src/` — `city` (the grid, buildings, collisions), `world` (the simulation step), `traffic`, `police` (wanted levels, pursuit, the bust), `combat`, `missions` (the story), `render`, `hud` (HUD and minimap), `audio` (synthesised WebAudio music, engine and sirens), `input`, `save`, and `shots` (the deterministic `?shot=start|play|chase|end&seed=N` scenes the screenshots in `screenshots/` were captured from). MIT licensed — see `LICENSE`.

## Run it

```sh
node serve.ts   # serves game/ at http://localhost:8080 — open it in a desktop browser
# Hand-in check, exactly as the grader runs it:
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
