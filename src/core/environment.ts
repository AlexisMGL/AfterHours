import { cellKey, sameCell, tileAt, type MatchState, type Point } from './types';
import { GAMEPLAY } from './tuning';
import { carryBomb, movePlayer, startBombSlide } from './physics';

function connectedFloor(state: MatchState, origin: Point, blocked?: Point): Set<string> {
  const queue: Point[] = [{ x: Math.round(origin.x), y: Math.round(origin.y) }];
  const visited = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i]!;
    const key = cellKey(point.x, point.y);
    const occupied = !sameCell(point, origin) && (state.bombs.some(b => sameCell(b, point)) || state.flames.some(f => sameCell(f, point)));
    if (visited.has(key) || occupied || tileAt(state.arena, point.x, point.y) !== 'floor' || (blocked && sameCell(point, blocked))) continue;
    visited.add(key);
    queue.push({ x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y }, { x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 });
  }
  return visited;
}

function canRegrow(state: MatchState, point: Point): boolean {
  if (tileAt(state.arena, point.x, point.y) !== 'floor'
    || state.players.some(p => p.alive && Math.abs(p.x - point.x) < 0.8 && Math.abs(p.y - point.y) < 0.8)
    || state.bombs.some(b => Math.abs(b.x - point.x) < 0.5 + GAMEPLAY.bombRadius && Math.abs(b.y - point.y) < 0.5 + GAMEPLAY.bombRadius)
    || state.pickups.some(p => sameCell(p, point))
    || state.flames.some(f => sameCell(f, point)) || state.portals.some(p => sameCell(p.a, point) || sameCell(p.b, point))) return false;
  for (const player of state.players.filter(p => p.alive)) {
    const before = connectedFloor(state, player);
    if (!before.has(cellKey(point.x, point.y))) continue;
    const after = connectedFloor(state, player, point);
    // Removing a bush must never disconnect a player's existing walkable region.
    if (after.size < before.size - 1) return false;
  }
  return true;
}

export function updateEnvironment(state: MatchState, previousTime: number, dt: number): void {
  for (const belt of state.arena.conveyors) {
    for (const player of state.players) {
      if (player.alive && sameCell(player, belt)) movePlayer(state, player, belt.direction, GAMEPLAY.conveyorSpeed * dt, false);
    }
    for (const bomb of state.bombs) {
      if (sameCell(bomb, belt)) carryBomb(state, bomb, belt.direction);
    }
  }
  if (state.arena.id === 'factory') {
    const phase = state.time % GAMEPLAY.steamPeriod;
    const previousPhase = previousTime % GAMEPLAY.steamPeriod;
    if (phase >= GAMEPLAY.steamWarning && (previousPhase < GAMEPLAY.steamWarning || previousPhase > phase)) {
      for (const vent of state.arena.vents) state.events.push({ type: 'warning', ...vent, value: 1 });
    }
    if (phase >= GAMEPLAY.steamStart && phase < GAMEPLAY.steamEnd) {
      for (const vent of state.arena.vents) {
        if (tileAt(state.arena, vent.x, vent.y) !== 'floor') continue;
        const flame = state.flames.find(f => sameCell(f, vent));
        if (flame) flame.until = Math.max(flame.until, state.time + dt * 1.1);
        else state.flames.push({ ...vent, until: state.time + dt * 1.1, owner: -1 });
      }
    }
  }
  if (state.arena.id === 'boat') {
    const cycle = Math.floor(state.time / GAMEPLAY.boatPeriod);
    const previousCycle = Math.floor(previousTime / GAMEPLAY.boatPeriod);
    const warningPhase = GAMEPLAY.boatPeriod - GAMEPLAY.boatWarning;
    if (state.time % GAMEPLAY.boatPeriod >= warningPhase && previousTime % GAMEPLAY.boatPeriod < warningPhase) {
      state.events.push({ type: 'warning', x: 7, y: 7, value: 2 });
    }
    if (cycle > previousCycle) {
      const direction = cycle % 2 === 1 ? 'left' : 'right';
      for (const bomb of state.bombs) startBombSlide(state, bomb, direction, 1, 2.2);
    }
  }
  for (const regrowth of state.regrowth) {
    if (regrowth.at - state.time <= 2 && regrowth.at - previousTime > 2) {
      state.events.push({ type: 'warning', x: regrowth.x, y: regrowth.y, value: 3 });
    }
    if (regrowth.at <= state.time) {
      if (canRegrow(state, regrowth)) {
        state.arena.tiles[regrowth.y]![regrowth.x] = 'block';
        regrowth.at = -1;
      } else regrowth.at = state.time + 3;
    }
  }
  state.regrowth = state.regrowth.filter(r => r.at >= 0);
}

function ring(state: MatchState, depth: number): Point[] {
  const left = depth;
  const top = depth;
  const right = state.arena.width - depth - 1;
  const bottom = state.arena.height - depth - 1;
  if (left > right || top > bottom) return [];
  const tiles: Point[] = [];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if ((x === left || x === right || y === top || y === bottom) && tileAt(state.arena, x, y) !== 'wall') tiles.push({ x, y });
  }
  return tiles;
}

export function updateSuddenDeath(state: MatchState, previousTime: number): void {
  if (previousTime < state.suddenDeathAt - 5 && state.time >= state.suddenDeathAt - 5) {
    state.events.push({ type: 'warning', x: 7, y: 7, value: 4 });
  }
  if (state.time < state.suddenDeathAt) return;
  if (state.closingAt === 0) {
    state.closingTiles = ring(state, 1);
    state.closingAt = state.time + GAMEPLAY.closingWarning;
    state.events.push({ type: 'warning', x: 7, y: 7, value: 5 });
  }
  if (state.time + 1e-7 < state.closingAt) return;
  for (const point of state.closingTiles) {
    state.arena.tiles[point.y]![point.x] = 'wall';
    for (const player of state.players) {
      if (player.alive && Math.abs(player.x - point.x) < 0.5 + GAMEPLAY.playerRadius && Math.abs(player.y - point.y) < 0.5 + GAMEPLAY.playerRadius) {
        player.alive = false;
        state.events.push({ type: 'death', x: player.x, y: player.y, player: player.id, value: -1 });
      }
    }
  }
  state.bombs = state.bombs.filter(b => tileAt(state.arena, b.x, b.y) === 'floor');
  state.pickups = state.pickups.filter(p => tileAt(state.arena, p.x, p.y) === 'floor');
  state.flames = state.flames.filter(f => tileAt(state.arena, f.x, f.y) === 'floor');
  state.portals = state.portals.filter(p => tileAt(state.arena, p.a.x, p.a.y) === 'floor' && tileAt(state.arena, p.b.x, p.b.y) === 'floor');
  state.closedRing++;
  state.closingTiles = ring(state, state.closedRing + 1);
  state.closingAt = state.time + GAMEPLAY.closingInterval;
  state.events.push({ type: 'warning', x: 7, y: 7, value: 5 });
}
