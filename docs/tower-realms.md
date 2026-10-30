# Six-realm tower release

Based on main `21a3330` (movement interpolation / responsive arena fix).

## Player controls and progression

- Tower manual mode: WASD/arrows, Q/E/R/F, Space or Shift to dash. Physical keyboard codes support Korean IME layouts. Mobile joystick and dash accept independent touch pointers.
- Dash: 12 simulation frames at speed 11, 180-frame cooldown, 12-frame evasion. Movement itself does not deal collision damage. Pause freezes simulation. At 2×/3× all simulation timing, including warnings and cooldowns, accelerates.
- Six themes: time, space, fire, storm, ice, forest. Each has ten floors, two named pattern bosses, a distinct procedural Canvas background and themed UI.
- Normal floors introduce additional movement, orbit and bombardment skills as difficulty rises. Terrain warns for 96 frames and affects both combatants; damage is limited to once per hazard per actor. Time interferes with skill charging, space pulls, fire burns the ground, storm pushes through a corridor, ice slows, forest damages and slows.
- Boss floors replace ordinary AI attacks and terrain with locked telegraphs. HP below 50% activates phase two; floor 10 adds combinations. Safe space exists outside each attack. Shared damage handling respects ordinary defenses. Boss patterns continue independently of ordinary AI decision making.
- After floors 2, 4 and 7, pick one of three shuffled blessings. Damage, recharge, radius, elemental action changes or vitality apply only to that run. No gold rewards or stored-character stat edits. Run progress is in memory; reload ends the run. Records remain browser-local.
- Existing legacy records are retained. New records are keyed by realm and fighter. New victory counts count completed towers, not individual floors.

## Module boundaries

- `tower-realms.js`: immutable theme definitions, shuffled reward choices and detached runtime profile upgrades. Never writes storage.
- `tower-encounters.js`: `create({realm, level, width, height, hero, boss, damage})` owns simulation time, phases, telegraphs and geometry. `step()` is called by the 60 Hz engine; `draw()` renders the exact collision geometry. No UI or storage dependency. A future raid adapter can supply its actors/damage handling; networking, multiple player targeting and raid rewards are not implemented.
- `tower-challenge.js`: run lifecycle, transient enemy registration, UI, records and encounter adapter. Each floor recreates fighters, then reapplies the run's blessings exactly once. Choosing a new blessing applies only that blessing to the already-prepared floor.
- `tower-controls.js`: tower-only input and dash. PvP protocol and remote authoritative simulation remain unchanged.
- Original built-in heroes use the existing manual skill presets inside the themed tower, in both auto and manual mode, to make temporary skill upgrades consistent. Ordinary PvE and PvP keep their existing behavior.

## Verification

- Node regression suite: 380 tests passed, including six full 10-floor controller flows, collision geometry, telegraph delay, phase transition, saved-profile isolation, touch pointer coexistence, Korean physical-key input and dash cooldown guards.
- `tests/browser-tower.html`: opens the actual application in an iframe. The 60-floor check forces enemy defeats to exercise progression; it is explicitly not a natural full playthrough. All six flows passed in the Chromium in-app browser, including actual engine updates, phase transitions, pause, dash and profile isolation.
- The same page's auto simulation uses unmodified health and combat results. Default Bae reached time 5F, space 5F, fire 7F, storm 6F, ice 5F, forest 3F in one sample. Random blessings mean results vary. This is a smoke test, not statistical balance validation.
- Browser UI: realm selection, manual start, dash/cooldown, live telegraphs, loss/retry, 390px selection layout and desktop battle. No application errors observed in the direct game tab.

## Remaining limits

- Cooperative raids and online PvP dash are future work.
- Physical Android/iOS multitouch and Safari/Firefox are not verified. Viewport checks do not substitute for physical-device input testing.
- A human-operated full manual 10-floor clear of every realm and broad custom-fighter balance testing remain unverified.
- Live two-account PvP matchmaking was not exercised; existing PvP automated regressions passed.

Art added by this release is CSS/Canvas geometry and text; no new third-party art or audio assets were introduced.
