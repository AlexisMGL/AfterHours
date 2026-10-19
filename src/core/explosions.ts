import { DIRECTIONS, cellKey, sameCell, tileAt, type Bomb, type MatchState, type Point, type PowerUp, type Tile } from './types';
import { GAMEPLAY } from './tuning';

function footprint(state: MatchState, point: Point, range: number, tiles: Tile[][]): Point[] {
  const origin = { x: Math.round(point.x), y: Math.round(point.y) };
  const result: Point[] = [origin];
  for (const direction of Object.values(DIRECTIONS)) {
    for (let step = 1; step <= range; step++) {
      const x = origin.x + direction.x * step;
      const y = origin.y + direction.y * step;
      const tile = tiles[y]?.[x] ?? 'wall';
      if (tile === 'wall') break;
      result.push({ x, y });
      if (tile === 'block') break;
    }
  }
  return result;
}

export function explosionTiles(state: MatchState, point: Point, range: number): Point[] {
  return footprint(state, point, range, state.arena.tiles);
}

/** All chains in one tick see the same obstacles; root bomb ownership receives credit. */
export function resolveExplosions(state: MatchState): void {
  const snapshot = state.arena.tiles.map(row => [...row]);
  const removed = new Set<number>();
  const destroyed = new Map<string, { point: Point; owner: number }>();
  const roots = state.bombs.filter(bomb => bomb.detonateAt <= state.time + 1e-7 || state.flames.some(flame => sameCell(flame, bomb)));
  for (const root of roots) {
    if (removed.has(root.id)) continue;
    const triggeringFlame = state.flames.find(flame => sameCell(flame, root));
    const owner = triggeringFlame?.owner ?? root.owner;
    const queue: Bomb[] = [root];
    let chain = 0;
    for (let index = 0; index < queue.length; index++) {
      const bomb = queue[index]!;
      if (removed.has(bomb.id)) continue;
      removed.add(bomb.id);
      chain++;
      state.events.push({ type: 'explosion', x: bomb.x, y: bomb.y, player: owner, value: bomb.range });
      for (const point of footprint(state, bomb, bomb.range, snapshot)) {
        const existing = state.flames.find(flame => sameCell(flame, point));
        if (existing) existing.until = Math.max(existing.until, state.time + GAMEPLAY.flameDuration);
        else state.flames.push({ ...point, until: state.time + GAMEPLAY.flameDuration, owner });
        if (snapshot[point.y]?.[point.x] === 'block' && !destroyed.has(cellKey(point.x, point.y))) destroyed.set(cellKey(point.x, point.y), { point, owner });
        for (const target of state.bombs) {
          if (!removed.has(target.id) && sameCell(target, point)) queue.push(target);
        }
      }
    }
    const player = state.players.find(p => p.id === owner);
    if (player) player.stats.largestChain = Math.max(player.stats.largestChain, chain);
    if (chain > 1) state.events.push({ type: 'combo', x: root.x, y: root.y, player: owner, value: chain });
  }
  state.bombs = state.bombs.filter(bomb => !removed.has(bomb.id));
  state.pickups = state.pickups.filter(pickup => pickup.revealedAt > state.time || !state.flames.some(flame => sameCell(flame, pickup)));
  for (const [key, { point, owner }] of destroyed) {
    const row = state.arena.tiles[point.y];
    if (!row || tileAt(state.arena, point.x, point.y) !== 'block') continue;
    row[point.x] = 'floor';
    const player = state.players.find(p => p.id === owner);
    if (player) player.stats.blocks++;
    state.events.push({ type: 'block', ...point, player: owner });
    const powerUp: PowerUp | undefined = state.arena.hidden[key];
    if (powerUp) {
      state.pickups.push({ ...point, type: powerUp, revealedAt: state.time + GAMEPLAY.flameDuration });
      delete state.arena.hidden[key];
    }
    if (state.arena.id === 'jungle' && state.arena.vegetation.some(tile => sameCell(tile, point))) {
      state.regrowth.push({ ...point, at: state.time + GAMEPLAY.regrowthDelay });
    }
  }
}

export function damagePlayers(state: MatchState): void {
  for (const player of state.players) {
    if (!player.alive || player.invincibleUntil > state.time) continue;
    const flame = state.flames.find(f => Math.abs(f.x - player.x) < 0.5 + GAMEPLAY.playerRadius * 0.65
      && Math.abs(f.y - player.y) < 0.5 + GAMEPLAY.playerRadius * 0.65);
    if (!flame) continue;
    if (player.shield) {
      player.shield = false;
      player.invincibleUntil = state.time + GAMEPLAY.shieldGrace;
      state.events.push({ type: 'shield', x: player.x, y: player.y, player: player.id });
    } else {
      player.alive = false;
      const killer = state.players.find(p => p.id === flame.owner);
      if (killer && killer.id !== player.id) killer.stats.kills++;
      state.events.push({ type: 'death', x: player.x, y: player.y, player: player.id, value: flame.owner });
    }
  }
}
