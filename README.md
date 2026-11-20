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

Staged screenshots: open `game/index.html?shot=cover&seed=1` (also `drive`,
`chase`, `mission`) to see the deterministic scenes listed in `shots.json`.
