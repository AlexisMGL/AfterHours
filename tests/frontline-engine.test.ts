import { describe, expect, it } from 'vitest';
import { ShooterMatch, damageSoldier, killSoldier, lineOfSight, muzzlePoint, weaponSlot } from '../src/frontline/core/engine';
import { CLASSES, PHYSICS, WEAPONS } from '../src/frontline/core/config';
import { FIXED_DT, type ClassId, type MapId, type MatchConfig, type Mode } from '../src/frontline/core/types';

function config(options: Partial<MatchConfig> = {}): MatchConfig {
  return { mapId: 'aircraft', mode: 'deathmatch', botCount: 3, difficulty: 'regular', humanClass: 'assault', seed: 761,
    scoreLimit: 99, rounds: 3, timeLimit: 480, eventFrequency: 'normal', ...options };
}

function fixture(options: Partial<MatchConfig> = {}): ShooterMatch {
  const match = new ShooterMatch(config(options)), state = match.state;
  state.arena.width = 2000; state.arena.height = 680;
  state.arena.platforms = [{ id: 1, x: 0, y: 600, w: 2000, h: 80, active: true, oneWay: false, material: 'metal' }];
  state.arena.ladders = []; state.arena.hazards = []; state.arena.spawns = [{ x: 200, y: 600, team: 0 }, { x: 1800, y: 600, team: 1 }];
  state.crates = []; state.flags = []; state.loot = [];
  for (const [index, soldier] of state.soldiers.entries()) {
    soldier.x = [300, 650, 1500, 1800][index]!; soldier.y = 600; soldier.platformId = 1;
    soldier.grounded = true; soldier.vx = 0; soldier.vy = 0; soldier.protectedUntil = 0;
  }
  return match;
}

describe('frontline movement and platform physics', () => {
  it('accelerates, brakes, and collides with solid cover', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    match.state.arena.platforms.push({ id: 2, x: 420, y: 500, w: 40, h: 100, active: true, oneWay: false, material: 'stone' });
    match.step({ 0: { move: 1 } }, 1); expect(soldier.x).toBe(406); expect(soldier.vx).toBe(0);
    match.step({ 0: { move: -1 } }, 0.2); expect(soldier.x).toBeLessThan(390);
    match.step({}, 0.3); expect(soldier.vx).toBe(0);
  });
  it('jumps with gravity, lands, and does not auto-jump when the key stays held', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    match.step({ 0: { jump: true } }, 0.35); expect(soldier.y).toBeLessThan(490);
    match.step({ 0: { jump: true } }, 1.1); expect(soldier.y).toBe(600); expect(soldier.grounded).toBe(true);
  });
  it('supports coyote time and a jump buffered immediately before landing', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    soldier.grounded = false; soldier.y = 590; soldier.coyoteUntil = 0.1;
    match.step({ 0: { jump: true } }); expect(soldier.vy).toBeLessThan(-600);
    const buffered = fixture(); const falling = buffered.state.soldiers[0]!;
    falling.y = 598; falling.grounded = false; falling.vy = 180; falling.coyoteUntil = -1;
    buffered.step({ 0: { jump: true } }); expect(falling.grounded).toBe(true);
    buffered.step({}); expect(falling.vy).toBeLessThan(-600);
  });
  it('jumps through one-way platforms, lands on them, then deliberately drops through', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    match.state.arena.platforms.push({ id: 2, x: 200, y: 480, w: 300, h: 20, active: true, oneWay: true, material: 'wood' });
    match.step({ 0: { jump: true } }, 0.4); expect(soldier.y).toBeLessThan(480);
    match.step({}, 0.5); expect(soldier.y).toBe(480); expect(soldier.platformId).toBe(2);
    match.step({ 0: { drop: true } }, 0.5); expect(soldier.y).toBe(600);
  });
  it('climbs ladders through galleries and exits on the upper surface', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    match.state.arena.platforms.push({ id: 2, x: 200, y: 380, w: 300, h: 20, active: true, oneWay: true, material: 'metal' });
    match.state.arena.ladders.push({ id: 1, x: 280, y: 322, w: 40, h: 283 });
    match.step({ 0: { climb: -1 } }, 1.4);
    expect(soldier.y).toBe(380); expect(soldier.grounded).toBe(true);
  });
  it('descends ladders onto a one-way gallery without dropping through it', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    match.state.arena.platforms.push({ id: 2, x: 200, y: 380, w: 300, h: 20, active: true, oneWay: true, material: 'metal' });
    match.state.arena.platforms.push({ id: 3, x: 200, y: 160, w: 300, h: 20, active: true, oneWay: true, material: 'metal' });
    match.state.arena.ladders.push({ id: 1, x: 280, y: 102, w: 40, h: 283 });
    soldier.y = 160; soldier.platformId = 3;
    match.step({ 0: { climb: 1 } }, 1.4);
    expect(soldier.y).toBe(380); expect(soldier.grounded).toBe(true); expect(soldier.platformId).toBe(2);
  });
  it('carries grounded soldiers on moving platforms', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    match.state.arena.platforms.push({ id: 2, x: 200, y: 500, w: 300, h: 20, active: true, oneWay: true, material: 'metal', moving: { axis: 'y', from: 500, to: 300, period: 4, phase: 0 } });
    soldier.y = 500; soldier.platformId = 2;
    match.step({}, 1); expect(soldier.y).toBeCloseTo(400); expect(soldier.platformId).toBe(2);
  });
  it('conveyors transport soldiers and loose ammunition', () => {
    const match = fixture(); const state = match.state;
    state.arena.platforms[0]!.conveyor = 60; state.loot.push({ id: 8, x: 900, y: 600, ammo: 10, until: 20 });
    match.step({}, 1); expect(state.soldiers[0]!.x).toBeCloseTo(360); expect(state.loot[0]!.x).toBeCloseTo(960);
  });
  it('moving solid cargo pushes soldiers without passing through their bodies', () => {
    const match = fixture(); const state = match.state, soldier = state.soldiers[0]!;
    soldier.x = 450;
    state.arena.platforms.push({ id: 2, x: 200, y: 520, w: 100, h: 80, active: true, oneWay: false, material: 'metal', moving: { axis: 'x', from: 200, to: 600, period: 4, phase: 0 } });
    match.step({}, 1.2);
    const cargo = state.arena.platforms[1]!;
    expect(soldier.x - PHYSICS.radius).toBeGreaterThanOrEqual(cargo.x + cargo.w - 0.1); expect(soldier.alive).toBe(true);
  });
});

