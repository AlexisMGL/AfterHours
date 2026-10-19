import { describe, expect, it } from 'vitest';
import { Match, applyPowerUp, canOccupy, explosionTiles } from '../src/core/engine';
import { GAMEPLAY } from '../src/core/tuning';
import { FIXED_DT, type Bomb, type MapId, type MatchState } from '../src/core/types';

function fixture(mapId: MapId = 'mall'): Match {
  const match = new Match({ mapId, seed: 2026, opponents: 1, difficulties: ['normal'] });
  const state = match.state;
  for (let y = 1; y < state.arena.height - 1; y++) for (let x = 1; x < state.arena.width - 1; x++) state.arena.tiles[y]![x] = 'floor';
  state.arena.conveyors = []; state.arena.vents = []; state.arena.vegetation = []; state.arena.hidden = {};
  state.portals = []; state.players[0]!.x = 3; state.players[0]!.y = 3;
  state.players[1]!.x = 11; state.players[1]!.y = 11;
  return match;
}

function bomb(state: MatchState, x: number, y: number, options: Partial<Bomb> = {}): Bomb {
  const result: Bomb = { id: state.bombs.length + 100, owner: 0, x, y, range: 2, detonateAt: state.time + 2.5,
    remote: false, slideSpeed: 0, slideRemaining: 0, portalCooldown: 0, passThrough: [], ...options };
  state.bombs.push(result);
  return result;
}

describe('authoritative movement', () => {
  it('collides with walls using the full player footprint', () => {
    const match = fixture(); match.state.arena.tiles[3]![4] = 'wall';
    match.step({ 0: { move: 'right' } }, 1);
    expect(match.state.players[0]!.x).toBeGreaterThan(3.15);
    expect(match.state.players[0]!.x).toBeLessThanOrEqual(3.231);
    expect(canOccupy(match.state, match.state.players[0]!, 3.4, 3)).toBe(false);
  });
  it('centers a slightly misaligned character while entering a corridor', () => {
    const match = fixture(); const player = match.state.players[0]!;
    player.y = 3.34;
    match.state.arena.tiles[4]![4] = 'wall'; match.state.arena.tiles[2]![4] = 'wall';
    match.step({ 0: { move: 'right' } }, 0.7);
    expect(player.x).toBeGreaterThan(4.5);
    expect(Math.abs(player.y - 3)).toBeLessThan(0.24);
  });
  it('allows leaving an owned bomb and prevents walking back through it', () => {
    const match = fixture(); const player = match.state.players[0]!;
    match.step({ 0: { bomb: true } });
    match.step({ 0: { move: 'right' } }, 0.5);
    expect(player.x).toBeGreaterThan(4.5);
    expect(match.state.bombs[0]!.passThrough).not.toContain(0);
    match.step({ 0: { move: 'left' } }, 0.5);
    expect(player.x).toBeGreaterThanOrEqual(3.57);
  });
});

