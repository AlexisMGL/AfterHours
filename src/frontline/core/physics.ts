import { CLASSES, PHYSICS, WEAPONS } from './config';
import { clamp, type Action, type Arena, type MatchState, type Platform, type Rect, type Soldier, type Vec } from './types';

export const soldierBox = (soldier: Vec): Rect => ({ x: soldier.x - PHYSICS.radius, y: soldier.y - PHYSICS.height, w: PHYSICS.radius * 2, h: PHYSICS.height });
export const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export interface RayHit { point: Vec; t: number; normal: Vec }

/** No viewport means an unrestricted standalone simulation. */
export function pointInCombatView(state: MatchState, point: Vec): boolean {
  const view = state.combatView;
  return !view || (view.w > 0 && view.h > 0 && point.x >= view.x && point.x <= view.x + view.w && point.y >= view.y && point.y <= view.y + view.h);
}

export function soldierInCombatView(state: MatchState, soldier: Vec): boolean {
  const view = state.combatView;
  return !view || (view.w > 0 && view.h > 0 && overlaps(soldierBox(soldier), view));
}

/** Clip a segment to a closed rectangle without changing its direction. */
export function clipSegmentToRect(from: Vec, to: Vec, rect: Rect): { from: Vec; to: Vec; t0: number; t1: number } | null {
  if (![from.x, from.y, to.x, to.y, rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) || rect.w <= 0 || rect.h <= 0) return null;
  let t0 = 0, t1 = 1;
  for (const axis of ['x', 'y'] as const) {
    const delta = to[axis] - from[axis], low = rect[axis], high = low + (axis === 'x' ? rect.w : rect.h);
    if (Math.abs(delta) < 1e-12) { if (from[axis] < low || from[axis] > high) return null; continue; }
    const a = (low - from[axis]) / delta, b = (high - from[axis]) / delta;
    t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
    if (t0 > t1) return null;
  }
  const at = (t: number): Vec => ({ x: clamp(from.x + (to.x - from.x) * t, rect.x, rect.x + rect.w), y: clamp(from.y + (to.y - from.y) * t, rect.y, rect.y + rect.h) });
  return { from: at(t0), to: at(t1), t0, t1 };
}

/** Segment/AABB intersection, including high-speed projectiles and thin cover. */
export function rayRect(from: Vec, to: Vec, rect: Rect): RayHit | null {
  let near = -Infinity, far = Infinity;
  let normal: Vec = { x: 0, y: 0 };
  for (const axis of ['x', 'y'] as const) {
    const change = to[axis] - from[axis];
    const low = rect[axis], high = low + (axis === 'x' ? rect.w : rect.h);
    if (Math.abs(change) < 1e-9) { if (from[axis] < low || from[axis] > high) return null; continue; }
    const first = (low - from[axis]) / change, second = (high - from[axis]) / change;
    const entry = Math.min(first, second), exit = Math.max(first, second);
    if (entry > near) { near = entry; normal = axis === 'x' ? { x: change > 0 ? -1 : 1, y: 0 } : { x: 0, y: change > 0 ? -1 : 1 }; }
    far = Math.min(far, exit);
    if (near > far) return null;
  }
  if (far <= 0 || near > 1) return null;
  const t = Math.max(0, near);
  return { point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, t, normal };
}

export function raycastGeometry(arena: Arena, from: Vec, to: Vec): (RayHit & { platform: Platform }) | null {
  let nearest: (RayHit & { platform: Platform }) | null = null;
  for (const platform of arena.platforms) {
    // Every active platform is physical cover, including legacy oneWay decks.
    if (!platform.active) continue;
    const hit = rayRect(from, to, platform);
    if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, platform };
  }
  return nearest;
}
export const lineOfSight = (arena: Arena, from: Vec, to: Vec): boolean => !raycastGeometry(arena, from, to);