describe('frontline firearm combat', () => {
  it('fires from the muzzle, consumes ammunition, and damages enemies', () => {
    const match = fixture(); const state = match.state; const soldier = state.soldiers[0]!;
    soldier.weapons[0] = weaponSlot('kestrel'); const before = state.soldiers[1]!.health;
    match.step({ 0: { aim: 0, fire: true } });
    expect(soldier.weapons[0].ammo).toBe(11); expect(state.soldiers[1]!.health).toBeLessThan(before);
    expect(state.tracers[0]!.from).toEqual(muzzlePoint(soldier)); expect(soldier.stats.shots).toBe(1); expect(soldier.stats.hits).toBe(1);
  });
  it('obeys automatic fire intervals without regenerating ammunition', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    match.step({ 0: { fire: true, aim: -1 } }, 0.6);
    expect(soldier.stats.shots).toBeGreaterThanOrEqual(5); expect(soldier.stats.shots).toBeLessThanOrEqual(6);
    expect(soldier.weapons[0].ammo).toBe(30 - soldier.stats.shots);
  });
  it('blocks shots with solid cover including cover between shoulder and muzzle', () => {
    for (const x of [315, 450]) {
      const match = fixture(), state = match.state, target = state.soldiers[1]!;
      state.arena.platforms.push({ id: 2, x, y: 500, w: 20, h: 100, active: true, oneWay: false, material: 'stone' });
      expect(lineOfSight(state.arena, { x: 300, y: 566 }, { x: 650, y: 566 })).toBe(false);
      match.step({ 0: { fire: true, aim: 0 } }); expect(target.health).toBe(target.maxHealth);
    }
  });
  it('never damages teammates or protected respawns', () => {
    const match = fixture(); const state = match.state, target = state.soldiers[1]!;
    target.team = 0; match.step({ 0: { fire: true, aim: 0 } }); expect(target.health).toBe(target.maxHealth);
    target.team = 1; target.protectedUntil = state.time + 2;
    match.step({ 0: { fire: true, aim: 0 } }, 0.2); expect(target.health).toBe(target.maxHealth);
    expect(state.soldiers[0]!.protectedUntil).toBe(0);
  });
  it('awards headshots and records damage and enemy eliminations', () => {
    const match = fixture(); const state = match.state, shooter = state.soldiers[0]!, target = state.soldiers[1]!;
    shooter.weapons[0] = weaponSlot('longbow');
    match.step({ 0: { aim: Math.atan2(-16, 350), fire: true } });
    expect(target.alive).toBe(false); expect(shooter.stats.kills).toBe(1); expect(shooter.stats.damage).toBe(target.maxHealth);
    expect(state.events.find(e => e.type === 'death')).toMatchObject({ soldierId: 0, targetId: 1 });
  });
  it('reloads from finite reserve and emits throttled dry-fire feedback', () => {
    const match = fixture(); const state = match.state, slot = state.soldiers[0]!.weapons[0]; slot.ammo = 0; slot.reserve = 5;
    match.step({ 0: { fire: true } }); expect(state.events.some(e => e.type === 'dry')).toBe(true);
    match.step({ 0: { reload: true } }, 0.5); expect(slot.ammo).toBe(0); expect(slot.reloadUntil).toBeGreaterThan(state.time);
    match.step({}, 1.4); expect(slot.ammo).toBe(5); expect(slot.reserve).toBe(0); expect(slot.reloadUntil).toBe(0);
  });
  it('switches between independent weapon slots', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    match.step({ 0: { switchWeapon: 1, fire: true, aim: -1 } });
    expect(soldier.activeWeapon).toBe(1); expect(soldier.weapons[1].ammo).toBe(11); expect(soldier.weapons[0].ammo).toBe(30);
  });
  it('shotguns fire multiple finite pellets', () => {
    const match = fixture(); const state = match.state, shooter = state.soldiers[0]!;
    shooter.weapons[0] = weaponSlot('breach'); match.step({ 0: { fire: true, aim: 0 } });
    expect(state.tracers).toHaveLength(8); expect(shooter.stats.shots).toBe(8); expect(shooter.weapons[0].ammo).toBe(7);
  });
  it('rockets travel before impact and explode with splash damage', () => {
    const match = fixture(); const state = match.state, shooter = state.soldiers[0]!, target = state.soldiers[1]!;
    shooter.weapons[0] = weaponSlot('comet'); match.step({ 0: { fire: true, aim: 0 } });
    expect(state.projectiles).toHaveLength(1); expect(target.health).toBe(target.maxHealth);
    match.step({}, 0.5); expect(state.projectiles).toHaveLength(0); expect(target.health).toBeLessThan(target.maxHealth);
  });
  it('solid cover prevents explosion damage passing through walls', () => {
    const match = fixture(); const state = match.state;
    state.arena.platforms.push({ id: 2, x: 500, y: 450, w: 40, h: 150, active: true, oneWay: false, material: 'metal' });
    state.soldiers[1]!.x = 570; state.soldiers[0]!.weapons[0] = weaponSlot('comet');
    match.step({ 0: { fire: true, aim: 0 } }); match.step({}, 0.5);
    expect(state.soldiers[1]!.health).toBe(state.soldiers[1]!.maxHealth);
  });
  it('grenades are limited, bounce and expire instead of accumulating', () => {
    const match = fixture(); const state = match.state, soldier = state.soldiers[0]!;
    match.step({ 0: { grenade: true, aim: -0.3 } }); expect(soldier.grenades).toBe(1); expect(state.projectiles[0]?.kind).toBe('grenade');
    match.step({ 0: { grenade: true } }, 3); expect(soldier.grenades).toBe(1); expect(state.projectiles).toHaveLength(0);
  });
  it('can throw a grenade while firing a firearm', () => {
    const match = fixture(); const state = match.state;
    match.step({ 0: { fire: true, grenade: true, aim: -0.3 } });
    expect(state.soldiers[0]!.weapons[0].ammo).toBe(29); expect(state.soldiers[0]!.grenades).toBe(1); expect(state.projectiles).toHaveLength(1);
  });
  it('bounces descending grenades off one-way gallery surfaces', () => {
    const match = fixture(); const state = match.state;
    state.arena.platforms.push({ id: 2, x: 200, y: 480, w: 700, h: 20, active: true, oneWay: true, material: 'metal' });
    match.step({ 0: { grenade: true, aim: -1.2 } }); match.step({}, 1.2);
    expect(state.projectiles).toHaveLength(1); expect(state.projectiles[0]!.y).toBeLessThan(480); expect(state.projectiles[0]!.vy).toBeLessThan(0);
  });
  it('destroys lightweight cover and refreshes navigation', () => {
    const match = fixture(); const state = match.state, nav = state.arena.nav;
    const cover = { id: 2, x: 450, y: 500, w: 25, h: 100, active: true, oneWay: false, material: 'glass' as const, hp: 10 };
    state.arena.platforms.push(cover); match.step({ 0: { fire: true, aim: 0 } });
    expect(cover.active).toBe(false); expect(state.arena.nav).not.toBe(nav);
  });
});