describe('bombs and explosions', () => {
  it('enforces simultaneous capacity and unique placement cells', () => {
    const match = fixture(); match.step({ 0: { bomb: true } });
    match.step({ 0: { move: 'right', bomb: true } }, 0.4);
    expect(match.state.bombs).toHaveLength(1);
    applyPowerUp(match.state, match.state.players[0]!, 'bomb');
    match.step({ 0: { bomb: true } });
    expect(match.state.bombs).toHaveLength(2);
    expect(match.state.players[0]!.stats.bombs).toBe(2);
  });
  it('detonates after its fuse and expires flames after 0.45 seconds', () => {
    const match = fixture(); const player = match.state.players[0]!;
    player.invincibleUntil = 10;
    match.step({ 0: { bomb: true } });
    match.step({}, 2.48); expect(match.state.bombs).toHaveLength(1);
    match.step({}, 0.04); expect(match.state.bombs).toHaveLength(0); expect(match.state.flames.length).toBeGreaterThan(0);
    match.step({}, 0.46); expect(match.state.flames).toHaveLength(0);
  });
  it('uses cross propagation and stops at walls and destructible blocks', () => {
    const match = fixture(); const state = match.state;
    state.arena.tiles[3]![5] = 'wall'; state.arena.tiles[5]![3] = 'block';
    const footprint = explosionTiles(state, { x: 3, y: 3 }, 5);
    expect(footprint).toContainEqual({ x: 4, y: 3 });
    expect(footprint).not.toContainEqual({ x: 5, y: 3 });
    expect(footprint).toContainEqual({ x: 3, y: 5 });
    expect(footprint).not.toContainEqual({ x: 3, y: 6 });
    state.players[0]!.invincibleUntil = 10;
    state.arena.hidden['3,5'] = 'fire';
    bomb(state, 3, 3, { detonateAt: 0, range: 5 }); match.step({});
    expect(state.arena.tiles[5]![3]).toBe('floor'); expect(state.arena.tiles[3]![5]).toBe('wall');
    expect(state.pickups[0]?.type).toBe('fire'); expect(state.players[0]!.stats.blocks).toBe(1);
  });
  it('chains in the same tick and credits the triggering owner consistently', () => {
    const match = fixture(); const state = match.state;
    state.players[0]!.x = 1; state.players[0]!.y = 1;
    state.players[1]!.x = 7; state.players[1]!.y = 3;
    bomb(state, 3, 3, { range: 2, detonateAt: 0 });
    bomb(state, 5, 3, { owner: 1, range: 3, detonateAt: 20 });
    match.step({});
    expect(state.bombs).toHaveLength(0); expect(state.players[1]!.alive).toBe(false);
    expect(state.players[0]!.stats.kills).toBe(1); expect(state.players[0]!.stats.largestChain).toBe(2);
    expect(state.events.some(event => event.type === 'combo' && event.value === 2)).toBe(true);
  });
  it('resolves simultaneous opposing explosions as a draw without order-dependent survival', () => {
    const match = fixture(); const state = match.state;
    state.players[0]!.x = 3; state.players[0]!.y = 3; state.players[1]!.x = 9; state.players[1]!.y = 9;
    bomb(state, 3, 3, { owner: 1, detonateAt: 0 }); bomb(state, 9, 9, { owner: 0, detonateAt: 0 });
    match.step({});
    expect(state.status).toBe('finished'); expect(state.winner).toBeNull();
    expect(state.players.map(p => p.stats.kills)).toEqual([1, 1]);
  });
  it('shares the initial obstacle snapshot across simultaneous blasts', () => {
    const match = fixture(); const state = match.state; state.players[0]!.invincibleUntil = 10;
    state.arena.tiles[3]![5] = 'block';
    bomb(state, 3, 3, { detonateAt: 0, range: 5 }); bomb(state, 4, 3, { detonateAt: 0, range: 5 });
    match.step({});
    expect(state.flames.some(f => f.x === 6 && f.y === 3)).toBe(false);
  });
});

describe('moving bombs', () => {
  it('only pushes with an upgrade and stops an ordinary push after one tile', () => {
    const match = fixture(); const state = match.state; const player = state.players[0]!;
    player.x = 3.4; const target = bomb(state, 4, 3);
    match.step({ 0: { move: 'right' } }, 0.1); expect(target.x).toBe(4);
    player.push = true; match.step({ 0: { move: 'right' } }, 0.1);
    match.step({}, 0.3); expect(target.x).toBe(5); expect(target.direction).toBeUndefined();
  });
  it('kicks farther and stops safely at an obstacle without resetting the fuse', () => {
    const match = fixture(); const state = match.state; const player = state.players[0]!;
    player.x = 3.4; player.kick = true; state.arena.tiles[3]![8] = 'wall';
    const target = bomb(state, 4, 3); const fuse = target.detonateAt;
    match.step({ 0: { move: 'right' } }, 0.1); match.step({}, 0.8);
    expect(target.x).toBe(7); expect(target.direction).toBeUndefined(); expect(target.detonateAt).toBe(fuse);
  });
  it('triggers a moving bomb upon entering an active explosion', () => {
    const match = fixture(); const state = match.state;
    bomb(state, 5, 3, { direction: 'right', slideRemaining: 5, slideSpeed: 8 });
    state.flames.push({ x: 6, y: 3, until: 2, owner: 1 });
    match.step({}, 0.15);
    expect(state.bombs).toHaveLength(0); expect(state.players[1]!.stats.largestChain).toBe(1);
  });
  it('stops at another bomb and never snaps into an off-center player', () => {
    const match = fixture(); const state = match.state;
    state.players[0]!.x = 1; state.players[0]!.y = 1;
    const moving = bomb(state, 4, 3, { direction: 'right', slideSpeed: 8, slideRemaining: 8 });
    bomb(state, 7, 3); match.step({}, 0.5);
    expect(moving.x).toBe(6); expect(moving.direction).toBeUndefined();
    state.bombs = [];
    state.players[1]!.x = 6.45; state.players[1]!.y = 3;
    const approaching = bomb(state, 5, 3, { direction: 'right', slideSpeed: 8, slideRemaining: 8 });
    match.step({}, 0.4);
    expect(approaching.direction).toBeUndefined();
    expect(Math.abs(approaching.x - state.players[1]!.x)).toBeGreaterThanOrEqual(GAMEPLAY.bombRadius + GAMEPLAY.playerRadius);
  });
});