/** Axis sweeps stop at the first solid face, even when a thin obstacle is crossed in one tick. */
function moveBodyAxis(arena: Arena, soldier: Soldier, axis: 'x' | 'y', delta: number, ignoredPlatform?: number): Platform | undefined {
  const before = soldierBox(soldier), epsilon = 1e-6;
  let coordinate = soldier[axis] + delta, contact: Platform | undefined;
  for (const platform of arena.platforms) {
    if (!platform.active || platform.id === ignoredPlatform) continue;
    if (axis === 'x') {
      if (before.y >= platform.y + platform.h - epsilon || before.y + before.h <= platform.y + epsilon) continue;
      if (delta > 0 && before.x + before.w <= platform.x + epsilon && coordinate + PHYSICS.radius >= platform.x) {
        coordinate = Math.min(coordinate, platform.x - PHYSICS.radius); contact = platform;
      } else if (delta < 0 && before.x >= platform.x + platform.w - epsilon && coordinate - PHYSICS.radius <= platform.x + platform.w) {
        coordinate = Math.max(coordinate, platform.x + platform.w + PHYSICS.radius); contact = platform;
      }
    } else {
      if (before.x >= platform.x + platform.w - epsilon || before.x + before.w <= platform.x + epsilon) continue;
      if (delta >= 0 && before.y + before.h <= platform.y + epsilon && coordinate >= platform.y) {
        coordinate = Math.min(coordinate, platform.y); contact = platform;
      } else if (delta < 0 && before.y >= platform.y + platform.h - epsilon && coordinate - PHYSICS.height <= platform.y + platform.h) {
        coordinate = Math.max(coordinate, platform.y + platform.h + PHYSICS.height); contact = platform;
      }
    }
  }
  soldier[axis] = axis === 'x' ? clamp(coordinate, PHYSICS.radius, arena.width - PHYSICS.radius) : coordinate;
  return contact;
}

export function updateMovingPlatforms(state: MatchState): void {
  for (const platform of state.arena.platforms) {
    if (!platform.active) continue;
    platform.previousX = platform.x; platform.previousY = platform.y;
    if (!platform.moving) continue;
    const moving = platform.moving;
    const phase = ((state.time / moving.period + moving.phase) % 1 + 1) % 1;
    const eased = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    const axis = moving.axis;
    const requested = moving.from + (moving.to - moving.from) * eased - platform[axis];
    const previous = platform[axis];
    let destination = previous + requested;
    const pushedDistance = (soldier: Soldier, travel: number): number => {
      const body = soldierBox(soldier), previous = axis === 'x' ? platform.previousX! : platform.previousY!;
      if (axis === 'x') {
        if (body.y >= platform.y + platform.h || body.y + body.h <= platform.y) return 0;
        if (travel > 0 && previous + platform.w <= body.x + 1e-6 && previous + platform.w + travel >= body.x) return previous + platform.w + travel - body.x;
        if (travel < 0 && previous >= body.x + body.w - 1e-6 && previous + travel <= body.x + body.w) return previous + travel - (body.x + body.w);
      } else {
        if (body.x >= platform.x + platform.w || body.x + body.w <= platform.x) return 0;
        if (travel > 0 && previous + platform.h <= body.y + 1e-6 && previous + platform.h + travel >= body.y) return previous + platform.h + travel - body.y;
        if (travel < 0 && previous >= body.y + body.h - 1e-6 && previous + travel <= body.y + body.h) return previous + travel - (body.y + body.h);
      }
      return 0;
    };
    // A passenger can stop a lift against real geometry. Neither carrying nor
    // pushing may force a body through the ceiling or wall at the other side.
    for (const soldier of state.soldiers) {
      if (!soldier.alive) continue;
      const riding = soldier.platformId === platform.id && soldier.grounded;
      const required = riding ? destination - previous : pushedDistance(soldier, destination - previous);
      if (!required) continue;
      const probe = { ...soldier };
      moveBodyAxis(state.arena, probe, axis, required, platform.id);
      const applied = probe[axis] - soldier[axis];
      if (Math.abs(required - applied) < 1e-7) continue;
      const safe = riding ? probe[axis] - (soldier[axis] - previous)
        : axis === 'x' ? probe.x + (requested > 0 ? -PHYSICS.radius - platform.w : PHYSICS.radius)
        : requested > 0 ? probe.y - PHYSICS.height - platform.h : probe.y;
      destination = requested >= 0 ? clamp(safe, previous, destination) : clamp(safe, destination, previous);
    }
    platform[axis] = destination;
    const delta = destination - previous;
    for (const soldier of state.soldiers) {
      if (!soldier.alive) continue;
      if (soldier.platformId === platform.id && soldier.grounded) {
        moveBodyAxis(state.arena, soldier, axis, delta, platform.id);
      } else {
        const required = pushedDistance(soldier, delta);
        if (!required) continue;
        moveBodyAxis(state.arena, soldier, axis, required, platform.id);
        if (axis === 'x') soldier.vx = 0;
        else {
          soldier.vy = 0;
          if (delta < 0) { soldier.grounded = true; soldier.platformId = platform.id; }
        }
      }
    }
  }
}

