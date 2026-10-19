# BLAST ARENA

An original browser arcade game for one human against 1–3 tactical AI rivals. Five seeded arenas, four AI difficulties, ten functional upgrades, moving bombs, portals, sudden death, match statistics, procedural character art, and original synthesized music run entirely in the browser.

## Run locally

Install **Node.js 22.12 or newer** with npm. The `.nvmrc` selects the Node 22 release line for compatible version managers.

From the repository folder:

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173/blast-arena** or the URL Vite prints if that port is occupied. Choose **LET'S PLAY**, a map, and your rivals, then **ENTER ARENA**. Audio starts after a user interaction. Stop the server with `Ctrl+C`.

On Windows PowerShell, use `npm.cmd` and `npx.cmd` if execution policy blocks `npm.ps1`; changing the machine's execution policy is unnecessary. This prepared Windows workspace also includes **`start-local.cmd`**: double-click it or run `.\start-local.cmd` to launch the game using the project-local portable Node installation when present, or your installed Node otherwise. The ignored `.tools/` portable runtime is optional and is not included when someone clones the project.

## Test and build

```sh
npm run test
npx playwright install chromium
npm run test:e2e
npm run test:all
```

`test` runs Vitest simulation, map, pathfinding, hazard, and AI tests, including deterministic full-match simulations. `test:e2e` runs the Chromium browser scenarios and starts its own Vite server at port 4173. `test:all` runs unit tests, browser tests, and the production build in sequence. Playwright saves failure artifacts under `test-results/`. Use `npm run test:watch` during development. On Linux CI, `npx playwright install --with-deps chromium` can also install Chromium's required system libraries.

To inspect the exact static production build:

```sh
npm run build
npm run preview
```

Open **http://127.0.0.1:4173/blast-arena**. `build` first checks TypeScript, then writes the complete site to `dist/`. Serve that folder over HTTP; opening `dist/index.html` directly with `file://` is not supported. `npm ci` is available for clean, lockfile-based installations.

A useful manual check is to start a match, move out of an initial bomb's cross, wait for it to explode, pause and resume, restart, and launch each map. Check music and effects volume separately and reload to confirm saved settings. Test a small browser window and the on-screen touch controls as well.

## Play

| Control | Action |
| --- | --- |
| Arrow keys / WASD | Move; walking into a bomb pushes it when upgraded |
| Space | Place a bomb |
| E | Place a portal anchor/pair when carrying charges; otherwise detonate owned remote bombs |
| Escape / pause button | Pause and resume |
| On-screen direction and action buttons | Touch movement, bomb, and secondary ability |

NOVA is the human character. PIXEL, BOLT, and MISO occupy distinct corners. Pick Easy, Normal, Hard, or Expert per rival or apply the global preset. Enter a seed to reproduce an arena; the shuffle button generates another seed. Restart repeats the current configuration and seed. **RUN IT BACK** uses the next seed.

Default bombs have a **2.5-second fuse**, a two-tile cross, and **0.45 seconds** of dangerous flame. Walls stop blasts; a destructible block is destroyed and stops that ray. An owner can leave a newly placed bomb, then cannot walk back through it. Bomb Push slides a bomb **one tile**; Power Kick sends it farther and faster **until blocked**. Conveyors can redirect sliding bombs. Bomb timers keep running while bombs move or teleport.

| Upgrade | Effect and limit |
| --- | --- |
| Extra Bomb | +1 simultaneous bomb, up to 6 |
| Fire Up | +1 explosion range, up to 7 tiles |
| Speed Up | +0.28 tiles/second, up to 5.1 (1.5× starting speed) |
| Bomb Push | Walk into a bomb to slide it one tile |
| Power Kick | Unlock pushing and kick bombs faster until blocked |
| Shield | Absorb one explosion; 0.65 seconds of grace prevents the same flame immediately killing you |
| Invincibility | Explosion immunity for 5 seconds |
| Remote Bomb | Place manually detonated bombs for 18 seconds; each also has an automatic safety fuse of at most 8 seconds |
| Rapid Fuse | 1.35-second fuses for 16 seconds; remote bombs use their remote safety fuse |
| Portal Charge | Carry up to 3 charges; each creates a linked pair lasting 25 seconds |

