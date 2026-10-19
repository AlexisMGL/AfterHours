import { DIRECTIONS, tileAt, type Arena, type Point } from './types';

/** A portal mouth must have an ordinary walking exit, independent of teleport cooldowns. */
export function hasPortalEscape(arena: Arena, mouth: Point, canEnter: (point: Point) => boolean = () => true): boolean {
  if (tileAt(arena, mouth.x, mouth.y) !== 'floor') return false;
  return Object.values(DIRECTIONS).some(delta => {
    const neighbor = { x: mouth.x + delta.x, y: mouth.y + delta.y };
    return tileAt(arena, neighbor.x, neighbor.y) === 'floor' && canEnter(neighbor);
  });
}