export function moveSoldier(state: MatchState, soldier: Soldier, action: Action, dt: number, jumpPressed = !!action.jump): void {
  const arena = state.arena;
  const oldGrounded = soldier.grounded;
  const oldPlatform = arena.platforms.find(p => p.id === soldier.platformId && p.active);
  if (soldier.grounded) soldier.coyoteUntil = state.time + PHYSICS.coyote;
  if (jumpPressed) soldier.jumpBufferUntil = state.time + PHYSICS.jumpBuffer;
  const ladders = arena.ladders.filter(l => soldier.x + PHYSICS.radius > l.x && soldier.x - PHYSICS.radius < l.x + l.w
    && soldier.y >= l.y && soldier.y - PHYSICS.height < l.y + l.h);
  ladders.sort((a, b) => action.climb === 1 ? b.y - a.y : a.y - b.y);
  const ladder = ladders[0];
  if (action.climb && ladder) {
    const atEnd = soldier.grounded && (action.climb < 0 ? ladder.y + PHYSICS.height + 12 >= soldier.y : ladder.y + ladder.h - 12 <= soldier.y);
    soldier.climbing = !atEnd;
  }
  if (!ladder) soldier.climbing = false;
  if (soldier.climbing && ladder) {
    soldier.vx = action.move ? action.move * PHYSICS.climbSpeed : clamp(ladder.x + ladder.w / 2 - soldier.x, -160 * dt, 160 * dt) / dt;
    soldier.vy = (action.climb ?? 0) * PHYSICS.climbSpeed;
    soldier.grounded = false; soldier.platformId = null;
  } else {
    let speed = CLASSES[soldier.classId].speed * WEAPONS[soldier.weapons[soldier.activeWeapon].id].moveMultiplier;
    if (soldier.abilityUntil > state.time && soldier.classId === 'assault') speed *= 1.25;
    if (soldier.abilityUntil > state.time && soldier.classId === 'defense' && soldier.shieldHealth > 0) speed *= 0.65;
    if (soldier.y > state.weather.floodY) speed *= 0.55;
    const target = (action.move ?? 0) * speed;
    const acceleration = action.move ? PHYSICS.acceleration : PHYSICS.friction;
    soldier.vx += clamp(target - soldier.vx, -acceleration * dt, acceleration * dt);
    soldier.vx += state.weather.wind * dt * 2;
    soldier.vy = Math.min(1000, soldier.vy + PHYSICS.gravity * dt);
  }
  if (soldier.jumpBufferUntil >= state.time && (soldier.grounded || soldier.coyoteUntil >= state.time || soldier.climbing)) {
    soldier.vy = -PHYSICS.jumpSpeed; soldier.grounded = false; soldier.climbing = false; soldier.platformId = null;
    soldier.jumpBufferUntil = -1; soldier.coyoteUntil = -1;
    state.events.push({ type: 'jump', soldierId: soldier.id, x: soldier.x, y: soldier.y });
  }
  const conveyor = oldGrounded ? oldPlatform?.conveyor ?? 0 : 0;
  if (moveBodyAxis(arena, soldier, 'x', (soldier.vx + conveyor) * dt)) soldier.vx = 0;
  soldier.grounded = false; soldier.platformId = null;
  const vertical = moveBodyAxis(arena, soldier, 'y', soldier.vy * dt);
  if (vertical) {
    if (soldier.vy >= 0) { soldier.grounded = true; soldier.platformId = vertical.id; soldier.climbing = false; }
    soldier.vy = 0;
  }
  if (!oldGrounded && soldier.grounded) state.events.push({ type: 'land', soldierId: soldier.id, x: soldier.x, y: soldier.y });
  if (soldier.grounded && Math.abs(soldier.vx) > 80 && Math.floor(state.time * 3.2) !== Math.floor((state.time - dt) * 3.2)) {
    state.events.push({ type: 'footstep', soldierId: soldier.id, x: soldier.x, y: soldier.y, material: oldPlatform?.material });
  }
}
