# FRONTLINE HEROES — gameplay and implementation

Launch `/frontline-heroes` from the arcade catalog. This is a browser-only, team-based platform shooter with one human and 3–15 bots. The human is always Blue; total team sizes differ by at most one. The six battlefields are 4800 × 1200 world units, with a main floor at y=1120 and galleries at y=900, 680, and 460. A following camera shows part of the battlefield; the minimap provides the wider view.

Local installation, production builds, portal routes, and Netlify deployment are covered in the main [README](../README.md).

## Controls

| Input | Action |
| --- | --- |
| A / D, Left / Right | Move |
| W / Space, Up | Jump; W / Up also climbs a ladder |
| W / S near ladders | Climb up / down |
| S / Down | Drop through an eligible one-way walkway |
| Mouse / left button | Aim / hold to fire |
| R | Reload the active weapon |
| 1 / 2 | Select primary / secondary slot |
| Q | Class ability |
| E | Exchange the **active weapon slot** at a ready crate or weapon drop |
| F | Throw a grenade |
| Tab | Hold to display the roster |
| Escape | Pause |

Movement/action keys can be rebound in Settings. Keyboard and mouse are the intended input devices. After dying in Elimination, follow a surviving teammate and use **NEXT ALLY** to change the spectator target.

## Movement and combat rules

The simulation runs at **60 fixed steps per second**. Character positions describe their feet; the collision body is 28 wide and 54 high. Gravity is 1500 units/s², jump velocity is 650 units/s upward, ladder speed is 195 units/s, coyote time is 0.11 seconds, and jump buffering is 0.13 seconds. Holding Jump does not cause automatic repeated jumps. A jump reaches approximately 141 units above its starting surface, so higher galleries use ladders, footholds, or lifts. Platforms may carry soldiers; conveyors also carry loose loot.

One-way walkways support descending characters and grenades. Characters can jump upward through them or deliberately drop through. Bullets pass through these walkways; solid cover blocks bullets and blast line of sight. Lightweight cover has finite health. Destroying it updates collision and navigation in the simulation.

The weapon muzzle sits 32 units along the aim direction from the shoulder at feet-y minus 34. A solid obstacle between shoulder and muzzle blocks the shot as well, preventing a gun barrel from firing through cover. Most firearms use hitscan; the Thumper and Comet simulate travelling projectiles. Shotguns fire eight individual pellets. Grenades bounce and have a 2.6-second fuse. Rocket impacts explode immediately.

Headshots multiply sniper bullet damage by **2**, and other bullet damage by **1.6**. Bullet damage falls with distance beyond half the weapon's maximum range. Splash damage falls with distance and requires clear solid-geometry line of sight. Teammates cannot damage each other; **your own explosives can hurt you**. There is no fall damage, though leaving the bottom of the playable world eliminates a soldier.

Magazines and reserves are finite. Reloading transfers only available reserve rounds and never refills them for free. Empty-fire clicks are rate-limited. Bots use these same ammunition, movement, damage, cooldown, and visibility rules.

## Classes

Speeds below are base speeds before the active weapon's mobility penalty.

| Class | Health | Speed | Starting equipment | Ability |
| --- | ---: | ---: | --- | --- |
| Assault | 125 | 260 | Vanguard AR, Kestrel .45, 2 grenades | Adrenaline Rush: 6 seconds; 25-second cooldown |
| Support | 115 | 245 | Wisp SMG, Hush-9, 1 grenade | Medic Station: 10 seconds; 30-second cooldown |
| Defense | 185 | 215 | Bulwark LMG, Kestrel .45, 1 grenade | Tactical Shield: 8 seconds; 26-second cooldown |
| Sniper | 90 | 250 | Longbow SR, Hush-9, 1 grenade | Focus Mode: 5 seconds; 25-second cooldown |

**Adrenaline Rush** multiplies movement speed by 1.25, new reload durations by 0.65, and recoil/spread by 0.72. **Focus** reduces recoil/spread to 0.23 of the normal value and extends the bot's sight range by 12% while active.

A **Medic Station** has 90 health, a 145-unit healing radius, and 250 total shared healing capacity. It heals nearby allied soldiers, including its owner, at up to 20 health/second each when solid cover does not block the healing line. It expires after 10 seconds or when destroyed or depleted. Healing contributes to the owner's healing statistic and score.

The **Tactical Shield** follows aim direction and has 180 durability. Frontal bullets lose up to 90% of their damage; frontal explosions lose up to 35%. Prevented damage consumes shield durability; damage exceeding the remaining durability passes through. Rear attacks and environmental damage bypass it. Movement is multiplied by 0.65 while an intact shield is active.

## Weapons and equipment

Values are centralized in [`src/frontline/core/config.ts`](../src/frontline/core/config.ts). Damage is before headshots, distance falloff, shielding, and blast falloff. Reserve is the normal maximum reserve; magazine rounds are additional.

