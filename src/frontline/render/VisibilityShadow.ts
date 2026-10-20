import { rayRect } from '../core/physics';
import type { Platform, Rect, Vec } from '../core/types';

export type ShadowTriangle = readonly [Vec, Vec, Vec];
const TURN = Math.PI * 2;
const EPSILON = 1e-7;

/** The space beyond the first physical face seen from the observer's eye.
 * The mesh uses ordinary triangles on both rendering backends, with no masks,
 * framebuffer readback or map-sized textures. Geometry and authoritative LOS
 * share the same segment/AABB intersection, including thin and moving decks.
 */
export function visibilityShadow(view: Rect, origin: Vec | undefined, platforms: readonly Platform[], range = Infinity): ShadowTriangle[] {
  if (view.w <= 0 || view.h <= 0) return [];
  const left = view.x, right = left + view.w, top = view.y, bottom = top + view.h;
  if (!origin || !Number.isFinite(origin.x + origin.y) || origin.x < left || origin.x > right || origin.y < top || origin.y > bottom || range <= 0) {
    return [[{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }], [{ x: left, y: top }, { x: right, y: bottom }, { x: left, y: bottom }]];
  }
  const blockers = platforms.filter(p => p.active && p.w > 0 && p.h > 0 && p.x <= right && p.x + p.w >= left && p.y <= bottom && p.y + p.h >= top);
  const angles: number[] = [];
  const add = (x: number, y: number): void => {
    if (Math.abs(x - origin.x) + Math.abs(y - origin.y) < EPSILON) return;
    const angle = Math.atan2(y - origin.y, x - origin.x);
    for (const offset of [-EPSILON, 0, EPSILON]) angles.push(((angle + offset) % TURN + TURN) % TURN);
  };
  // View corners ensure each outer edge is a straight piece of the rectangle.
  add(left, top); add(right, top); add(right, bottom); add(left, bottom);
  for (const p of blockers) {
    add(p.x, p.y); add(p.x + p.w, p.y); add(p.x + p.w, p.y + p.h); add(p.x, p.y + p.h);
  }
  // Only fog-limited views need a curved range boundary. These additional rays
  // keep its error below one pixel without affecting geometry-only outlines.
  if (Number.isFinite(range)) for (let i = 0; i < 96; i++) angles.push(i * TURN / 96);
  angles.sort((a, b) => a - b);
  const rays: { near: Vec; far: Vec }[] = [];
  let previous = -1;
  for (const angle of angles) {
    if (angle - previous < 1e-10) continue;
    previous = angle;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const distanceX = Math.abs(dx) < 1e-12 ? Infinity : ((dx > 0 ? right : left) - origin.x) / dx;
    const distanceY = Math.abs(dy) < 1e-12 ? Infinity : ((dy > 0 ? bottom : top) - origin.y) / dy;
    const distance = Math.max(0, Math.min(distanceX, distanceY));
    const far = { x: origin.x + dx * distance, y: origin.y + dy * distance };
    let fraction = Math.min(1, range / Math.max(distance, 1e-12));
    for (const platform of blockers) {
      const hit = rayRect(origin, far, platform);
      if (hit) fraction = Math.min(fraction, hit.t);
    }
    rays.push({ near: { x: origin.x + dx * distance * fraction, y: origin.y + dy * distance * fraction }, far });
  }
  const triangles: ShadowTriangle[] = [];
  const append = (a: Vec, b: Vec, c: Vec): void => {
    if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) > 1e-8) triangles.push([a, b, c]);
  };
  for (let i = 0; i < rays.length; i++) {
    const a = rays[i], b = rays[(i + 1) % rays.length];
    append(a.near, a.far, b.far); append(a.near, b.far, b.near);
  }
  return triangles;
}