describe('power-ups and temporary abilities', () => {
  it('collects actual pickups and caps permanent improvements', () => {
    const match = fixture(); const state = match.state; const player = state.players[0]!;
    state.pickups.push({ x: 3, y: 3, type: 'fire', revealedAt: 0 }); match.step({});
    expect(player.range).toBe(3); expect(state.pickups).toHaveLength(0);
    for (let i = 0; i < 30; i++) { applyPowerUp(state, player, 'bomb'); applyPowerUp(state, player, 'fire'); applyPowerUp(state, player, 'speed'); }
    expect(player.capacity).toBe(6); expect(player.range).toBe(7); expect(player.speed).toBe(GAMEPLAY.maxSpeed);
  });
  it('absorbs one explosion with a shield and grants enough grace to leave the flame', () => {
    const match = fixture(); const state = match.state; const player = state.players[0]!;
    applyPowerUp(state, player, 'shield'); bomb(state, 3, 3, { detonateAt: 0 }); match.step({});
    expect(player.alive).toBe(true); expect(player.shield).toBe(false);
    match.step({}, 0.5); expect(player.alive).toBe(true);
    match.step({}, 0.2); bomb(state, 3, 3, { detonateAt: 0 }); match.step({});
    expect(player.alive).toBe(false);
  });
  it('expires invincibility after five seconds', () => {
    const match = fixture(); const state = match.state; const player = state.players[0]!;
    applyPowerUp(state, player, 'invincible');
    bomb(state, 3, 3, { detonateAt: 0 }); match.step({}); expect(player.alive).toBe(true);
    match.step({}, 5.1); bomb(state, 3, 3, { detonateAt: 0 }); match.step({}); expect(player.alive).toBe(false);
  });
  it('uses rapid fuses temporarily, then returns to the standard fuse', () => {
    const match = fixture(); const state = match.state; const player = state.players[0]!;
    applyPowerUp(state, player, 'rapid'); match.step({ 0: { bomb: true } });
    expect(state.bombs[0]!.detonateAt - state.time).toBeCloseTo(GAMEPLAY.rapidFuse);
    state.bombs = []; state.time = player.rapidUntil + 1; match.step({ 0: { bomb: true } });
    expect(state.bombs[0]!.detonateAt - state.time).toBeCloseTo(GAMEPLAY.bombFuse);
  });
  it('manually detonates remote bombs and expires the remote effect', () => {
    const match = fixture(); const state = match.state; const player = state.players[0]!;
    applyPowerUp(state, player, 'remote'); player.invincibleUntil = 50;
    match.step({ 0: { bomb: true } }); expect(state.bombs[0]!.remote).toBe(true);
    match.step({ 0: { ability: true } }); expect(state.bombs).toHaveLength(0);
    state.time = player.remoteUntil + 1; match.step({ 0: { bomb: true } }); expect(state.bombs[0]!.remote).toBe(false);
  });
  it('places a charged temporary pair, consumes one charge and expires it', () => {
    const match = fixture(); const state = match.state; const player = state.players[0]!;
    applyPowerUp(state, player, 'portal'); match.step({ 0: { ability: true } });
    expect(player.portalAnchor).toEqual({ x: 3, y: 3 });
    match.step({ 0: { move: 'right' } }, 0.6); match.step({ 0: { ability: true } });
    expect(state.portals).toHaveLength(1); expect(player.portalCharges).toBe(0);
    expect(player.portalAnchor).toBeUndefined(); match.step({}, 25.1); expect(state.portals).toHaveLength(0);
  });
});

