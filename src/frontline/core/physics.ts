import { CLASSES, PHYSICS, WEAPONS } from './config';
import { clamp, type Action, type Arena, type MatchState, type Platform, type Rect, type Soldier, type Vec } from './types';

export const soldierBox = (soldier: Vec): Rect => ({ x: soldier.x - PHYSICS.radius, y: soldier.y - PHYSICS.height, w: PHYSICS.radius * 2, h: PHYSICS.height });
export const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export interface RayHit { point: Vec; t: number; normal: Vec }

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
  if (far <= 1e-7 || near > 1 || far < 0) return null;
  const t = Math.max(0, near);
  return { point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, t, normal };
}

export function raycastGeometry(arena: Arena, from: Vec, to: Vec): (RayHit & { platform: Platform }) | null {
  let nearest: (RayHit & { platform: Platform }) | null = null;
  for (const platform of arena.platforms) {
    if (!platform.active || platform.oneWay) continue;
    const hit = rayRect(from, to, platform);
    if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, platform };
  }
  return nearest;
}
export const lineOfSight = (arena: Arena, from: Vec, to: Vec): boolean => !raycastGeometry(arena, from, to);

export function updateMovingPlatforms(state: MatchState): void {
  for (const platform of state.arena.platforms) {
    if (!platform.active) continue;
    platform.previousX = platform.x; platform.previousY = platform.y;
    if (!platform.moving) continue;
    const moving = platform.moving;
    const phase = ((state.time / moving.period + moving.phase) % 1 + 1) % 1;
    const eased = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    platform[moving.axis] = moving.from + (moving.to - moving.from) * eased;
    for (const soldier of state.soldiers) {
      if (!soldier.alive) continue;
      if (soldier.platformId === platform.id && soldier.grounded) {
        soldier.x += platform.x - platform.previousX;
        soldier.y += platform.y - platform.previousY;
      } else if (!platform.oneWay && overlaps(soldierBox(soldier), platform)) {
        // Travelling cargo pushes instead of phasing through characters.
        const dx = platform.x - platform.previousX, dy = platform.y - platform.previousY;
        if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > 1e-7) {
          soldier.x = dx > 0 ? platform.x + platform.w + PHYSICS.radius : platform.x - PHYSICS.radius;
          soldier.vx = dx / (1 / 60);
        } else if (dy < 0) {
          soldier.y = platform.y; soldier.vy = 0; soldier.grounded = true; soldier.platformId = platform.id;
        } else if (dy > 0) soldier.y = platform.y + platform.h + PHYSICS.height;
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
  if (action.drop && oldPlatform?.oneWay) { soldier.dropUntil = state.time + 0.3; soldier.grounded = false; soldier.y += 3; soldier.platformId = null; }
  const ladders = arena.ladders.filter(l => soldier.x + PHYSICS.radius > l.x && soldier.x - PHYSICS.radius < l.x + l.w
    && soldier.y >= l.y && soldier.y - PHYSICS.height < l.y + l.h);
  ladders.sort((a, b) => action.climb === 1 ? b.y - a.y : a.y - b.y);
  const ladder = ladders[0];
  if (action.climb && ladder) {
    const atEnd = soldier.grounded && (action.climb < 0 ? ladder.y + PHYSICS.height + 12 >= soldier.y : ladder.y + ladder.h - 12 <= soldier.y);
    soldier.climbing = !atEnd;
  }
  if (!ladder || action.move) soldier.climbing = false;
  if (soldier.climbing && ladder) {
    soldier.vx = 0;
    soldier.x += clamp(ladder.x + ladder.w / 2 - soldier.x, -160 * dt, 160 * dt);
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
  if (soldier.jumpBufferUntil >= state.time && (soldier.grounded || soldier.coyoteUntil >= state.time || soldier.climbing)
    && !action.drop) {
    soldier.vy = -PHYSICS.jumpSpeed; soldier.grounded = false; soldier.climbing = false; soldier.platformId = null;
    soldier.jumpBufferUntil = -1; soldier.coyoteUntil = -1;
    state.events.push({ type: 'jump', soldierId: soldier.id, x: soldier.x, y: soldier.y });
  }
  const oldX = soldier.x;
  const conveyor = oldGrounded ? oldPlatform?.conveyor ?? 0 : 0;
  soldier.x = clamp(soldier.x + (soldier.vx + conveyor) * dt, PHYSICS.radius, arena.width - PHYSICS.radius);
  for (const platform of arena.platforms) {
    if (!platform.active || platform.oneWay || !overlaps(soldierBox(soldier), platform)) continue;
    const before = { ...soldierBox(soldier), x: oldX - PHYSICS.radius };
    if (before.x + before.w <= platform.x + 0.01) soldier.x = platform.x - PHYSICS.radius;
    else if (before.x >= platform.x + platform.w - 0.01) soldier.x = platform.x + platform.w + PHYSICS.radius;
    else continue;
    soldier.vx = 0;
  }
  const oldY = soldier.y;
  soldier.y += soldier.vy * dt;
  soldier.grounded = false; soldier.platformId = null;
  for (const platform of arena.platforms) {
    if (!platform.active || soldier.x + PHYSICS.radius <= platform.x || soldier.x - PHYSICS.radius >= platform.x + platform.w) continue;
    if (platform.oneWay && (soldier.dropUntil > state.time || soldier.climbing)) continue;
    if (soldier.vy >= 0 && oldY <= platform.y + 1 && soldier.y >= platform.y) {
      soldier.y = platform.y; soldier.vy = 0; soldier.grounded = true; soldier.platformId = platform.id;
    } else if (!platform.oneWay && soldier.vy < 0 && oldY - PHYSICS.height >= platform.y + platform.h - 0.01
      && soldier.y - PHYSICS.height < platform.y + platform.h) {
      soldier.y = platform.y + platform.h + PHYSICS.height; soldier.vy = 0;
    }
  }
  // Ladder exits rest exactly on upper platforms rather than hovering or falling back.
  if (soldier.climbing && action.climb) {
    const exit = arena.platforms.find(p => p.active && soldier.x >= p.x && soldier.x <= p.x + p.w
      && (action.climb === -1 ? oldY > p.y + 2 : oldY < p.y - 2) && Math.abs(soldier.y - p.y) < 5);
    if (exit) { soldier.y = exit.y; soldier.vy = 0; soldier.grounded = true; soldier.platformId = exit.id; soldier.climbing = false; }
  }
  if (!oldGrounded && soldier.grounded) state.events.push({ type: 'land', soldierId: soldier.id, x: soldier.x, y: soldier.y });
  if (soldier.grounded && Math.abs(soldier.vx) > 80 && Math.floor(state.time * 3.2) !== Math.floor((state.time - dt) * 3.2)) {
    state.events.push({ type: 'footstep', soldierId: soldier.id, x: soldier.x, y: soldier.y, material: oldPlatform?.material });
  }
}
