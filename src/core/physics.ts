import { DIRECTIONS, sameCell, tileAt, type Bomb, type Direction, type MatchState, type Player, type Point } from './types';
import { GAMEPLAY } from './tuning';
import { hasPortalEscape } from './portals';

const near = (a: Point, b: Point, radius: number): boolean => Math.abs(a.x - b.x) < radius - 1e-7 && Math.abs(a.y - b.y) < radius - 1e-7;

/** Collision uses character footprints, rather than rounded visual positions. */
export function canOccupy(state: MatchState, player: Player, x: number, y: number): boolean {
  const radius = GAMEPLAY.playerRadius;
  for (let row = Math.floor(y - radius + 0.5); row <= Math.floor(y + radius + 0.5 - 1e-7); row++) {
    for (let col = Math.floor(x - radius + 0.5); col <= Math.floor(x + radius + 0.5 - 1e-7); col++) {
      if (tileAt(state.arena, col, row) !== 'floor') return false;
    }
  }
  const point = { x, y };
  for (const bomb of state.bombs) {
    if (!bomb.passThrough.includes(player.id) && near(point, bomb, radius + GAMEPLAY.bombRadius)) return false;
  }
  for (const other of state.players) {
    if (other.alive && other.id !== player.id && near(point, other, radius * 2)) return false;
  }
  return true;
}

export function clearBombExitPermissions(state: MatchState): void {
  for (const bomb of state.bombs) {
    bomb.passThrough = bomb.passThrough.filter(id => {
      const player = state.players.find(p => p.id === id);
      return !!player?.alive && near(player, bomb, 0.5 + GAMEPLAY.playerRadius);
    });
  }
}

function bombCanOccupy(state: MatchState, bomb: Bomb, position: Point): boolean {
  const radius = GAMEPLAY.bombRadius;
  for (let y = Math.floor(position.y - radius + 0.5); y <= Math.floor(position.y + radius + 0.5 - 1e-7); y++) {
    for (let x = Math.floor(position.x - radius + 0.5); x <= Math.floor(position.x + radius + 0.5 - 1e-7); x++) {
      if (tileAt(state.arena, x, y) !== 'floor') return false;
    }
  }
  return !state.bombs.some(other => other.id !== bomb.id && near(other, position, radius * 2))
    && !state.players.some(player => player.alive && !bomb.passThrough.includes(player.id)
      && near(player, position, radius + GAMEPLAY.playerRadius));
}

export function startBombSlide(state: MatchState, bomb: Bomb, direction: Direction, distance: number, speed: number): boolean {
  if (bomb.direction || Math.abs(bomb.x - Math.round(bomb.x)) > 0.02 || Math.abs(bomb.y - Math.round(bomb.y)) > 0.02) return false;
  const delta = DIRECTIONS[direction];
  if (!bombCanOccupy(state, bomb, { x: bomb.x + delta.x, y: bomb.y + delta.y })) return false;
  bomb.direction = direction;
  bomb.slideRemaining = distance;
  bomb.slideSpeed = speed;
  return true;
}

/** Belts take control at tile centers, including bombs kicked across their lane. */
export function carryBomb(state: MatchState, bomb: Bomb, direction: Direction): void {
  if (bomb.direction === direction) return;
  if (Math.abs(bomb.x - Math.round(bomb.x)) > 0.085 || Math.abs(bomb.y - Math.round(bomb.y)) > 0.085) return;
  const center = { x: Math.round(bomb.x), y: Math.round(bomb.y) };
  if (!bombCanOccupy(state, bomb, center)) return;
  const speed = Math.max(bomb.slideSpeed, GAMEPLAY.conveyorBombSpeed);
  const distance = Math.max(1, bomb.slideRemaining);
  bomb.x = center.x; bomb.y = center.y; bomb.direction = undefined; bomb.slideRemaining = 0;
  startBombSlide(state, bomb, direction, distance, speed);
}