For portals, press E on a clear floor tile, move elsewhere, and press E again. One completed pair consumes one charge. **Portal placement takes priority over remote detonation while charges remain.** Creating the second endpoint does not instantly teleport its creator. Generated portals have open walking space around both endpoints. Players can teleport only when the destination and at least one walking exit are clear (including bomb/player collisions); temporary endpoints cannot be placed on isolated floor tiles. Bombs can travel through portals when the destination is clear; exit locks prevent bouncing back and forth while standing still. Explosions do not travel through portals. Temporary effects refresh their duration rather than stacking indefinitely.

## Arenas and match rules

| Arena | Environment and mechanic |
| --- | --- |
| Neon Galleria | Shopping mall with conveyor walkways |
| Departure Zero | Airport with long baggage conveyor lanes |
| Jade Temple | Jungle ruins, permanent portals, and regrowing vegetation |
| Steamworks | Factory, permanent portals, and warned steam vents |
| Storm Deck | Cargo ship, permanent portals, and alternating ship rolls |

All arenas use a validated 15×15 layout with rotationally fair starting opportunities, separate spawn pockets, and an initial bomb escape. Jungle vegetation attempts regrowth after 16 seconds with a warning during the final 2 seconds. Regrowth waits if occupied, overlapping a moving bomb, or if it would disconnect a living player's available floor region; existing bombs and flames count as obstacles in this check.

Factory vents cycle every 9 seconds: a 1.5-second warning precedes 1.2 seconds of dangerous steam. Ship rolls occur every 12 seconds after a 3-second warning and move loose bombs one tile, subject to collisions. Both mechanics use match time, so pausing also pauses them.

At **3:00**, sudden death marks the first closing ring for **3 seconds** before it becomes permanent wall. Further rings close every **5 seconds**, with their tiles marked in advance. Closing walls can eliminate shielded or invincible players, ensuring the round ends. The last survivor wins; simultaneous elimination can produce a draw.

Chain reactions happen in the simulation tick that triggers them. The owner of the root bomb receives the chain's block and opponent-elimination credit, including triggered bombs owned by another player. Self-eliminations do not grant a kill. Simultaneous blasts share the same initial obstacle snapshot, so a second blast cannot unexpectedly pass through a block destroyed earlier in that same tick. Statistics track bombs, blocks, pickups, eliminations, largest chain, and survival time.

## Deploy to Netlify

The repository includes `netlify.toml`. For continuous deployment:

1. Push the repository, including `package-lock.json`, to your Git provider.
2. Import that repository into Netlify.
3. Use the repository root as the base directory, **`npm run build`** as the build command, and **`dist`** as the publish directory. The configuration selects **Node 22**.
4. Deploy, then open the resulting URL and smoke-test a match and audio.

The configuration supplies an index fallback, asset caching, and basic response headers. Vite uses root-relative asset paths so both arcade routes refresh correctly. Netlify's [Vite setup guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/) documents the build and publish settings.

