import { describe, expect, it } from 'vitest';
import { ShooterMatch, clipSegmentToRect, damageSoldier, killSoldier, lineOfSight, muzzlePoint, pointInCombatView, raycastGeometry, soldierInCombatView, weaponSlot } from '../src/frontline/core/engine';
import { CLASSES, PHYSICS, WEAPONS } from '../src/frontline/core/config';
import { FIXED_DT, type ClassId, type MapId, type MatchConfig, type Mode, type Projectile } from '../src/frontline/core/types';
import { moveSoldier, overlaps, soldierBox, updateMovingPlatforms } from '../src/frontline/core/physics';

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
  it('treats legacy one-way decks as solid ceilings and floors and ignores drop-through input', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    match.state.arena.platforms.push({ id: 2, x: 200, y: 480, w: 300, h: 20, active: true, oneWay: true, material: 'wood' });
    for (let frame = 0; frame < 60; frame++) {
      match.step({ 0: { jump: frame === 0 } }); expect(soldier.y).toBeGreaterThanOrEqual(554);
    }
    expect(soldier.y).toBe(600);
    soldier.y = 480; soldier.platformId = 2; soldier.grounded = true; soldier.dropUntil = Infinity;
    match.step({ 0: { drop: true, climb: 1 } }, 0.5); expect(soldier.y).toBe(480); expect(soldier.platformId).toBe(2);
  });
  it('cannot climb upward through a gallery even when a ladder incorrectly crosses its solid rectangle', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    match.state.arena.platforms.push({ id: 2, x: 200, y: 380, w: 300, h: 20, active: true, oneWay: true, material: 'metal' });
    match.state.arena.ladders.push({ id: 1, x: 280, y: 322, w: 40, h: 283 });
    match.step({ 0: { climb: -1 } }, 1.4);
    expect(soldier.y).toBe(454); expect(soldier.grounded).toBe(false);
    expect(overlaps(soldierBox(soldier), match.state.arena.platforms[1]!)).toBe(false);
  });
  it('cannot descend through a solid gallery using a ladder or a legacy drop flag', () => {
    const match = fixture(); const soldier = match.state.soldiers[0]!;
    match.state.arena.platforms.push({ id: 2, x: 200, y: 380, w: 300, h: 20, active: true, oneWay: true, material: 'metal' });
    match.state.arena.platforms.push({ id: 3, x: 200, y: 160, w: 300, h: 20, active: true, oneWay: true, material: 'metal' });
    match.state.arena.ladders.push({ id: 1, x: 280, y: 102, w: 40, h: 283 });
    soldier.y = 160; soldier.platformId = 3;
    match.step({ 0: { climb: 1, drop: true } }, 1.4);
    expect(soldier.y).toBe(160); expect(soldier.grounded).toBe(true); expect(soldier.platformId).toBe(3);
  });
  it('ladder centering and diagonal climbing cannot move sideways through a solid obstacle', () => {
    const match = fixture(), state = match.state, soldier = state.soldiers[0]!;
    soldier.x = 270;
    const wall = { id: 2, x: 290, y: 0, w: 20, h: 600, active: true, oneWay: true, material: 'metal' as const };
    state.arena.platforms.push(wall); state.arena.ladders.push({ id: 1, x: 275, y: 0, w: 80, h: 610 });
    match.step({ 0: { climb: -1 } }, 0.25); expect(soldier.x).toBe(276);
    match.step({ 0: { climb: -1, move: 1 } }, 0.25); expect(soldier.x).toBe(276); expect(overlaps(soldierBox(soldier), wall)).toBe(false);
  });
  it('climbs through a real shaft and moves onto its adjacent gallery without entering any platform', () => {
    const match = fixture(), state = match.state, soldier = state.soldiers[0]!;
    state.arena.platforms.push(
      { id: 2, x: 100, y: 380, w: 168, h: 20, active: true, oneWay: true, material: 'metal' },
      { id: 3, x: 332, y: 380, w: 200, h: 20, active: true, oneWay: true, material: 'metal' });
    state.arena.ladders.push({ id: 1, x: 280, y: 300, w: 40, h: 305 });
    const check = () => expect(state.arena.platforms.some(platform => overlaps(soldierBox(soldier), platform))).toBe(false);
    for (let frame = 0; frame < 72; frame++) { match.step({ 0: { climb: -1 } }); check(); }
    expect(soldier.y).toBeLessThan(380);
    for (let frame = 0; frame < 22; frame++) { match.step({ 0: { climb: -1, move: 1 } }); check(); }
    for (let frame = 0; frame < 50; frame++) { match.step({}); check(); }
    expect(soldier.y).toBe(380); expect(soldier.platformId).toBe(3); expect(soldier.grounded).toBe(true);
  });
  it('descends a real gallery opening and lands on the floor below', () => {
    const match = fixture(), state = match.state, soldier = state.soldiers[0]!;
    state.arena.platforms.push(
      { id: 2, x: 100, y: 380, w: 168, h: 20, active: true, oneWay: true, material: 'metal' },
      { id: 3, x: 332, y: 380, w: 200, h: 20, active: true, oneWay: true, material: 'metal' });
    state.arena.ladders.push({ id: 1, x: 280, y: 300, w: 40, h: 305 });
    soldier.y = 370; soldier.grounded = false; soldier.platformId = null;
    for (let frame = 0; frame < 90; frame++) {
      match.step({ 0: { climb: 1, drop: true } });
      expect(state.arena.platforms.some(platform => overlaps(soldierBox(soldier), platform))).toBe(false);
    }
    expect(soldier.y).toBe(600); expect(soldier.grounded).toBe(true); expect(soldier.platformId).toBe(1);
  });
  it.each([-1, 1])('sweeps fast horizontal body contact in direction %s against thin legacy decks', direction => {
    const match = fixture(), state = match.state, soldier = state.soldiers[0]!;
    state.arena.platforms.push({ id: 2, x: 400, y: 500, w: 1, h: 100, active: true, oneWay: true, material: 'metal' });
    soldier.x = direction > 0 ? 300 : 500; soldier.vx = direction * 30000;
    moveSoldier(state, soldier, {}, FIXED_DT);
    expect(soldier.x).toBe(direction > 0 ? 386 : 415); expect(soldier.vx).toBe(0);
  });
  it('sweeps fast upward and downward contacts against thin platforms', () => {
    const match = fixture(), state = match.state, soldier = state.soldiers[0]!;
    state.arena.platforms.push({ id: 2, x: 200, y: 480, w: 300, h: 1, active: true, oneWay: true, material: 'metal' });
    soldier.y = 600; soldier.vy = -30000; soldier.grounded = false; soldier.coyoteUntil = -1;
    moveSoldier(state, soldier, {}, FIXED_DT); expect(soldier.y).toBe(535); expect(soldier.vy).toBe(0);
    soldier.y = 400; soldier.vy = 1000;
    moveSoldier(state, soldier, {}, 0.2); expect(soldier.y).toBe(480); expect(soldier.grounded).toBe(true);
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
  it.each([false, true])('moving cargo pushes soldiers regardless of its legacy oneWay=%s flag', oneWay => {
    const match = fixture(); const state = match.state, soldier = state.soldiers[0]!;
    soldier.x = 450;
    state.arena.platforms.push({ id: 2, x: 200, y: 520, w: 100, h: 80, active: true, oneWay, material: 'metal', moving: { axis: 'x', from: 200, to: 600, period: 4, phase: 0 } });
    match.step({}, 1.2);
    const cargo = state.arena.platforms[1]!;
    expect(soldier.x - PHYSICS.radius).toBeGreaterThanOrEqual(cargo.x + cargo.w - 0.1); expect(soldier.alive).toBe(true);
  });
  it('stops a lift before its passenger is carried through a solid ceiling', () => {
    const match = fixture(), state = match.state, soldier = state.soldiers[0]!;
    const lift = { id: 2, x: 200, y: 500, w: 200, h: 20, active: true, oneWay: true, material: 'metal' as const,
      moving: { axis: 'y' as const, from: 500, to: 300, period: 4, phase: 0 } };
    const ceiling = { id: 3, x: 200, y: 350, w: 200, h: 20, active: true, oneWay: true, material: 'metal' as const };
    state.arena.platforms.push(lift, ceiling); soldier.y = 500; soldier.platformId = 2;
    match.step({}, 1.5);
    expect(lift.y).toBe(424); expect(soldier.y).toBe(424); expect(overlaps(soldierBox(soldier), ceiling)).toBe(false);
    expect(soldier.grounded).toBe(true); expect(soldier.platformId).toBe(2);
  });
  it('stops pushing cargo before pinning a soldier through an opposing wall', () => {
    const match = fixture(), state = match.state, soldier = state.soldiers[0]!;
    soldier.x = 450;
    const cargo = { id: 2, x: 200, y: 520, w: 100, h: 80, active: true, oneWay: true, material: 'metal' as const,
      moving: { axis: 'x' as const, from: 200, to: 700, period: 4, phase: 0 } };
    const wall = { id: 3, x: 600, y: 0, w: 20, h: 600, active: true, oneWay: true, material: 'metal' as const };
    state.arena.platforms.push(cargo, wall); match.step({}, 2);
    expect(soldier.x).toBe(586); expect(cargo.x).toBe(472);
    expect(overlaps(soldierBox(soldier), wall)).toBe(false); expect(overlaps(soldierBox(soldier), cargo)).toBe(false);
  });
  it('sweeps moving platform contacts instead of passing across a body in a single update', () => {
    const match = fixture(), state = match.state, soldier = state.soldiers[0]!;
    const cargo = { id: 2, x: 0, y: 520, w: 40, h: 80, active: true, oneWay: true, material: 'metal' as const,
      moving: { axis: 'x' as const, from: 0, to: 1000, period: 4, phase: 0 } };
    state.arena.platforms.push(cargo); state.time = 1; updateMovingPlatforms(state);
    expect(cargo.x).toBeCloseTo(500); expect(soldier.x).toBeCloseTo(554); expect(overlaps(soldierBox(soldier), cargo)).toBe(false);
  });
});