describe('frontline class abilities and equipment', () => {
  it('assault adrenaline increases speed and shortens a reload', () => {
    const normal = fixture(), boosted = fixture();
    boosted.step({ 0: { ability: true } });
    normal.step({ 0: { move: 1 } }, 0.5); boosted.step({ 0: { move: 1 } }, 0.5);
    expect(boosted.state.soldiers[0]!.x - normal.state.soldiers[0]!.x).toBeGreaterThan(20);
    const soldier = boosted.state.soldiers[0]!; soldier.weapons[0].ammo = 0;
    boosted.step({ 0: { reload: true } }); expect(soldier.weapons[0].reloadUntil - boosted.state.time).toBeCloseTo(WEAPONS.vanguard.reload * 0.65);
  });
  it('support stations heal allies from a finite shared supply and obey cooldown', () => {
    const match = fixture({ humanClass: 'support' }), state = match.state, owner = state.soldiers[0]!, ally = state.soldiers[2]!;
    ally.x = 350; ally.health = 30; owner.health = 30;
    match.step({ 0: { ability: true } }); expect(state.stations).toHaveLength(1);
    match.step({}, 1); expect(ally.health).toBeGreaterThan(49); expect(state.stations[0]!.capacity).toBeLessThan(210);
    expect(owner.stats.healing).toBeGreaterThan(40);
    match.step({ 0: { ability: true } }); expect(state.stations).toHaveLength(1);
    match.step({}, 10); expect(state.stations).toHaveLength(0);
  });
  it('enemy bullets can destroy a medic station', () => {
    const match = fixture({ humanClass: 'support' }), state = match.state;
    match.step({ 0: { ability: true } }); state.stations[0]!.health = 10; state.soldiers[0]!.x = 1000;
    state.soldiers[1]!.weapons[0] = weaponSlot('longbow');
    match.step({ 1: { fire: true, aim: Math.atan2(18, -350) } }); expect(state.stations).toHaveLength(0);
  });
  it('defense shields reduce frontal bullets and blasts, while rear shots remain lethal', () => {
    const match = fixture({ humanClass: 'defense' }), state = match.state, soldier = state.soldiers[0]!;
    match.step({ 0: { ability: true, aim: 0 } });
    const before = soldier.health;
    expect(damageSoldier(state, soldier, 50, 1, { x: 600, y: 566 })).toBeCloseTo(5);
    expect(damageSoldier(state, soldier, 50, 1, { x: 600, y: 566 }, 'explosion')).toBeCloseTo(32.5);
    expect(damageSoldier(state, soldier, 50, 1, { x: 100, y: 566 })).toBeCloseTo(50);
    expect(soldier.health).toBeCloseTo(before - 87.5); expect(soldier.shieldHealth).toBeLessThan(180);
  });
  it('shield durability is finite and environmental damage bypasses it', () => {
    const match = fixture({ humanClass: 'defense' }), state = match.state, soldier = state.soldiers[0]!;
    match.step({ 0: { ability: true, aim: 0 } }); soldier.health = 1000;
    damageSoldier(state, soldier, 300, 1, { x: 600, y: 566 }); expect(soldier.shieldHealth).toBe(0);
    expect(damageSoldier(state, soldier, 20, -1, soldier, 'environment')).toBe(20);
  });
  it('sniper focus reduces recoil, expires, and retains its cooldown', () => {
    const normal = fixture({ humanClass: 'sniper' }), focused = fixture({ humanClass: 'sniper' });
    normal.step({ 0: { fire: true, aim: -1 } }); focused.step({ 0: { ability: true, fire: true, aim: -1 } });
    const soldier = focused.state.soldiers[0]!;
    expect(soldier.recoil).toBeLessThan(normal.state.soldiers[0]!.recoil * 0.3);
    focused.step({}, 5.1); expect(soldier.abilityUntil).toBeLessThan(focused.state.time); expect(soldier.abilityReadyAt).toBeGreaterThan(focused.state.time);
  });
  it('weapon crates exchange real equipment and cannot be repeatedly collected', () => {
    const match = fixture(); const state = match.state;
    state.crates.push({ id: 1, x: 300, y: 600, weapon: 'comet', readyAt: 0 });
    match.step({ 0: { interact: true } }); expect(state.soldiers[0]!.weapons[0].id).toBe('comet'); expect(state.crates[0]!.readyAt).toBeGreaterThan(state.time);
    expect(state.loot.some(loot => loot.weapon === 'vanguard')).toBe(true);
  });
  it('death ammunition is finite and cannot duplicate on collection', () => {
    const match = fixture(); const state = match.state, soldier = state.soldiers[0]!;
    killSoldier(state, state.soldiers[1]!, 0); const drop = state.loot[0]!;
    soldier.x = drop.x; soldier.weapons[0].reserve = 0;
    match.step({}); const reserve = soldier.weapons[0].reserve;
    expect(reserve).toBeGreaterThan(0); expect(reserve).toBeLessThanOrEqual(100);
    match.step({}); expect(soldier.weapons[0].reserve).toBe(reserve); expect(state.loot).toHaveLength(0);
  });
});

