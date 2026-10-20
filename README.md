# Afterhours Arcade

Two original browser games in one static application:

| Route | Game |
| --- | --- |
| `/` | Afterhours Arcade catalog |
| `/blast-arena` | BLAST ARENA: the existing maze survival game, including its portal safety fix |
| `/frontline-heroes` | FRONTLINE HEROES: a side-view tactical platform shooter |

The catalog loads no Phaser instance. Each game is imported only on its own route; ordinary navigation unloads the previous page, game loop, audio and listeners. Both games share the installed Phaser/Vite toolchain and deploy together.

## Run locally

On this prepared Windows workspace, double-click **`start-local.cmd`**, or run:

```powershell
.\start-local.cmd
```

The launcher uses the project-local portable Node.js runtime if present, or your installed Node.js. It installs locked dependencies if `node_modules` is missing. Open **http://127.0.0.1:5173** and choose a game. Stop with `Ctrl+C`.

For a fresh clone, install **Node.js 22.12 or newer**, then run from the repository root:

```sh
npm install
npm run dev
```

If PowerShell blocks `npm.ps1`, use `npm.cmd`; changing system execution policy is unnecessary. If this machine still has no npm on PATH, enable the included runtime for this PowerShell session:

```powershell
$env:Path = "$PWD\.tools\node-v22.23.3-win-x64;$env:Path"
npm.cmd run dev
```

The ignored `.tools/` runtime is a local development convenience and is not included in a Git clone. `.nvmrc` selects Node 22 for compatible version managers. No runtime backend, API key, paid service, account or database is required by either game.

## Test locally

```sh
npm run test
npx playwright install chromium
npm run test:e2e
npm run test:all
```

- `test`: deterministic Vitest tests for both simulations, weapons, abilities, maps, modes, tactical AI and stress scenarios.
- `test:e2e`: real Chromium tests for the catalog, both routes, Blast Arena, shooter controls, classes, settings, minimap, 15-bot setup, pause/restart and responsive menus.
- `test:all`: unit/integration tests, browser tests and the production build, in sequence.
- `test:watch`: Vitest during development.

Playwright starts Vite at port **4173**, or reuses a server already there outside CI. Stop an unrelated preview on that port before testing. On Linux CI, use `npx playwright install --with-deps chromium`. Browser failure traces and screenshots are written to ignored `test-results/`. Traces retain actions, DOM and source snapshots; continuous screencast frames are disabled because GPU readback makes high-resolution software rendering much slower.

Manual shooter check: select a class/map/mode, deploy, run with A/D, jump with W/Space, climb a ladder with W/S, aim/fire with the mouse, reload with R, switch with 1/2, use Q, open a nearby crate with E and throw F. Pause, restart, and return to the arcade. On Skybreach, jump into a walkway underside and hold S while standing on it: both sides must remain solid. Climb through a ladder opening in both directions. Check that occluded spaces are shaded and become lit as you regain sight, and that physical cargo carries no item-name labels. Verify that cargo/walls and thin walkways stop shots from both sides and hide characters behind them; climb around an obstacle to regain sight. Explore the stepped freight stacks and listen to the new orchestral theme using PREVIEW SOUNDTRACK in setup. Run a long match to see the announced environmental event after a minute (two minutes with reduced frequency).

## Build and inspect production

```sh
npm run build
npm run preview
```

Open **http://127.0.0.1:4173**. Also open `/blast-arena` and `/frontline-heroes` directly and refresh each page. `build` runs strict TypeScript checking and Vite, then writes the entire arcade to **`dist/`**. Serve that folder over HTTP; opening `index.html` with `file://` is unsupported. Use `npm ci` for a clean lockfile-based installation.

## Deploy both games to Netlify

1. Push this repository, including `package-lock.json`, to your Git provider.
2. Import it into Netlify with the repository root as the base directory.
3. Build command: **`npm run build`**. Publish directory: **`dist`**. Node version: **22**.
4. Deploy, then check the catalog and refresh both game routes.

The existing **`netlify.toml`** supplies the build, Node version, SPA fallback, asset caching and response headers. Vite uses root-relative assets to support direct and refreshed routes. The catalog and both games use **one deployment**. See the [Netlify Vite guide](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/).

For a manual Netlify Drop upload, build locally and upload **`dist`**, not the source. `public/_redirects` is copied into the build to make game-route refresh work with manual uploads too. Repository-level `netlify.toml` caching and header rules apply to Git builds; manual uploads still serve the complete application.

Render remains an optional static-host migration: use the included `render.yaml`, or a Static Site with build `npm ci && npm run build`, publish `dist` and `NODE_VERSION=22`. No production Node server is needed.

## Games and controls

