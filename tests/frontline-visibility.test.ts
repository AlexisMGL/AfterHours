import { describe, expect, it } from 'vitest';
import { lineOfSight } from '../src/frontline/core/physics';
import type { Arena, Platform, Vec } from '../src/frontline/core/types';
import { visibilityShadow, type ShadowTriangle } from '../src/frontline/render/VisibilityShadow';

const view = { x: 100, y: 50, w: 960, h: 540 };
const platform = (id: number, x: number, y: number, w: number, h: number, active = true): Platform => ({ id, x, y, w, h, active, material: 'metal', oneWay: true });
const shadowed = (mesh: ShadowTriangle[], point: Vec): boolean => mesh.some(([a, b, c]) => {
  const cross = (u: Vec, v: Vec): number => (v.x - u.x) * (point.y - u.y) - (v.y - u.y) * (point.x - u.x);
  const signs = [cross(a, b), cross(b, c), cross(c, a)];
  return signs.every(s => s >= -1e-7) || signs.every(s => s <= 1e-7);
});

describe('visible-area shadow mesh', () => {
  it('leaves an unobstructed viewport clear and shades the full view without an observer', () => {
    expect(visibilityShadow(view, { x: 500, y: 300 }, [])).toEqual([]);
    const noObserver = visibilityShadow(view, undefined, []);
    for (const point of [{ x: 110, y: 60 }, { x: 700, y: 320 }, { x: 1050, y: 580 }]) expect(shadowed(noObserver, point)).toBe(true);
  });

  it('matches authoritative LOS across thin decks, walls, overlapping cover and real openings', () => {
    const origin = { x: 335, y: 420 };
    const platforms = [platform(1, 180, 260, 320, 8), platform(2, 560, 260, 270, 8), platform(3, 630, 340, 46, 180), platform(4, 650, 410, 130, 65), platform(5, 100, 550, 960, 40)];
    const arena = { platforms } as Arena, mesh = visibilityShadow(view, origin, platforms);
    expect(shadowed(mesh, { x: 300, y: 100 })).toBe(true);
    expect(shadowed(mesh, { x: 800, y: 430 })).toBe(true);
    expect(shadowed(mesh, { x: 500, y: 390 })).toBe(false);
    expect(shadowed(mesh, { x: 690, y: 130 })).toBe(false);
    for (let y = 66; y < 590; y += 17) for (let x = 113; x < 1060; x += 19) {
      const point = { x, y };
      expect(shadowed(mesh, point), `LOS at ${x},${y}`).toBe(!lineOfSight(arena, origin, point));
    }
  });

  it('updates immediately when cover moves or is destroyed, regardless of oneWay metadata', () => {
    const origin = { x: 330, y: 420 }, wall = platform(1, 500, 200, 20, 340), point = { x: 700, y: 410 };
    expect(shadowed(visibilityShadow(view, origin, [wall]), point)).toBe(true);
    wall.x = 800;
    expect(shadowed(visibilityShadow(view, origin, [wall]), point)).toBe(false);
    wall.x = 500; wall.active = false;
    expect(shadowed(visibilityShadow(view, origin, [wall]), point)).toBe(false);
  });

  it('keeps every triangle inside the viewport and bounds fog without leaking behind cover', () => {
    const origin = { x: 500, y: 300 }, mesh = visibilityShadow(view, origin, [platform(1, 640, 280, 24, 120)], 220);
    expect(shadowed(mesh, { x: 500, y: 100 })).toBe(false);
    expect(shadowed(mesh, { x: 500, y: 60 })).toBe(true);
    expect(shadowed(mesh, { x: 680, y: 320 })).toBe(true);
    for (const triangle of mesh) for (const p of triangle) {
      expect(p.x).toBeGreaterThanOrEqual(view.x - 1e-7); expect(p.x).toBeLessThanOrEqual(view.x + view.w + 1e-7);
      expect(p.y).toBeGreaterThanOrEqual(view.y - 1e-7); expect(p.y).toBeLessThanOrEqual(view.y + view.h + 1e-7);
    }
  });
});