describe('frontline modes, teams and lifecycle', () => {
  it('balances 3–15 bots around a blue human and gives every class configured stats', () => {
    for (const botCount of [3, 4, 7, 15]) {
      const match = new ShooterMatch(config({ botCount })); const state = match.state;
      expect(state.soldiers).toHaveLength(botCount + 1); expect(state.soldiers[0]!.team).toBe(0); expect(state.soldiers[0]!.human).toBe(true);
      expect(Math.abs(state.soldiers.filter(s => s.team === 0).length - state.soldiers.filter(s => s.team === 1).length)).toBeLessThanOrEqual(1);
      expect(state.soldiers.every(s => s.health === CLASSES[s.classId].health && s.protectedUntil === PHYSICS.spawnProtection)).toBe(true);
    }
  });
  it('scores deathmatch eliminations, respawns safely and preserves personal statistics', () => {
    const match = fixture(); const state = match.state;
    killSoldier(state, state.soldiers[1]!, 0); expect(state.scores).toEqual([1, 0]);
    match.step({}, 2.9); const soldier = state.soldiers[1]!;
    expect(soldier.alive).toBe(true); expect(soldier.protectedUntil).toBeGreaterThan(state.time); expect(soldier.stats.deaths).toBe(1);
    expect(soldier.weapons[0].ammo).toBe(WEAPONS[soldier.weapons[0].id].magazine);
  });
  it.each<Mode>(['deathmatch', 'flags'])('ends %s at the score limit and resolves time ties explicitly', mode => {
    const match = fixture({ mode, scoreLimit: 2 }); match.state.scores = [2, 1]; match.step({}); expect(match.state.winnerTeam).toBe(0); expect(match.state.phase).toBe('finished');
    const draw = fixture({ mode, timeLimit: 0.1 }); draw.step({}, 0.2); expect(draw.state.phase).toBe('finished'); expect(draw.state.winnerTeam).toBeNull();
  });
  it('elimination prevents respawns, resets a new round, and completes best-of-three', () => {
    const match = fixture({ mode: 'elimination' }), state = match.state;
    for (const enemy of state.soldiers.filter(s => s.team === 1)) killSoldier(state, enemy, 0);
    match.step({}); expect(state.phase).toBe('round-over'); expect(state.roundWins).toEqual([1, 0]);
    match.step({}, 3); expect(state.soldiers.filter(s => s.team === 1).every(s => !s.alive)).toBe(true);
    match.step({}, 1.2); expect(state.phase).toBe('playing'); expect(state.round).toBe(2); expect(state.soldiers.every(s => s.alive)).toBe(true);
    for (const enemy of state.soldiers.filter(s => s.team === 1)) killSoldier(state, enemy, 0);
    match.step({}); expect(state.phase).toBe('finished'); expect(state.winnerTeam).toBe(0);
  });
  it('handles simultaneous elimination as a drawn round', () => {
    const match = fixture({ mode: 'elimination' }); for (const soldier of match.state.soldiers) killSoldier(match.state, soldier);
    match.step({}); expect(match.state.roundWins).toEqual([0, 0]); expect(match.state.phase).toBe('round-over');
  });
  it('captures, contests, recaptures, and periodically scores flags', () => {
    const match = fixture({ mode: 'flags' }), state = match.state;
    state.flags = [{ id: 0, label: 'A', x: 300, y: 600, owner: null, capturing: null, progress: 0, contested: false }];
    match.step({}, 6.4); expect(state.flags[0]!.owner).toBe(0); expect(state.soldiers[0]!.stats.objective).toBe(100);
    match.step({}, 1); expect(state.scores[0]).toBeGreaterThan(0);
    state.soldiers[1]!.x = 340; match.step({}, 1); expect(state.flags[0]!.contested).toBe(true); expect(state.flags[0]!.owner).toBe(0);
    state.soldiers[0]!.x = 700; match.step({}, 6.4); expect(state.flags[0]!.owner).toBe(1);
  });
  it('fixed steps replay deterministically and a rematch clears all transient state', () => {
    const a = fixture(), b = fixture();
    for (let i = 0; i < 180; i++) {
      const actions = { 0: { move: 1 as const, jump: i === 8, fire: i % 3 === 0, aim: -0.5, grenade: i === 90 } };
      a.step(actions, FIXED_DT); b.step(actions, FIXED_DT);
    }
    expect(a.state).toEqual(b.state);
    const fresh = new ShooterMatch(config()); expect(fresh.state.time).toBe(0); expect(fresh.state.projectiles).toHaveLength(0); expect(fresh.state.soldiers.every(s => s.stats.shots === 0 && s.alive)).toBe(true);
  });
});