For a manual upload, run `npm install` and `npm run build`, then drag the **`dist` folder** into Netlify Drop. Upload the built files, not the source folder. A manual folder upload does not apply repository-level `netlify.toml` headers. The arcade's `public/_redirects` is copied into `dist`, preserving route refresh on manual deployments. See Netlify's [manual deployment instructions](https://docs.netlify.com/deploy/create-deploys/).

No production Node server, API keys, accounts, or database are required by the game. These instructions prepare a deployment; they do not indicate that a public site has already been published.

## Deploy to Render

Use the included `render.yaml` as a Render Blueprint, or create a **Static Site** connected to the same Git repository with:

| Setting | Value |
| --- | --- |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |
| Environment | `NODE_VERSION=22` |

The Blueprint also sets `SKIP_INSTALL_DEPS=true` because its build command explicitly installs dependencies. Deployment remains static; select a Static Site rather than a running Node web service. See Render's [Static Sites guide](https://render.com/docs/static-sites) and [Blueprint reference](https://render.com/docs/blueprint-spec).

## Architecture and extension points

| Location | Responsibility |
| --- | --- |
| `src/core/types.ts` | Shared state, actions, controller interfaces |
| `src/core/engine.ts` | Match lifecycle, fixed simulation steps, upgrades, portal use |
| `src/core/physics.ts` | Character/bomb collision, corner assistance, pushing, conveyors |
| `src/core/explosions.ts` | Blast propagation, chains, damage, attribution |
| `src/core/environment.ts` | Regrowth, steam, ship rolling, closing rings |
| `src/core/tuning.ts` | Speeds, fuses, caps, and durations |
| `src/core/random.ts` | Seeded gameplay randomness |
| `src/maps/maps.ts` | Five map definitions, generation, upgrade weights, validation |
| `src/ai/controller.ts` | Difficulty profiles and tactical action selection |
| `src/ai/pathfinding.ts`, `src/ai/hazard.ts` | Routes, escape proofs, timed hazard forecasts |
| `src/render/ArenaRenderer.ts` | Phaser rendering, procedural sprites, animation, visual effects |
| `src/audio/AudioManager.ts` | Original Web Audio themes, instruments, effects |
| `src/ui/input.ts`, `src/ui/settings.ts` | Keyboard/touch controller and browser preferences |
| `src/blast.ts`, `src/style.css` | Menus, setup, HUD, pause/results screens, responsive layout |
| `tests/`, `e2e/` | Simulation/AI tests and browser scenarios |

To **add a map**, extend `MapId` in `src/core/types.ts`, add its metadata and generation in `src/maps/maps.ts`, and keep `validateArena` passing across seeds. Add any simulation mechanic in `environment.ts`, forecast its hazards in `ai/hazard.ts`, then supply visuals in `ArenaRenderer.ts`, music in `AudioManager.ts`, and menu/help text in `main.ts`. Add loading, fairness, escape, and mechanic tests.

To **add a power-up**, extend `PowerUp` and `POWER_UPS` in `types.ts`, add an effect in `applyPowerUp` in `engine.ts`, and add its weighted drop in `maps.ts`. Define limits and durations in `tuning.ts`; update the renderer icon, HUD/help, and AI valuation in `controller.ts`. If it changes movement or explosions, update physics and hazard forecasts together and test expiry as well as acquisition.

To **add an AI difficulty**, extend `Difficulty` in `types.ts`, add an `AI_PROFILES` entry and any deliberate tactical differences in `controller.ts`, then update the setup options in `main.ts`. Keep the same action interface and game rules. Run escape-route tests and seeded full-match simulations to check that it acts, avoids obvious self-traps, and eventually finishes.

Future multiplayer can reuse `Match`, `MatchState`, and `Action`. `LocalHumanController` and `AIController` already submit ordinary actions through the shared `Controller` interface. `FutureRemoteController` is an interface only: a future authoritative host would accept tick-indexed inputs, validate them, advance the fixed-step simulation, and distribute snapshots. Rendering and audio consume simulation state/events and do not decide damage or outcomes. No networking is implemented in this version.

## Scope and compatibility

Desktop keyboard play is the primary target; responsive menus and on-screen touch controls are included. Automated browser verification currently targets **Chromium only**. Firefox, Safari, and Edge are intended targets but should receive separate manual/browser testing before claiming verified support.

Art is authored procedurally and music uses original structured Web Audio compositions, rather than copied sprites, external image hotlinks, or commercial recordings. The browser synthesizes audio after interaction. Music/effects volumes, mute, and reduced-motion settings persist in this browser's local storage. There are no accounts, analytics services, paid APIs, online matchmaking, or cloud saves. After hosting the static build, normal gameplay needs no backend.


## Verification

The completed project passed **63 Vitest tests** and **9 Playwright Chromium scenarios**, covering all five maps, real keyboard movement, bomb explosions, AI actions, defeat/results/rematch, pause/restart, persistent settings, and a mobile viewport. Simulation tests include 150 seeded map validations, 100 initial escape proofs, 15 mixed-difficulty full matches, and exact Expert replay. A separate 10-match Expert soak also completed across all maps.

The strict TypeScript check and production build pass. `npm audit` reports zero vulnerabilities for the installed lockfile. Vite reports its expected bundle-size advisory for the separate Phaser engine chunk (about 332 kB gzipped); the build succeeds. No public hosting deployment has been performed.

The static production output was also served with `npm run preview` and smoke-tested in Chromium: a Storm Deck match launched, keyboard input and a bomb ran, refreshing returned to the menu, and there were no runtime errors, failed requests, or external asset requests. Development diagnostics are absent from the production build.