describe('frontline firearm combat', () => {
  it('blocks sight through every active obstacle, including thin and grazing one-way decks', () => {
    const match = fixture(), arena = match.state.arena;
    const deck = { id: 2, x: 400, y: 350, w: 0.5, h: 220, active: true, oneWay: true, material: 'metal' as const };
    arena.platforms.push(deck);
    expect(lineOfSight(arena, { x: 300, y: 450 }, { x: 1000, y: 450 })).toBe(false);
    expect(lineOfSight(arena, { x: 1000, y: 450 }, { x: 300, y: 450 })).toBe(false);
    expect(lineOfSight(arena, { x: 300, y: 350 }, { x: 1000, y: 350 })).toBe(false);
    expect(raycastGeometry(arena, { x: 300, y: 450 }, { x: 1000000, y: 450 })?.point.x).toBe(400);
    expect(lineOfSight(arena, { x: 300, y: 349 }, { x: 1000, y: 349 })).toBe(true);
    deck.active = false;
    expect(lineOfSight(arena, { x: 300, y: 450 }, { x: 1000, y: 450 })).toBe(true);
  });
  it.each([-1, 1])('blocks hitscan through a horizontal deck in direction %s', direction => {
    const match = fixture(), state = match.state, shooter = state.soldiers[0]!, target = state.soldiers[1]!;
    shooter.x = 500; target.x = 500;
    shooter.y = direction < 0 ? 600 : 380; target.y = direction < 0 ? 380 : 600;
    state.arena.platforms.push({ id: 2, x: 200, y: 480, w: 700, h: 20, active: true, oneWay: true, material: 'metal' });
    const before = target.health;
    match.step({ 0: { fire: true, aim: direction * Math.PI / 2 } });
    expect(target.health).toBe(before);
    expect(state.tracers[0]!.to.y).toBeCloseTo(direction < 0 ? 500 : 480);
  });
  it('allows firing after a destructible obstacle becomes inactive', () => {
    const match = fixture(), state = match.state;
    state.arena.platforms.push({ id: 2, x: 450, y: 500, w: 20, h: 100, active: false, oneWay: true, material: 'wood', hp: 0 });
    match.step({ 0: { fire: true, aim: 0 } });
    expect(state.soldiers[1]!.health).toBeLessThan(state.soldiers[1]!.maxHealth);
  });
  it.each(['vanguard', 'comet'] as const)('prevents %s shots originating beyond a clipped muzzle', weapon => {
    const match = fixture(), state = match.state;
    state.soldiers[0]!.weapons[0] = weaponSlot(weapon);
    state.arena.platforms.push({ id: 2, x: 315, y: 530, w: 8, h: 70, active: true, oneWay: true, material: 'metal' });
    match.step({ 0: { fire: true, aim: 0 } });
    expect(state.soldiers[1]!.health).toBe(state.soldiers[1]!.maxHealth);
    expect(state.projectiles).toHaveLength(0);
    expect(state.events.some(e => e.type === 'impact' && e.x === 315)).toBe(true);
  });
  it('blocks guns and keeps grenades on the near side when the shoulder is inside a traversable deck', () => {
    for (const weapon of ['vanguard', 'comet'] as const) {
      const match = fixture(), state = match.state, shooter = state.soldiers[0]!, target = state.soldiers[1]!;
      shooter.x = 500; shooter.y = 520; shooter.weapons[0] = weaponSlot(weapon); target.x = 500; target.y = 380;
      state.arena.platforms.push({ id: 2, x: 200, y: 480, w: 700, h: 20, active: true, oneWay: true, material: 'metal' });
      expect(lineOfSight(state.arena, { x: 500, y: 486 }, { x: 500, y: 350 })).toBe(false);
      match.step({ 0: { fire: true, grenade: true, aim: -Math.PI / 2 } });
      expect(target.health).toBe(target.maxHealth); expect(state.tracers).toHaveLength(0);
      expect(state.projectiles).toHaveLength(1); expect(state.projectiles[0]!.kind).toBe('grenade');
      expect(state.projectiles[0]!.y).toBeGreaterThan(500);
    }
  });
  it.each([-1, 1])('keeps a horizontal grenade near the soldier when throwing from inside a wide deck, direction %s', direction => {
    const match = fixture(), state = match.state, soldier = state.soldiers[0]!;
    soldier.x = 500; soldier.y = 520;
    state.arena.platforms.push({ id: 2, x: 200, y: 480, w: 700, h: 20, active: true, oneWay: true, material: 'metal' });
    match.step({ 0: { grenade: true, aim: direction < 0 ? Math.PI : 0 } });
    expect(state.projectiles).toHaveLength(1);
    const grenade = state.projectiles[0]!;
    expect(Math.abs(grenade.x - soldier.x)).toBeLessThan(40);
    expect(grenade.y).toBeGreaterThan(500);
    expect(Math.sign(grenade.vx)).toBe(direction);
  });
  it('recovers projectile starts inside a wide deck to a nearby face with an outward bounce', () => {
    for (const kind of ['grenade', 'rocket'] as const) for (const direction of [-1, 1]) for (const y of [486, 496]) {
      const match = fixture(), state = match.state;
      state.arena.platforms.push({ id: 2, x: 200, y: 480, w: 700, h: 20, active: true, oneWay: true, material: 'metal' });
      state.projectiles.push({ id: 88, x: 500, y, vx: direction * 600, vy: y < 490 ? -80 : 80, gravity: 0,
        kind, owner: 0, team: 0, damage: 85, radius: 135, expires: 5, weapon: kind === 'grenade' ? 'thumper' : 'comet' });
      match.step({});
      if (kind === 'rocket') {
        expect(state.projectiles).toHaveLength(0);
        const explosion = state.events.find(event => event.type === 'explosion')!;
        expect(Math.abs(explosion.x - 500)).toBeLessThan(30); expect(Math.abs(explosion.y - y)).toBeLessThan(20);
        expect(y < 490 ? explosion.y < 480 : explosion.y > 500).toBe(true);
        continue;
      }
      const grenade = state.projectiles[0]!;
      expect(Math.abs(grenade.x - 500)).toBeLessThan(30); expect(Math.abs(grenade.y - y)).toBeLessThan(20);
      expect(y < 490 ? grenade.y < 480 : grenade.y > 500).toBe(true);
      expect(Math.sign(grenade.vx)).toBe(direction);
      expect(y < 490 ? grenade.vy <= 0 : grenade.vy >= 0).toBe(true);
    }
  });
  it.each([-1, 1])('stops high-speed rockets and grenades at either deck face in direction %s', direction => {
    for (const kind of ['rocket', 'grenade'] as const) {
      const match = fixture(), state = match.state, target = state.soldiers[1]!;
      target.x = 500; target.y = direction < 0 ? 450 : 600;
      state.arena.platforms.push({ id: 2, x: 200, y: 480, w: 700, h: 20, active: true, oneWay: true, material: 'metal' });
      state.projectiles.push({ id: 88, x: 500, y: direction < 0 ? 540 : 430, vx: 0, vy: direction * 12000, gravity: 0,
        kind, owner: 0, team: 0, damage: 105, radius: 155, expires: 5, weapon: kind === 'rocket' ? 'comet' : 'thumper' });
      match.step({}, FIXED_DT);
      expect(target.health).toBe(target.maxHealth);
      if (kind === 'rocket') {
        expect(state.projectiles).toHaveLength(0);
        const explosion = state.events.find(e => e.type === 'explosion')!;
        expect(direction < 0 ? explosion.y >= 500 : explosion.y <= 480).toBe(true);
      } else {
        expect(state.projectiles).toHaveLength(1);
        expect(direction < 0 ? state.projectiles[0]!.y >= 500 : state.projectiles[0]!.y <= 480).toBe(true);
        expect(Math.sign(state.projectiles[0]!.vy)).toBe(-direction);
      }
    }
  });
  it('blocks blast damage to soldiers, medic stations and cover behind a deck', () => {
    const match = fixture(), state = match.state, target = state.soldiers[1]!;
    target.x = 500; target.y = 420;
    state.arena.platforms.push({ id: 2, x: 200, y: 480, w: 700, h: 20, active: true, oneWay: true, material: 'metal' });
    const cover = { id: 3, x: 500, y: 420, w: 25, h: 30, active: true, oneWay: true, material: 'wood' as const, hp: 150 };
    state.arena.platforms.push(cover);
    state.stations.push({ id: 9, owner: 1, team: 1, x: 530, y: 450, health: 90, capacity: 250, until: 10 });
    state.projectiles.push({ id: 88, x: 500, y: 525, vx: 0, vy: 0, gravity: 0, kind: 'grenade', owner: 0, team: 0, damage: 105, radius: 200, expires: 0, weapon: 'thumper' });
    match.step({});
    expect(target.health).toBe(target.maxHealth); expect(state.stations[0]!.health).toBe(90); expect(cover.hp).toBe(150);
  });
  it('lets a blast destroy its first obstacle without penetrating to another obstacle behind it', () => {
    const match = fixture(), state = match.state;
    const front = { id: 2, x: 450, y: 500, w: 20, h: 100, active: true, oneWay: true, material: 'wood' as const, hp: 50 };
    const rear = { ...front, id: 3, x: 490 };
    state.arena.platforms.push(front, rear);
    state.projectiles.push({ id: 88, x: 420, y: 550, vx: 0, vy: 0, gravity: 0, kind: 'grenade', owner: 0, team: 0, damage: 105, radius: 200, expires: 0, weapon: 'thumper' });
    match.step({});
    expect(front.active).toBe(false); expect(rear.active).toBe(true); expect(rear.hp).toBe(50);
  });
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
  it('awards stronger headshots while allowing a full-health target to survive the first sniper hit', () => {
    const match = fixture(); const state = match.state, shooter = state.soldiers[0]!, target = state.soldiers[1]!;
    shooter.weapons[0] = weaponSlot('longbow');
    match.step({ 0: { aim: Math.atan2(-16, 350), fire: true } });
    expect(target.alive).toBe(true); expect(target.health).toBe(target.maxHealth - WEAPONS.longbow.damage * 2);
    expect(shooter.stats.kills).toBe(0); expect(shooter.stats.hits).toBe(1);
    match.step({ 0: { aim: Math.atan2(-16, 350), fire: true } }, 1.2);
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
  it('bounces grenades thrown upward off the underside of a gallery', () => {
    const match = fixture(); const state = match.state;
    state.arena.platforms.push({ id: 2, x: 200, y: 480, w: 700, h: 20, active: true, oneWay: true, material: 'metal' });
    match.step({ 0: { grenade: true, aim: -1.2 } }); match.step({}, 0.14);
    expect(state.projectiles).toHaveLength(1); expect(state.projectiles[0]!.y).toBeGreaterThan(500); expect(state.projectiles[0]!.vy).toBeGreaterThan(0);
  });
  it('destroys lightweight cover and refreshes navigation', () => {
    const match = fixture(); const state = match.state, nav = state.arena.nav;
    const cover = { id: 2, x: 450, y: 500, w: 25, h: 100, active: true, oneWay: false, material: 'glass' as const, hp: 10 };
    state.arena.platforms.push(cover); match.step({ 0: { fire: true, aim: 0 } });
    expect(cover.active).toBe(false); expect(state.arena.nav).not.toBe(nav);
  });
});

describe('frontline combat reaction time and survivability', () => {
  it.each<ClassId>(['assault', 'support', 'defense', 'sniper'])('lets a full-health %s survive an incoming sniper headshot', humanClass => {
    const match = fixture({ humanClass }), state = match.state, human = state.soldiers[0]!, attacker = state.soldiers[1]!;
    attacker.weapons[0] = weaponSlot('longbow');
    match.step({ 1: { fire: true, aim: Math.atan2(-16, human.x - attacker.x) } });
    expect(human.alive).toBe(true); expect(human.health).toBe(human.maxHealth - 130);
    expect(attacker.stats.hits).toBe(1); expect(attacker.stats.kills).toBe(0);
  });
  it.each<ClassId>(['assault', 'support', 'defense', 'sniper'])('lets a full-health %s survive a complete close-range shotgun headshot volley', humanClass => {
    const match = fixture({ humanClass }), state = match.state, human = state.soldiers[0]!, attacker = state.soldiers[1]!;
    attacker.x = 360; attacker.weapons[0] = weaponSlot('breach');
    match.step({ 1: { fire: true, aim: Math.atan2(-16, human.x - attacker.x) } });
    expect(attacker.stats.hits).toBe(8); expect(human.alive).toBe(true);
    expect(human.health).toBeGreaterThan(human.maxHealth * 0.3); expect(human.health).toBeLessThan(human.maxHealth);
  });
  it.each<ClassId>(['assault', 'support', 'defense', 'sniper'])('lets a full-health %s survive a direct rocket', humanClass => {
    const match = fixture({ humanClass }), state = match.state, human = state.soldiers[0]!, attacker = state.soldiers[1]!;
    attacker.weapons[0] = weaponSlot('comet');
    match.step({ 1: { fire: true, aim: Math.PI } }); match.step({}, 0.5);
    expect(state.projectiles).toHaveLength(0); expect(human.alive).toBe(true);
    expect(human.health).toBeGreaterThan(0); expect(human.health).toBeLessThan(human.maxHealth);
  });
  it('lets the most fragile class survive a hand grenade at the center of its blast', () => {
    const match = fixture({ humanClass: 'sniper' }), state = match.state, human = state.soldiers[0]!;
    state.projectiles.push({ id: 998, owner: 1, team: 1, kind: 'grenade', x: human.x, y: human.y - 28,
      vx: 0, vy: 0, gravity: 0, damage: 85, radius: 135, expires: 0, weapon: 'thumper' });
    match.step({}); expect(human.alive).toBe(true); expect(human.health).toBeCloseTo(human.maxHealth - 85);
  });
  it('provides over a second to react to uninterrupted assault-rifle body hits', () => {
    const match = fixture(), state = match.state, human = state.soldiers[0]!, attacker = state.soldiers[1]!;
    const aim = Math.atan2(12, human.x - attacker.x);
    let firstDamage = -1;
    for (let frame = 0; frame < 180 && human.alive; frame++) {
      match.step({ 1: { fire: true, aim } });
      if (firstDamage < 0 && human.health < human.maxHealth) firstDamage = state.time;
    }
    expect(human.alive).toBe(false); expect(attacker.stats.shots).toBe(12); expect(attacker.stats.hits).toBe(12);
    expect(state.time - firstDamage).toBeGreaterThan(1.2); expect(state.time - firstDamage).toBeLessThan(1.5);
    expect(attacker.stats.kills).toBe(1); expect(attacker.stats.damage).toBe(human.maxHealth);
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
  it('places event cover clear of every active platform, including legacy one-way galleries', () => {
    const match = fixture({ mapId: 'forest' }), state = match.state;
    const gallery = { id: 2, x: 900, y: 540, w: 220, h: 20, active: true, oneWay: true, material: 'wood' as const };
    state.arena.platforms.push(gallery); state.time = 59.99; match.step({}, 0.04);
    const cover = state.arena.platforms.find(platform => platform.id >= 10000)!;
    expect(cover).toBeDefined(); expect(cover.x).toBe(1140);
    expect(state.arena.platforms.some(platform => platform.id !== cover.id && platform.active && overlaps(platform, cover))).toBe(false);
  });
  it('pushes a soldier clear of the complete first movement of delivered event cargo', () => {
    const match = fixture({ mapId: 'harbor' }), state = match.state, soldier = state.soldiers[0]!;
    soldier.x = 720; soldier.y = 350; soldier.grounded = false; soldier.platformId = null;
    state.time = 59.99; match.step({}, 0.04);
    const cargo = state.arena.platforms.find(platform => platform.id >= 10000 && platform.moving)!;
    expect(cargo).toBeDefined(); expect(soldier.x).toBeLessThan(720);
    expect(soldier.x + PHYSICS.radius).toBeLessThanOrEqual(cargo.x + 1e-6); expect(overlaps(soldierBox(soldier), cargo)).toBe(false);
  });
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
  it('warns before aircraft pressure leaks and varies the compartment without repeating it', () => {
    const first = fixture(), repeat = fixture();
    const zones: number[] = [];
    for (const time of [56.99, 116.99, 176.99]) {
      for (const match of [first, repeat]) { match.state.time = time; match.step({}, 0.04); }
      const a = first.state.arena.hazards.find(hazard => hazard.starts > first.state.time)!;
      const b = repeat.state.arena.hazards.find(hazard => hazard.starts > repeat.state.time)!;
      expect(a).toEqual(b); expect(a.starts - first.state.time).toBeGreaterThan(2.9);
      expect(a.x).toBeGreaterThanOrEqual(0); expect(a.x + a.w).toBeLessThanOrEqual(first.state.arena.width);
      if (zones.length) expect(a.x).not.toBe(zones.at(-1));
      zones.push(a.x);
    }
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

describe('frontline authoritative camera combat bounds', () => {
  const edges = [
    { name: 'left', aim: Math.PI, dx: -1, dy: 0 },
    { name: 'right', aim: 0, dx: 1, dy: 0 },
    { name: 'top', aim: -Math.PI / 2, dx: 0, dy: -1 },
    { name: 'bottom', aim: Math.PI / 2, dx: 0, dy: 1 },
  ];
  function projectile(overrides: Partial<Projectile> = {}): Projectile {
    return { id: 999, x: 350, y: 350, vx: 0, vy: 0, gravity: 0, kind: 'grenade', owner: 0, team: 0,
      damage: 85, radius: 135, expires: 10, weapon: 'thumper', ...overrides };
  }
  it('clones and normalizes the camera rectangle, clamps it to the arena, and allows explicitly restoring standalone combat', () => {
    const match = fixture(), view = { x: 700, y: 700, w: -800, h: -600 };
    match.setCombatView(view);
    expect(match.state.combatView).toEqual({ x: 0, y: 100, w: 700, h: 580 });
    view.x = 1000; expect(match.state.combatView!.x).toBe(0);
    expect(soldierInCombatView(match.state, { x: -5, y: 200 })).toBe(true);
    expect(soldierInCombatView(match.state, { x: -50, y: 200 })).toBe(false);
    match.setCombatView(undefined); expect(match.state.combatView).toBeUndefined();
    match.step({ 0: { fire: true, aim: 0 } }); expect(match.state.soldiers[1]!.health).toBeLessThan(match.state.soldiers[1]!.maxHealth);
  });
  it('treats empty or invalid views as having no combat area', () => {
    for (const view of [{ x: 0, y: 0, w: 0, h: 200 }, { x: NaN, y: 0, w: 500, h: 500 }, { x: 3000, y: 0, w: 500, h: 500 }]) {
      const match = fixture(), shooter = match.state.soldiers[0]!;
      match.setCombatView(view); match.step({ 0: { fire: true, grenade: true } });
      expect(shooter.stats.shots).toBe(0); expect(match.state.projectiles).toHaveLength(0); expect(match.state.tracers).toHaveLength(0);
    }
  });
  it('clips diagonal and crossing segments and rejects a parallel segment outside the view', () => {
    const view = { x: 200, y: 200, w: 300, h: 300 };
    expect(clipSegmentToRect({ x: 0, y: 0 }, { x: 700, y: 700 }, view)).toMatchObject({ from: { x: 200, y: 200 }, to: { x: 500, y: 500 } });
    expect(clipSegmentToRect({ x: 100, y: 350 }, { x: 600, y: 350 }, view)).toMatchObject({ from: { x: 200, y: 350 }, to: { x: 500, y: 350 } });
    expect(clipSegmentToRect({ x: 100, y: 100 }, { x: 100, y: 600 }, view)).toBeNull();
  });
  it.each(edges)('clips hitscan tracers at the $name camera edge', edge => {
    const match = fixture(), state = match.state, shooter = state.soldiers[0]!;
    state.arena.platforms = []; shooter.x = 1000; shooter.y = 400; shooter.grounded = false; shooter.weapons[0] = weaponSlot('kestrel');
    match.setCombatView({ x: 800, y: 166, w: 400, h: 400 });
    match.step({ 0: { fire: true, aim: edge.aim } });
    expect(shooter.stats.shots).toBe(1); expect(state.tracers).toHaveLength(1);
    const tracer = state.tracers[0]!;
    expect(pointInCombatView(state, tracer.from)).toBe(true); expect(pointInCombatView(state, tracer.to)).toBe(true);
    if (edge.dx) expect(tracer.to.x).toBeCloseTo(edge.dx < 0 ? 800 : 1200);
    else expect(tracer.to.y).toBeCloseTo(edge.dy < 0 ? 166 : 566);
  });
  it.each(edges)('rejects an attacker beyond the $name edge without consuming ammunition or grenades', edge => {
    const match = fixture(), state = match.state, shooter = state.soldiers[0]!;
    state.arena.platforms = []; shooter.x = 350 + edge.dx * 200; shooter.y = 384 + edge.dy * 200; shooter.grounded = false;
    match.setCombatView({ x: 200, y: 200, w: 300, h: 300 });
    const ammo = shooter.weapons[0].ammo, grenades = shooter.grenades;
    match.step({ 0: { fire: true, grenade: true, aim: edge.aim + Math.PI } });
    expect(shooter.weapons[0].ammo).toBe(ammo); expect(shooter.grenades).toBe(grenades); expect(shooter.stats.shots).toBe(0);
    expect(state.events.some(event => event.type === 'shot')).toBe(false);
  });
  it.each(edges)('rejects a shoulder-to-muzzle segment crossing the $name edge', edge => {
    const match = fixture(), state = match.state, shooter = state.soldiers[0]!;
    state.arena.platforms = []; shooter.x = 350 + edge.dx * 135; shooter.y = 384 + edge.dy * 135; shooter.grounded = false;
    match.setCombatView({ x: 200, y: 200, w: 300, h: 300 });
    expect(soldierInCombatView(state, shooter)).toBe(true);
    match.step({ 0: { fire: true, grenade: true, aim: edge.aim } });
    expect(shooter.stats.shots).toBe(0); expect(state.projectiles).toHaveLength(0); expect(state.tracers).toHaveLength(0);
  });
  it.each(['bullet', 'rocket', 'grenade'] as const)('discards a fast travelling %s at every edge without a boundary explosion', kind => {
    for (const edge of edges) {
      const match = fixture(), state = match.state;
      match.setCombatView({ x: 200, y: 200, w: 300, h: 300 });
      state.projectiles.push(projectile({ kind, vx: edge.dx * 60000, vy: edge.dy * 60000, expires: 0 }));
      match.step({});
      expect(state.projectiles).toHaveLength(0); expect(state.events.some(event => event.type === 'explosion' || event.type === 'damage')).toBe(false);
    }
  });
  it('removes rounds starting outside instead of allowing them to enter the visible arena', () => {
    const match = fixture(), state = match.state;
    match.setCombatView({ x: 200, y: 200, w: 300, h: 300 });
    state.projectiles.push(projectile({ x: 510, vx: -1200, expires: 0 })); match.step({});
    expect(state.projectiles).toHaveLength(0); expect(state.events.some(event => event.type === 'explosion')).toBe(false);
  });
  it('removes excluded rounds and clips existing tracers immediately when the camera moves', () => {
    const match = fixture(), state = match.state;
    match.setCombatView({ x: 200, y: 200, w: 500, h: 300 });
    state.projectiles.push(projectile({ x: 250 }), projectile({ id: 1000, x: 650 }));
    state.tracers.push({ id: 1001, owner: 0, from: { x: 250, y: 350 }, to: { x: 650, y: 350 }, until: 1, weapon: 'kestrel', hit: false });
    match.setCombatView({ x: 500, y: 200, w: 500, h: 300 });
    expect(state.projectiles.map(round => round.id)).toEqual([1000]);
    expect(state.tracers[0]).toMatchObject({ from: { x: 500, y: 350 }, to: { x: 650, y: 350 } });
    match.setCombatView({ x: 1000, y: 200, w: 500, h: 300 });
    expect(state.projectiles).toHaveLength(0); expect(state.tracers).toHaveLength(0);
  });
  it('allows visible gunfire while preventing damage to a target whose torso is outside the view', () => {
    const match = fixture(), state = match.state, shooter = state.soldiers[0]!, target = state.soldiers[1]!;
    match.setCombatView({ x: 200, y: 400, w: 500, h: 250 });
    match.step({ 0: { fire: true, aim: 0 } }); expect(target.health).toBeLessThan(target.maxHealth);
    target.health = target.maxHealth; target.x = 705; shooter.weapons[0].readyAt = 0;
    match.step({ 0: { fire: true, aim: 0 } }); expect(target.health).toBe(target.maxHealth);
    expect(state.tracers.every(tracer => pointInCombatView(state, tracer.to))).toBe(true);
  });
  it('limits blast damage to visible targets and visible stations while preserving an on-screen blast', () => {
    const match = fixture(), state = match.state, inside = state.soldiers[1]!, outside = state.soldiers[3]!;
    inside.x = 460; inside.y = 428; inside.grounded = false; outside.x = 520; outside.y = 428; outside.grounded = false;
    state.stations = [{ id: 10, owner: 1, team: 1, x: 520, y: 416, health: 90, capacity: 250, until: 10 }];
    match.setCombatView({ x: 200, y: 200, w: 300, h: 300 });
    state.projectiles.push(projectile({ x: 490, y: 400, expires: 0 })); match.step({});
    expect(inside.health).toBeLessThan(inside.maxHealth); expect(outside.health).toBe(outside.maxHealth); expect(state.stations[0]!.health).toBe(90);
    expect(state.events.some(event => event.type === 'explosion')).toBe(true);
  });
  it('does not detonate off-screen expired grenades or apply their splash damage inside the screen', () => {
    const match = fixture(), state = match.state, target = state.soldiers[1]!;
    target.x = 480; target.y = 428; target.grounded = false;
    match.setCombatView({ x: 200, y: 200, w: 300, h: 300 });
    state.projectiles.push(projectile({ x: 510, y: 400, expires: 0 })); match.step({});
    expect(target.health).toBe(target.maxHealth); expect(state.events.some(event => event.type === 'explosion')).toBe(false);
    expect(damageSoldier(state, target, 50, 0, { x: 510, y: 400 }, 'explosion')).toBe(0);
  });
  it('still resolves an on-screen collision before a fast projectile would cross the viewport boundary', () => {
    const match = fixture(), state = match.state;
    state.arena.platforms.push({ id: 2, x: 450, y: 250, w: 10, h: 200, active: true, oneWay: true, material: 'metal' });
    match.setCombatView({ x: 200, y: 200, w: 300, h: 300 });
    state.projectiles.push(projectile({ vx: 60000 })); match.step({});
    expect(state.projectiles).toHaveLength(1); expect(state.projectiles[0]!.x).toBe(447); expect(state.projectiles[0]!.vx).toBeLessThan(0);
    expect(pointInCombatView(state, state.projectiles[0]!)).toBe(true);
  });
  it('travelling bullets stop at cover and damage a visible enemy without producing a blast', () => {
    const match = fixture(), state = match.state, target = state.soldiers[1]!;
    match.setCombatView({ x: 200, y: 400, w: 600, h: 250 });
    state.projectiles.push(projectile({ kind: 'bullet', x: 400, y: 566, vx: 20000, damage: 15, radius: 0 })); match.step({});
    expect(target.health).toBe(target.maxHealth - 15); expect(state.projectiles).toHaveLength(0); expect(state.events.some(event => event.type === 'explosion')).toBe(false);
    target.health = target.maxHealth;
    state.arena.platforms.push({ id: 2, x: 450, y: 500, w: 10, h: 100, active: true, oneWay: true, material: 'wood', hp: 50 });
    state.projectiles.push(projectile({ kind: 'bullet', x: 400, y: 566, vx: 20000, damage: 15, radius: 0 })); match.step({});
    expect(target.health).toBe(target.maxHealth); expect(state.arena.platforms[1]!.hp).toBe(35); expect(state.projectiles).toHaveLength(0);
  });
  it('keeps inside-deck grenade recovery near the body and refuses an ejection outside the viewport', () => {
    for (const aim of [0, Math.PI]) {
      for (const bottom of [573, 610]) {
        const match = fixture(), state = match.state, shooter = state.soldiers[0]!;
        state.arena.platforms.push({ id: 2, x: 100, y: 550, w: 700, h: 20, active: true, oneWay: true, material: 'metal' });
        match.setCombatView({ x: 200, y: 500, w: 300, h: bottom - 500 });
        match.step({ 0: { grenade: true, aim } });
        if (bottom === 573) { expect(state.projectiles).toHaveLength(0); expect(shooter.grenades).toBe(2); }
        else {
          expect(state.projectiles).toHaveLength(1); const round = state.projectiles[0]!;
          expect(Math.abs(round.x - shooter.x)).toBeLessThan(40); expect(round.y).toBeGreaterThan(570);
          expect(pointInCombatView(state, round)).toBe(true); expect(Math.sign(round.vx)).toBe(aim === 0 ? 1 : -1);
        }
      }
    }
  });
});