describe('portals and environments', () => {
  it.each(['wall', 'block'] as const)('rejects a portal exit enclosed by %s tiles, then allows it once an exit opens', obstacle => {
    const match = fixture(); const state = match.state; const player = state.players[0]!;
    state.portals.push({ id: 1, a: { x: 3, y: 3 }, b: { x: 9, y: 3 }, until: Infinity });
    for (const [x, y] of [[8, 3], [10, 3], [9, 2], [9, 4]]) state.arena.tiles[y]![x] = obstacle;
    match.step({});
    expect({ x: player.x, y: player.y }).toEqual({ x: 3, y: 3 });
    state.arena.tiles[3]![8] = 'floor';
    match.step({});
    expect({ x: player.x, y: player.y }).toEqual({ x: 9, y: 3 });
    match.step({ 0: { move: 'left' } }, .3);
    expect(player.x).toBeLessThan(8.5);
  });
  it('does not teleport a player into a pocket sealed by bombs', () => {
    const match = fixture(); const state = match.state; const player = state.players[0]!;
    state.portals.push({ id: 1, a: { x: 3, y: 3 }, b: { x: 9, y: 3 }, until: Infinity });
    for (const [x, y] of [[8, 3], [10, 3], [9, 2], [9, 4]]) bomb(state, x, y, { owner: 1, detonateAt: 100 });
    match.step({});
    expect(player.x).toBe(3);
    state.bombs = state.bombs.filter(b => b.x !== 8 || b.y !== 3);
    match.step({});
    expect(player.x).toBe(9);
  });
  it('does not create a temporary portal endpoint on an isolated floor tile', () => {
    const match = fixture(); const state = match.state; const player = state.players[0]!;
    applyPowerUp(state, player, 'portal');
    match.step({ 0: { ability: true } });
    match.step({});
    player.x = 9; player.y = 3;
    for (const [x, y] of [[8, 3], [10, 3], [9, 2], [9, 4]]) state.arena.tiles[y]![x] = 'wall';
    match.step({ 0: { ability: true } });
    expect(state.portals).toHaveLength(0);
    expect(player.portalCharges).toBe(1);
    expect(player.portalAnchor).toEqual({ x: 3, y: 3 });
  });
  it('teleports once and does not bounce after the cooldown while standing on the exit', () => {
    const match = fixture(); const state = match.state;
    state.portals.push({ id: 1, a: { x: 3, y: 3 }, b: { x: 9, y: 3 }, until: Infinity });
    match.step({}); expect(state.players[0]!.x).toBe(9);
    match.step({}, 2); expect(state.players[0]!.x).toBe(9);
  });
  it('refuses an occupied portal exit and transports sliding bombs', () => {
    const match = fixture(); const state = match.state;
    state.portals.push({ id: 1, a: { x: 5, y: 3 }, b: { x: 9, y: 3 }, until: Infinity });
    state.players[1]!.x = 9; state.players[1]!.y = 3; state.players[0]!.x = 5;
    match.step({}); expect(state.players[0]!.x).toBe(5);
    state.players[0]!.x = 1; state.players[1]!.x = 11;
    const moving = bomb(state, 4, 3, { direction: 'right', slideSpeed: 4, slideRemaining: 5 });
    match.step({}, 0.35); expect(moving.x).toBeGreaterThanOrEqual(9);
  });
  it('conveyors carry players and bombs in their advertised direction', () => {
    const match = fixture(); const state = match.state;
    state.arena.conveyors = [{ x: 3, y: 3, direction: 'right' }, { x: 5, y: 5, direction: 'down' }];
    const target = bomb(state, 5, 5); match.step({}, 0.4);
    expect(state.players[0]!.x).toBeGreaterThan(3.3); expect(target.y).toBeGreaterThan(5.5);
  });
  it('conveyors redirect kicked bombs at tile centers', () => {
    const match = fixture(); const state = match.state;
    state.arena.conveyors = [{ x: 5, y: 5, direction: 'down' }];
    const target = bomb(state, 4, 5, { direction: 'right', slideSpeed: GAMEPLAY.kickSpeed, slideRemaining: 10 });
    match.step({}, 0.35);
    expect(target.x).toBe(5); expect(target.y).toBeGreaterThan(6); expect(target.direction).toBe('down');
  });
  it('telegraphs factory steam and damages only during the active phase', () => {
    const match = fixture('factory'); const state = match.state;
    state.arena.vents = [{ x: 3, y: 3 }]; state.time = 5.49;
    match.step({}, 0.03); expect(state.events.some(e => e.type === 'warning')).toBe(true); expect(state.players[0]!.alive).toBe(true);
    match.step({}, 1.5); expect(state.players[0]!.alive).toBe(false);
  });
  it('regrows jungle vegetation only if it cannot disconnect or trap a player', () => {
    const match = fixture('jungle'); const state = match.state;
    state.regrowth.push({ x: 3, y: 3, at: 0 }, { x: 7, y: 7, at: 0 }); match.step({});
    expect(state.arena.tiles[3]![3]).toBe('floor'); expect(state.arena.tiles[7]![7]).toBe('block');
  });
  it('defers regrowth on a bridge and beside an overlapping moving bomb', () => {
    const match = fixture('jungle'); const state = match.state;
    for (let y = 1; y < 14; y++) state.arena.tiles[y]![7] = y === 5 ? 'floor' : 'wall';
    state.regrowth.push({ x: 7, y: 5, at: 0 }); match.step({});
    expect(state.arena.tiles[5]![7]).toBe('floor'); expect(state.regrowth[0]!.at).toBeGreaterThan(state.time);
    state.regrowth.push({ x: 4, y: 5, at: 0 });
    bomb(state, 4.7, 5); match.step({}); expect(state.arena.tiles[5]![4]).toBe('floor');
  });
  it('rolls stationary ship bombs one tile after a warning', () => {
    const match = fixture('boat'); const state = match.state;
    state.time = 11.98; const target = bomb(state, 7, 7, { detonateAt: 50 });
    match.step({}, 0.7); expect(target.x).toBe(6); expect(target.direction).toBeUndefined();
  });
});