describe('frontline environmental evolution', () => {
  it.each<MapId>(['aircraft', 'factory', 'forest', 'city', 'harbor', 'ship'])('telegraphs and activates functional events on %s', mapId => {
    const match = fixture({ mapId }), state = match.state;
    state.arena.platforms.push({ id: 3, x: 1000, y: 500, w: 100, h: 20, active: true, oneWay: true, material: 'wood', hp: 100 });
    state.time = 56.99; match.step({}, 0.04);
    expect(state.eventCycle).toBe(1); expect(state.environment.warningUntil).toBe(60); expect(state.environment.warningUntil).toBeGreaterThan(state.time);
    state.time = 59.99; match.step({}, 0.04); expect(state.environment.activeUntil).toBeGreaterThan(state.time);
    if (mapId === 'factory') { expect(state.arena.hazards.some(h => h.kind === 'steam')).toBe(true); expect(state.weather.lighting).toBeLessThan(1); }
    if (mapId === 'forest') { expect(state.weather.rain).toBeGreaterThan(0.5); expect(state.arena.platforms.some(p => p.id >= 10000)).toBe(true); }
    if (mapId === 'city' || mapId === 'aircraft') expect(state.arena.platforms.find(p => p.id === 3)!.active).toBe(false);
    if (mapId === 'harbor') expect(state.arena.platforms.some(p => p.id >= 10000 && p.moving)).toBe(true);
    if (mapId === 'ship') expect(state.weather.floodY).toBeLessThan(Infinity);
  });
  it('reduced event frequency doubles the initial delay', () => {
    const match = fixture({ eventFrequency: 'reduced' }), state = match.state;
    state.time = 59.9; match.step({}, 0.2); expect(state.eventCycle).toBe(0);
    state.time = 116.99; match.step({}, 0.04); expect(state.environment.warningUntil).toBe(120);
  });
  it('ship flooding damages gradually and slows movement without instant death', () => {
    const match = fixture({ mapId: 'ship' }), state = match.state, soldier = state.soldiers[0]!;
    state.time = 179.99; const before = soldier.health; match.step({ 0: { move: 1 } }, 1);
    expect(soldier.alive).toBe(true); expect(before - soldier.health).toBeGreaterThan(7); expect(before - soldier.health).toBeLessThan(9);
    expect(soldier.x).toBeLessThan(470); expect(state.weather.floodY).toBe(450);
  });
});