**BLAST ARENA** retains five arenas, four bot difficulties, ten upgrades, original procedural pixel art/music, teleporters, bomb pushing/kicking, sudden death and match statistics. Arrow keys/WASD move; Space places a bomb; E activates the secondary ability; Escape pauses. Touch controls remain available. See [Blast Arena's full guide](docs/BLAST_ARENA.md).

**FRONTLINE HEROES** adds six large multi-level battlefields, four playable classes, twelve weapons, three modes and 3–15 bots split between Blue and Red. It uses a following 960×540 camera over 4800×1200 worlds, smooth detailed cartoon characters, spatial audio and original multi-section scores. Skybreach now has six distinct cargo-aircraft sections, varied physical freight cover, richer colored scenery and an orchestral score with strings, horns, woodwind and concert percussion. Every active wall, deck and obstacle blocks movement, vision and ballistics from both sides. Ladders use real openings between solid platforms. AI sight is limited to 380-480 units and the actual camera view; offscreen attackers cannot shoot into it, and bullets/projectiles stop at screen edges. Translucent shadows show the areas outside your current line of sight. Recruit is the easier default; higher health and reduced weapon damage allow time to react. Skybreach has connected architectural set pieces and pressure leaks that change compartments after a visible warning. Physical scenery has no item-name labels. Software GPUs automatically use a faster native Canvas renderer.

| Control | Shooter action |
| --- | --- |
| A / D | Move |
| W / Space | Jump |
| W / S | Climb ladders |
| S / Down | Descend a ladder through its opening |
| Mouse / left button | Aim / fire |
| R | Reload from reserve ammunition |
| 1 / 2 | Switch weapon slot |
| Q | Class ability |
| E | Open crate / exchange the active weapon |
| F | Throw a limited grenade |
| Tab (hold) | Scoreboard |
| Escape | Pause |

Settings include independent master/music/effects volumes, three graphics qualities, particles, camera shake, reduced motion and key rebinding. Preferences are saved separately for each game. Shooter play is designed for desktop keyboard/mouse; its menus adapt to mobile screens. See [Frontline Heroes' mechanics and architecture](docs/FRONTLINE.md).

## Architecture and adding games

- `src/main.ts`: route selection and lazy imports.
- `src/arcade.ts`, `src/arcade.css`: catalog, with lightweight locally authored SVG previews.
- `src/blast.ts`: preserved Blast entry, with its existing `core/`, `ai/`, `maps/`, `render/`, `audio/` and `ui/` modules.
- `src/frontline/core/`: browser-independent fixed-step physics, weapons, combat, abilities, match rules and environment events.
- `src/frontline/maps/`, `src/frontline/ai/`: six arenas, platform navigation, fair perception and tactical controllers.
- `src/frontline/render/`, `src/frontline/audio/`: Phaser presentation and spatial Web Audio.
- `src/frontline/main.ts`, `style.css`, `ui/`: menus, HUD, minimap, input, illustrations and preferences.
- `tests/`, `e2e/`: shared automated validation.

To add a game, create its own entry and namespaced modules, add a lazy route branch in `src/main.ts`, and add a catalog card. Keep its CSS isolated to that route. Use ordinary links back to `/`, clean up input/audio/rendering on unload, and add route/navigation tests. The current Netlify fallback already supports another route.

Both simulations consume common controller actions independently from presentation. Future remote-controller interfaces are types only; an authoritative server could validate tick-indexed commands and share snapshots without moving damage or scoring into the UI. No fake lobbies, sockets, accounts, cloud saves or online matchmaking are implemented.

## Verification scope

Automated browser verification targets Chromium. Safari, Firefox and other browser versions need separate testing before claiming verified support. The full Phaser runtime remains a separate engine chunk, so Vite may report a bundle-size advisory; it does not prevent production builds. Art, illustrations, sound effects and compositions are authored locally, without external asset requests.

Hosting configuration is prepared; no public deployment has been performed by this task. See `docs/FRONTLINE.md` for deliberate gameplay simplifications and navigation tradeoffs.

## Verified delivery

The integrated arcade passes **240 Vitest tests**, **27 Playwright Chromium scenarios**, strict TypeScript checking, and the production build. This includes all 63 existing Blast Arena simulation tests and all 9 existing Blast browser scenarios. The shooter adds 114 engine tests, 33 AI/map tests, 19 audio tests, 7 navigation geometry tests, 4 visibility tests, and 18 portal/shooter browser scenarios, with 15-bot setup exercised on all six maps. `npm audit` reports **zero vulnerabilities** for the installed lockfile.

The production output was also smoke-tested over HTTP: both game routes launch and refresh, the shooter class shield runs, trailing-slash URLs resolve, development diagnostics are absent, and no runtime errors, failed requests, or external asset requests were observed. The catalog creates no game canvas and requests no Phaser engine chunk. The build's only advisory is the size of the shared Phaser runtime (about 332 kB gzipped).