| Weapon | Category | Damage | Shot interval | Magazine / reserve | Reload | Maximum range |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Kestrel .45 | Pistol | 25 | 0.26s | 12 / 72 | 1.25s | 850 |
| Hush-9 | Pistol | 18 | 0.15s | 18 / 108 | 1.10s | 720 |
| Wisp SMG | SMG | 14 | 0.082s | 32 / 192 | 1.60s | 680 |
| Cyclone PDW | SMG | 16 | 0.075s | 36 / 180 | 1.90s | 740 |
| Vanguard AR | Rifle | 22 | 0.115s | 30 / 180 | 1.80s | 1050 |
| Ranger Mk II | Rifle | 27 | 0.14s | 24 / 144 | 1.90s | 1150 |
| Breach-8 | Shotgun | 12 × 8 pellets | 0.70s | 8 / 48 | 2.20s | 470 |
| Bulwark LMG | LMG | 23 | 0.10s | 60 / 240 | 3.20s | 1100 |
| Longbow SR | Sniper | 88 | 1.15s | 5 / 30 | 2.70s | 1650 |
| Meridian DMR | DMR | 46 | 0.40s | 14 / 84 | 2.05s | 1400 |
| Thumper GL | Grenade launcher | 65 blast | 1.10s | 4 / 16 | 2.80s | 1400 launch budget |
| Comet RPG | Rocket launcher | 105 blast | 1.50s | 1 / 5 | 2.80s | 1800 launch budget |

Projectile weapons use travel time, gravity where applicable, collision, and a finite lifetime rather than an instantaneous range cutoff. Thumper launch speed is 670 and blast radius 125; Comet speed is 830 and radius 155. Hand grenades deal up to 85 damage in a 135-unit radius. Weapons also differ in recoil, spread, rarity, and movement penalties in the configuration file.

Crate weapons are seeded random selections. Common/uncommon/rare/epic weapons have selection weights 6/4/2/1 **per weapon**. A ready crate can be used within 80 units. It exchanges the active slot, supplies that weapon's normal starting ammunition, and drops the previous weapon with its remaining ammunition. Crates rearm after **35 seconds** in Deathmatch and Flag Control; an Elimination crate is available once per round.

Death loot lasts **24 seconds**, contains at most 100 rounds taken from the dead soldier's active weapon, and sometimes includes that weapon. Compatible/generic ammo collects within 46 units, fills finite reserves, and is deducted from the drop. A weapon drop can be exchanged with E within 70 units. Exchanged weapons last 20 seconds. Loot does not duplicate ammunition, and both humans and bots can use it.

## Modes and endings

**Team Deathmatch:** Each enemy elimination adds one team point. Self/environmental deaths add no enemy kill point. A dead soldier respawns after 2.8 seconds with class equipment and 2 seconds of protection; an actual firearm shot ends protection early. Respawn selection prefers team spawn points farther from visible enemies. Personal statistics persist. Reaching the selected team score limit ends the match. At the time limit, the higher score wins; an equal score is an explicit draw.

**Elimination:** No respawns within a round. Best-of-3 needs 2 round wins; best-of-5 needs 3. After a nonfinal round there is a 4-second intermission, then soldiers, equipment, crates, geometry, and environmental timing reset. Personal statistics and round wins persist. A round ends when a team has no living soldiers or its selected time limit expires, capped at 180 seconds. A timeout compares living soldier counts, then the sums of remaining health fractions. Equal results and simultaneous final eliminations draw the round. Draws can extend a series; after `rounds + 4` rounds, the team with more wins takes the match, or it ends drawn. This prevents endless tied rounds.

**Flag Control:** There are exactly three flags at different elevations. Stand within 110 units to capture. One soldier captures in approximately 6.25 seconds. Up to three allies accelerate progress by the square root of their count. Opposing teams in the zone contest it and pause progress. Vacant capture progress decays; enemies can recapture an owned flag. Each owned flag generates **one team point per second**, including while contested, until recaptured. Reaching the selected target wins. The higher score wins at the time limit; equal scores draw. Captures credit the soldiers currently in the zone with objective contribution.

## Living battlefields

Major event warnings begin **3 seconds before activation**. The first activation is at **60 seconds**, then every 60 seconds; Reduced frequency uses 120 seconds. Elimination restarts this schedule each round. The main active event window lasts 18 seconds. Damage zones expose `starts` and `ends` to rendering and AI, so the same authoritative timing drives warnings and damage.