/** Small fixed substeps keep moving bomb/player collisions stable at any frame rate. */
export function movePlayer(state: MatchState, player: Player, direction: Direction, amount: number, pushing = true): void {
  const delta = DIRECTIONS[direction];
  if (pushing) player.facing = direction;
  const steps = Math.max(1, Math.ceil(amount / 0.07));
  const distance = amount / steps;
  for (let i = 0; i < steps; i++) {
    const x = player.x + delta.x * distance;
    const y = player.y + delta.y * distance;
    if (canOccupy(state, player, x, y)) { player.x = x; player.y = y; continue; }
    // Correct slight perpendicular drift before entering a one-tile corridor.
    const cross = delta.x ? player.y : player.x;
    const center = Math.round(cross);
    const assisted = Math.abs(cross - center) <= 0.38;
    if (assisted && Math.abs(cross - center) > 1e-7) {
      const correction = Math.sign(center - cross) * Math.min(Math.abs(center - cross), distance * 1.6);
      const ax = delta.x ? player.x : player.x + correction;
      const ay = delta.x ? player.y + correction : player.y;
      if (canOccupy(state, player, ax, ay)) {
        player.x = ax; player.y = ay;
        if (canOccupy(state, player, ax + delta.x * distance, ay + delta.y * distance)) {
          player.x += delta.x * distance; player.y += delta.y * distance;
        }
      }
    }
    if (pushing && (player.push || player.kick)) {
      const bomb = state.bombs.find(b => !b.passThrough.includes(player.id) && near({ x, y }, b, GAMEPLAY.playerRadius + GAMEPLAY.bombRadius + 0.015));
      if (bomb && Math.abs((delta.x ? bomb.y - player.y : bomb.x - player.x)) < 0.24
        && startBombSlide(state, bomb, direction, player.kick ? state.arena.width + state.arena.height : 1, player.kick ? GAMEPLAY.kickSpeed : GAMEPLAY.pushSpeed)) {
        state.events.push({ type: 'kick', x: bomb.x, y: bomb.y, player: player.id });
      }
    }
  }
}

export function moveBomb(state: MatchState, bomb: Bomb, dt: number): void {
  if (!bomb.direction) return;
  const delta = DIRECTIONS[bomb.direction];
  let remaining = Math.min(bomb.slideSpeed * dt, bomb.slideRemaining);
  while (remaining > 1e-7) {
    const amount = Math.min(remaining, 0.06);
    const next = { x: bomb.x + delta.x * amount, y: bomb.y + delta.y * amount };
    if (!bombCanOccupy(state, bomb, next)) {
      // Prefer a center, but never snap into a character who crossed the lane.
      const centered = { x: Math.round(bomb.x), y: Math.round(bomb.y) };
      if (bombCanOccupy(state, bomb, centered)) {
        bomb.x = centered.x; bomb.y = centered.y;
      } else {
        const previous = {
          x: delta.x > 0 ? Math.floor(bomb.x) : delta.x < 0 ? Math.ceil(bomb.x) : Math.round(bomb.x),
          y: delta.y > 0 ? Math.floor(bomb.y) : delta.y < 0 ? Math.ceil(bomb.y) : Math.round(bomb.y),
        };
        if (bombCanOccupy(state, bomb, previous)) { bomb.x = previous.x; bomb.y = previous.y; }
      }
      bomb.direction = undefined; bomb.slideRemaining = 0;
      return;
    }
    bomb.x = next.x; bomb.y = next.y;
    remaining -= amount; bomb.slideRemaining -= amount;
  }
  if (bomb.slideRemaining < 1e-6) {
    bomb.x = Math.round(bomb.x); bomb.y = Math.round(bomb.y);
    bomb.direction = undefined; bomb.slideRemaining = 0;
  }
}

export function portalDestination(state: MatchState, position: Point): Point | undefined {
  for (const portal of state.portals) {
    if (sameCell(position, portal.a)) return portal.b;
    if (sameCell(position, portal.b)) return portal.a;
  }
  return undefined;
}

export function validPlayerPortalExit(state: MatchState, player: Player, target: Point): boolean {
  return canOccupy(state, player, target.x, target.y) && hasPortalEscape(state.arena, target, neighbor =>
    canOccupy(state, player, (target.x + neighbor.x) / 2, (target.y + neighbor.y) / 2)
    && canOccupy(state, player, neighbor.x, neighbor.y));
}

export function validBombPortalExit(state: MatchState, bomb: Bomb, target: Point): boolean {
  return bombCanOccupy(state, bomb, target);
}