describe('match lifecycle', () => {
  it.each<MapId>(['mall', 'airport', 'jungle', 'factory', 'boat'])('gives a human a working initial bomb escape on %s', mapId => {
    const match = new Match({ mapId, seed: 31, opponents: 3, difficulties: ['normal', 'normal', 'normal'] });
    match.step({ 0: { bomb: true } });
    match.step({ 0: { move: 'right' } }, 0.6);
    match.step({ 0: { move: 'down' } }, 0.3);
    match.step({}, 2.2);
    expect(match.state.players[0]!.alive).toBe(true);
    expect(match.state.players[0]!.x).toBeGreaterThan(2.8);
    expect(match.state.players[0]!.y).toBeGreaterThan(1.8);
    expect(match.state.players[0]!.stats.bombs).toBe(1);
    expect(match.state.bombs).toHaveLength(0);
  });
  it('declares the last survivor and freezes completed state', () => {
    const match = fixture(); match.state.players[1]!.alive = false; match.step({});
    expect(match.state.winner).toBe(0); const tick = match.state.tick; match.step({}, 2); expect(match.state.tick).toBe(tick);
  });
  it('warns before deterministic sudden-death rings and closes them progressively', () => {
    const match = fixture(); const state = match.state;
    state.suddenDeathAt = 1; state.players[0]!.x = 5; state.players[0]!.y = 5;
    state.players[1]!.x = 9; state.players[1]!.y = 9;
    match.step({}, 1.1); expect(state.closedRing).toBe(0); expect(state.closingTiles.length).toBeGreaterThan(0);
    expect(state.arena.tiles[1]![1]).toBe('floor');
    match.step({}, 3); expect(state.closedRing).toBe(1); expect(state.arena.tiles[1]![1]).toBe('wall');
    match.step({}, 5); expect(state.closedRing).toBe(2); expect(state.arena.tiles[2]![2]).toBe('wall');
  });
  it('cannot freeze a match when both remaining players refuse to confront each other', () => {
    const match = fixture(); const state = match.state;
    state.suddenDeathAt = 0.1; state.players[0]!.x = 7; state.players[0]!.y = 7;
    state.players[1]!.x = 7; state.players[1]!.y = 8;
    state.players.forEach(player => { player.invincibleUntil = 999; player.shield = true; });
    match.step({}, 45);
    expect(state.status).toBe('finished'); expect(state.time).toBeLessThan(40);
    expect(state.winner === 0 || state.winner === null).toBe(true);
  });
  it('replays identical inputs deterministically and fully resets a rematch', () => {
    const a = fixture(); const b = fixture();
    for (let i = 0; i < 150; i++) {
      const action = { 0: { move: i < 30 ? 'right' as const : 'down' as const, bomb: i === 20 } };
      a.step(action, FIXED_DT); b.step(action, FIXED_DT);
    }
    expect(a.state).toEqual(b.state);
    const fresh = new Match({ mapId: 'mall', seed: 2026, opponents: 3, difficulties: ['easy', 'normal', 'expert'] });
    expect(fresh.state.players).toHaveLength(4); expect(fresh.state.time).toBe(0); expect(fresh.state.bombs).toHaveLength(0);
    expect(fresh.state.players.every(p => p.alive && p.stats.bombs === 0 && p.capacity === 1)).toBe(true);
  });
});
