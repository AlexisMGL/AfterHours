import { CLASSES, PHYSICS, WEAPONS } from '../core/config';
import { FIXED_DT, clamp, type Arena, type Platform, type Vec } from '../core/types';

// A route shared by all classes must work for the slowest starting loadout.
const speed = Math.min(...Object.values(CLASSES).map(definition => definition.speed * WEAPONS[definition.primary].moveMultiplier));
const epsilon = 1e-6;
const discretePeak = (PHYSICS.jumpSpeed + PHYSICS.gravity * FIXED_DT / 2) ** 2 / (2 * PHYSICS.gravity);

/** A bounded, allocation-light probe of one jump against actual solid geometry.
 * Side contact can slide until the feet clear a cargo lip; ceilings cannot be
 * crossed. Landing on another support needs a separate navigation edge.
 */
export function jumpReachable(arena: Arena, from: Vec, to: Vec, targetPlatformId: number): boolean {
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return false;
  const target = arena.platforms.find(platform => platform.id === targetPlatformId && platform.active);
  if (!target || Math.abs(to.y - target.y) > 2 || to.x < target.x || to.x > target.x + target.w
    || from.y - to.y > discretePeak || Math.abs(to.x - from.x) > speed * 1.4 + 24) return false;

  // Broad phase is done once per candidate, rather than scanning the entire
  // arena during every flight tick. A probe uses at most 84 lightweight ticks.
  const left = Math.min(from.x, to.x) - PHYSICS.radius - 32, right = Math.max(from.x, to.x) + PHYSICS.radius + 32;
  const top = from.y - discretePeak - PHYSICS.height - 2, bottom = Math.max(from.y, to.y) + 2;
  const geometry = arena.platforms.filter(platform => platform.active && platform.x < right && platform.x + platform.w > left
    && platform.y < bottom && platform.y + platform.h > top);
  const occupied = (x: number, y: number): boolean => geometry.some(platform => x + PHYSICS.radius > platform.x + epsilon
    && x - PHYSICS.radius < platform.x + platform.w - epsilon && y > platform.y + epsilon && y - PHYSICS.height < platform.y + platform.h - epsilon);
  if (occupied(from.x, from.y) || occupied(to.x, to.y)) return false;
  const supported = geometry.some(platform => Math.abs(platform.y - from.y) < 2
    && from.x + PHYSICS.radius > platform.x && from.x - PHYSICS.radius < platform.x + platform.w);
  if (!supported) return false;

  let x = from.x, y = from.y, vx = 0, vy: number = -PHYSICS.jumpSpeed;
  for (let tick = 0; tick < 84; tick++) {
    const dx = to.x - x, direction = Math.abs(dx) > 3 ? Math.sign(dx) : 0;
    vx += clamp(direction * speed - vx, -(direction ? PHYSICS.acceleration : PHYSICS.friction) * FIXED_DT,
      (direction ? PHYSICS.acceleration : PHYSICS.friction) * FIXED_DT);
    // The real first jump tick sets -650 after gravity has already run.
    if (tick > 0) vy = Math.min(1000, vy + PHYSICS.gravity * FIXED_DT);
    const moveX = vx * FIXED_DT;
    let nextX = clamp(x + moveX, PHYSICS.radius, arena.width - PHYSICS.radius), blockedX = false;
    for (const platform of geometry) {
      if (y <= platform.y + epsilon || y - PHYSICS.height >= platform.y + platform.h - epsilon) continue;
      if (moveX > 0 && x + PHYSICS.radius <= platform.x + epsilon && nextX + PHYSICS.radius >= platform.x) { nextX = Math.min(nextX, platform.x - PHYSICS.radius); blockedX = true; }
      else if (moveX < 0 && x - PHYSICS.radius >= platform.x + platform.w - epsilon && nextX - PHYSICS.radius <= platform.x + platform.w) { nextX = Math.max(nextX, platform.x + platform.w + PHYSICS.radius); blockedX = true; }
    }
    if (blockedX) vx = 0;
    x = nextX;
    const moveY = vy * FIXED_DT;
    let nextY = y + moveY, landing: Platform | undefined, blockedHead = false;
    for (const platform of geometry) {
      if (x + PHYSICS.radius <= platform.x + epsilon || x - PHYSICS.radius >= platform.x + platform.w - epsilon) continue;
      if (moveY >= 0 && y <= platform.y + epsilon && nextY >= platform.y) { nextY = Math.min(nextY, platform.y); landing = platform; }
      else if (moveY < 0 && y - PHYSICS.height >= platform.y + platform.h - epsilon && nextY - PHYSICS.height <= platform.y + platform.h) {
        nextY = Math.max(nextY, platform.y + platform.h + PHYSICS.height); blockedHead = true;
      }
    }
    if (blockedHead) vy = 0;
    y = nextY;
    if (landing) {
      if (landing.id !== targetPlatformId) return false;
      // The bot can finish along the same support after a valid landing,
      // provided no solid body obstruction separates it from its target node.
      return !geometry.some(platform => platform.id !== targetPlatformId && platform.y < target.y - epsilon
        && platform.y + platform.h > target.y - PHYSICS.height + epsilon
        && platform.x < Math.max(x, to.x) + PHYSICS.radius - epsilon
        && platform.x + platform.w > Math.min(x, to.x) - PHYSICS.radius + epsilon);
    }
    if (vy >= 0 && y > to.y + 2) return false;
  }
  return false;
}
