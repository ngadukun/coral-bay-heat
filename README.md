# Coral Bay Heat

An original open-world crime game for the desktop browser — a sun-drenched
coastal city to explore on foot and by car, with traffic, pedestrians, car
jacking, a wanted system and police, an eight-mission story, combat, a HUD
with a live minimap, a day-night cycle, and a save. Built for the make.fun
gta6-01 bounty.

[![bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ngadukun/coral-bay-heat/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ngadukun/coral-bay-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Play it locally: `node serve.ts`, then open http://localhost:8080.

## The game

You are Marina "Mari" Solano, a retired getaway driver who comes home to the
sun-drenched coastal city of Coral Bay owing money to the wrong people. Work
the debt off one job at a time: eight story missions carry you from driving
Aunt Rosa to her cafe, through debt collections in Palm Heights, a hot car
at the Port, a beach-party cash grab, tailing the Middleman, a timed night
run, defending Cafe Rosa, and a five-star harbour heist finale.

Between jobs the city is yours: jack and drive any car, run taxi fares,
enter two checkpoint street races, hunt twenty hidden golden shells, and
launch stunt jumps off the Port ramps — while traffic flows, pedestrians
stroll, and Coral Bay PD answers every witnessed crime with one to five
wanted stars, pursuit cars, roadblocks and officers on foot.

## How the world works

- **One seeded island.** The whole city — five districts, the canal and its
  bridges, the marina, the beach, the coast road — is generated from a single
  seed, so every player (and every screenshot) sees the same Coral Bay.
  Buildings, parked cars, shells and stunt ramps all come from that seed;
  there are no level files and no downloaded assets.
- **Driving and on foot, one character.** Mari walks, sprints, jumps, swims
  ashore, punches and — once a mission earns it — shoots. Any car in the
  city can be taken: traffic cars, parked cars, even a police interceptor if
  you are quick. Cars have real weight transfer, handbrake slides, skid
  marks, damage and working brake lights; collisions are resolved between
  every pair of vehicles each frame.
- **A wanted system with memory.** Crimes only count when witnessed — near
  a road, a pedestrian or a patrol. Heat builds through five stars: one
  star brings a single interceptor, three bring roadblocks, five bring six
  units that ram and box you in, and officers get out and shoot when you
  stop. Break line of sight and the search timer starts; stay hidden and
  the stars drain away. Get pinned at low speed next to an officer and the
  Busted meter fills instead — that is the cheap way a chase ends.
- **An economy of odd jobs.** Story missions pay the debt down, taxi fares
  pay by the metre and the clock, street races pay for checkpoint speed,
  and the twenty golden shells are pure bragging rights tracked on the HUD.
  Progress, cash, shells, the pistol and your position all persist in a
  localStorage save behind the Continue button.
- **A living day.** The clock runs a full day in about six minutes: dawn
  gold, midday glare, a coral sunset, then neon and headlights. Weather
  rolls between clear, overcast and rain, and the synth soundscape follows
  it — waves and gulls near the shore, rain on the Neon Mile, sirens that
  pan and swell with the nearest patrol car.

## Controls

- **WASD / arrows** — move on foot, drive
- **Mouse** — orbit camera (click the game to pointer-lock); Mari aims where you look
- **Shift** — sprint · **Space** — jump on foot, handbrake in a car
- **E** — enter/exit a car, advance dialogue
- **Left click / F** — punch, or fire the pistol once you have earned it
- **Enter** — start a street race at its marker · **Esc / P** — pause

## Features

- Five districts on one seeded island grid: Downtown, the Neon Mile shops,
  the Marina and boardwalk, Coral Beach, Palm Heights suburbs and the Port,
  ringed by a coast road and cut by a canal with bridges
- Full day-night cycle (about six minutes a day) with dawn/dusk colour,
  stars, drifting clouds and clear/overcast/rain weather
- Live HUD: cash, clock, wanted stars, health and Busted meters, weapon and
  ammo, mission timer, objectives — and a live minimap
- Start screen with New Game/Continue, pause menu with progress, and a
  localStorage save (story progress, cash, shells, pistol, position)
- All sound synthesised in code with WebAudio — engine, sirens, horns,
  gunshots, rain, gulls, waves and a menu groove. No audio files, no
  network: every asset is a file under `game/` or generated geometry.

## Screenshot staging (`?shot=` modes)

The dossier screenshots are not lucky grabs from live play — they are
deterministic scenes the game stages on itself. Open any of these URLs
(serve the game with `node serve.ts` first) and the real game arranges
its world, camera, HUD and wanted level into a composed frame:

- `game/index.html?shot=cover&seed=1` — golden hour on the marina
  promenade: Mari on foot with her pistol earned, the coral convertible
  parked beside her, cash, shells and mission progress already on the HUD.
- `game/index.html?shot=drive&seed=1` — midday downtown, driving the
  convertible in live traffic on the avenue.
- `game/index.html?shot=chase&seed=1` — four wanted stars on the coast
  road: three interceptors in pursuit formation, a two-car roadblock
  ahead, light bars flashing.
- `game/index.html?shot=mission&seed=1` — the Night Run story mission in
  progress at night: delivery timer, objective text and the opening
  dialogue card all on screen, one patrol car already interested.

`shots.json` at the repo root lists the four scenes and the file name each
one is handed in as. Two staging tricks keep the frames exact:

- **The 16:9 stage.** The dossier wants 1280×720 landscape frames, but the
  capture pipeline can only save portrait pages — and a full-window canvas
  follows the page, so a portrait capture used to crop the scene's sides
  away. With a `shot` parameter present, `index.html` instead renders the
  game into a fixed stage: a container pinned to the top-left of the page,
  as wide as the page and exactly 9/16 as tall, holding the canvas and
  every HUD and overlay element, with black page around it. The renderer
  and camera take their aspect from the stage, so the top band of a
  portrait capture *is* the 1280×720 frame, undistorted. Normal play
  (no `shot` parameter) never touches the stage and fills the window.
- **Chase photo freeze.** A live four-star chase ends fast — Mari's car
  coasts down, the interceptors box her in and the Busted meter fills in
  seconds, long before a capture pipeline finishes. So the chase scene
  freezes gameplay progression the moment it is staged: the player car
  and every police car hold their positions, no bust or wasted state can
  trigger, no overlay can appear, and the pose stays identical for as
  long as the page is open. Only ambient motion continues — the police
  light bars flash and the water shimmers — so the frame still reads as
  a live chase, not a paused menu.

Every scene also pins the time of day and weather and reseeds the world
from the `seed` parameter, so the same URL always produces the same frame.

## Running it

- Play locally: `node serve.ts`, then open http://localhost:8080
  (add `?shot=chase&seed=1` and friends for the staged scenes above).
- Hand-in build: `MAKEFUN_OUTPUT_DIR=out node main.ts` copies `game/` and
  `screenshots/` to the output directory and writes the `dossier.json`
  summary the judge reads, using the vendored library in
  `vendor/makefun-game.ts`. Node's standard library only — no install
  step, no network.