| Map | Functional mechanics |
| --- | --- |
| **Skybreach — Cargo Aircraft** | Turbulence and wind modify movement and spread. The cargo-ramp pressure zone deals 6 HP/second. Emergency lighting changes and optional damaged geometry is removed. |
| **Cinderline — Factory** | Conveyor galleries move soldiers and loot; elevators connect heights. Pressure events activate warned 18 HP/second steam zones and reduce lighting. |
| **Verdant Front — Forest** | Rain/fog change; fog reduces bot perception. Falling timber creates temporary solid cover/pathways where safe. A warned wildfire zone deals 12 HP/second. |
| **Blackout District — City** | Lightweight glass/cover can be shot apart. Outages reduce lighting. Events remove optional structures and create low rubble, rebuilding navigation. |
| **Iron Tide — Harbor** | Crane platforms travel across the battlefield. Events add moving cargo cover and temporary delivered containers where a safe placement exists. Rain and wind alter conditions. |
| **Tempest — Ship** | Rolling affects movement and loose objects. Rain intensifies over time; lightning briefly illuminates the scene. Lower-deck flooding rises gradually and encourages higher routes. |

Fallen timber, rubble, and delivered cover normally remain for 32 seconds; event crane cargo remains for 45 seconds. Removal waits while a living soldier stands on that object. Creation avoids soldiers, permanent ladders, objectives, spawn areas, and overlapping solid geometry; if no safe site is available, that optional placement is skipped. Structural changes preserve the permanent navigation backbone, rather than simulating arbitrary building destruction.

Ship water begins below the lower floor after the first event and rises at 2.4 units/second, stopping 150 units above that floor. Being below the waterline multiplies movement speed by 0.55. Being more than 28 units below it deals **8 HP/second**. This is gradual damage, not an instant-death boundary. Environmental damage bypasses a shield.

## AI and architecture

Recruit, Regular, Veteran, and Elite vary reaction delay, sight/hearing range, memory duration, aim error, prediction, positioning, and ability use. Bots perceive actual line of sight, reduced sight in fog, approximate heard sound positions, and expiring last-known positions. Hidden enemy positions do not supply aim targets. Teams distribute flag assignments; bots reload, change weapons, search for supplies, use cover, heal, and activate class abilities through normal actions.

`src/frontline/core/` owns authoritative rules. `physics.ts` handles movement, platform collision, and shared ray queries; `combat.ts` handles weapons, damage, abilities, projectiles, and healing; `environment.ts` owns timed transitions; `modes.ts` owns scoring/endings; `engine.ts` advances the match. `src/frontline/maps/maps.ts` builds and validates arenas and navigation graphs. `src/frontline/ai/` handles perception, routing, and controllers. Rendering, input, menus, and Web Audio are separate.

Random choices use the shared seeded PRNG. Navigation rebuilds after cover/structure changes, with combat rebuilds batched to one per step. AI decisions are scheduled rather than fully replanned each frame. Projectiles, tracers, loot, stations, and temporary geometry have finite lifetimes or capacities.

Future online play would supply tick-indexed actions to the same simulation through `FutureRemoteController`, then add authoritative validation and snapshot/prediction machinery. That interface is present; networking is not. Internal permanent timestamps can use `Infinity`, which a future JSON snapshot protocol must encode explicitly.

## Verification and current scope

Run the shooter simulation/AI checks with:

```sh
npm run test -- tests/frontline-engine.test.ts tests/frontline-ai-maps.test.ts
```

The engine suite covers movement, coyote/buffer behavior, ladder exits in both directions, one-way drops, lifts/conveyors, moving cover, muzzle/solid-cover collision, headshots, friendly fire, spawn protection, finite ammunition/reloads, weapon switching, shotgun pellets, travelling explosives, grenade bounces, all abilities, station destruction, crates/loot, team balance, all modes, event activation, flooding, and deterministic replay.

AI/map checks validate seeded maps, bidirectional objective/spawn/crate routes, physical tours of all three flag elevations on all six maps, fair perception, class abilities, and seeded replay. Automated simulations exercise all 18 map/mode combinations with 15 bots and longer environmental-event runs. An additional six-map, 120-second, 15-bot diagnostic completed successfully. Focused Factory/Forest/Harbor runs recorded 99/104/99 kills, maximum simultaneous projectile counts of 4/5/3, and no eight-second windows of commanded movement without displacement. These are simulation observations, **not browser FPS benchmarks**.

The main README records combined-project browser/build verification. Automated browser coverage targets Chromium; other recent desktop browsers still require their own verification. Fifteen bots are supported, but 60 FPS across all devices has not been established. Tactical navigation uses handcrafted platform connections and graph heuristics rather than a full arbitrary-geometry motion planner. Bots have class roles, cover/repositioning behavior, and distributed objectives; advanced coordinated squad suppression is not implemented. Environmental destruction is scripted/limited to designated pieces, and unsafe optional deliveries can be skipped.

There is no online multiplayer, campaign, persistent character progression, or cloud save. Preferences remain local to the browser. Art and sound use original procedural presentation and synthesized compositions; there are no copied game recordings or runtime asset hotlinks. Keyboard and mouse are the primary shooter controls; dedicated touch/gamepad shooter controls are not implemented.
