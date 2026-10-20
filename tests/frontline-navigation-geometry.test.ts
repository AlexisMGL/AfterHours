import { describe, expect, it } from 'vitest';
import { jumpReachable } from '../src/frontline/maps/jump-navigation';
import { ShooterMatch } from '../src/frontline/core/engine';
import type { Arena, Platform } from '../src/frontline/core/types';

const platform = (id: number, x: number, y: number, w: number, h = 20): Platform => ({ id, x, y, w, h, active: true, oneWay: true, material: 'metal' });
function scene(platforms: Platform[]): Arena {
  return { id: 'factory', name: 'Jump fixture', width: 1200, height: 800, platforms, ladders: [], spawns: [], crateSpawns: [], flagSpawns: [], nav: { nodes: [], edges: {} }, hazards: [],
    palette: { sky: '#000', far: '#000', near: '#000', ground: '#000', edge: '#000', accent: '#000' } };
}

describe('solid geometry jump navigation', () => {
  it('reaches a raised cargo surface by sliding against its side until the feet clear its lip', () => {
    const arena = scene([platform(1, 0, 600, 1200, 80), platform(2, 400, 490, 120, 110)]);
    expect(jumpReachable(arena, { x: 376, y: 600 }, { x: 430, y: 490 }, 2)).toBe(true);
  });
  it('rejects the same raised landing when a solid ceiling blocks the jump', () => {
    const arena = scene([platform(1, 0, 600, 1200, 80), platform(2, 400, 490, 120, 110), platform(3, 300, 510, 90, 20)]);
    expect(jumpReachable(arena, { x: 376, y: 600 }, { x: 430, y: 490 }, 2)).toBe(false);
  });
  it('cannot jump through the underside of its requested landing deck', () => {
    const arena = scene([platform(1, 0, 600, 1200, 80), platform(2, 300, 490, 300)]);
    expect(jumpReachable(arena, { x: 420, y: 600 }, { x: 450, y: 490 }, 2)).toBe(false);
  });
  it('crosses a real 64 px gap between adjacent supported galleries in both directions', () => {
    const arena = scene([platform(1, 100, 490, 200), platform(2, 364, 490, 200)]);
    expect(jumpReachable(arena, { x: 278, y: 490 }, { x: 386, y: 490 }, 2)).toBe(true);
    expect(jumpReachable(arena, { x: 386, y: 490 }, { x: 278, y: 490 }, 1)).toBe(true);
  });
  it('rejects a side wall and respects removal of destroyed geometry', () => {
    const wall = platform(3, 325, 200, 10, 400), arena = scene([platform(1, 100, 490, 200), platform(2, 364, 490, 200), wall]);
    expect(jumpReachable(arena, { x: 278, y: 490 }, { x: 386, y: 490 }, 2)).toBe(false);
    wall.active = false; expect(jumpReachable(arena, { x: 278, y: 490 }, { x: 386, y: 490 }, 2)).toBe(true);
  });
  it('rejects unsupported starts, inactive targets and platforms beyond jump height without mutating geometry', () => {
    const arena = scene([platform(1, 100, 600, 200), platform(2, 364, 430, 200)]), before = JSON.stringify(arena);
    expect(jumpReachable(arena, { x: 278, y: 600 }, { x: 386, y: 430 }, 2)).toBe(false);
    expect(jumpReachable(arena, { x: 278, y: 570 }, { x: 386, y: 430 }, 2)).toBe(false);
    expect(JSON.stringify(arena)).toBe(before); arena.platforms[1]!.active = false;
    expect(jumpReachable(arena, { x: 278, y: 600 }, { x: 386, y: 430 }, 2)).toBe(false);
  });
  it('accepted cargo and gap jumps also land in the real physics for the slowest loaded class', () => {
    const cases = [
      { arena: scene([platform(1, 0, 600, 1200, 80), platform(2, 400, 490, 120, 110)]), from: { x: 376, y: 600 }, to: { x: 430, y: 490 }, target: 2 },
      { arena: scene([platform(1, 100, 490, 200), platform(2, 364, 490, 200)]), from: { x: 278, y: 490 }, to: { x: 386, y: 490 }, target: 2 },
      { arena: scene([platform(1, 100, 490, 200), platform(2, 364, 490, 200)]), from: { x: 386, y: 490 }, to: { x: 278, y: 490 }, target: 1 },
    ];
    for (const route of cases) {
      expect(jumpReachable(route.arena, route.from, route.to, route.target)).toBe(true);
      const match = new ShooterMatch({ mapId: 'factory', mode: 'deathmatch', botCount: 3, difficulty: 'regular', humanClass: 'defense', seed: 5,
        scoreLimit: 99, rounds: 3, timeLimit: 480, eventFrequency: 'normal' });
      const state = match.state, soldier = state.soldiers[0]!;
      state.arena = route.arena; state.crates = []; state.flags = []; state.loot = [];
      const support = route.arena.platforms.find(candidate => candidate.y === route.from.y && route.from.x >= candidate.x && route.from.x <= candidate.x + candidate.w)!;
      Object.assign(soldier, route.from, { vx: 0, vy: 0, grounded: true, platformId: support.id });
      for (let frame = 0; frame < 84; frame++) {
        const dx = route.to.x - soldier.x;
        match.step({ 0: { jump: frame === 0, move: (Math.abs(dx) > 3 ? Math.sign(dx) : 0) as -1 | 0 | 1 } });
        if (frame > 0 && soldier.grounded) break;
      }
      expect(soldier.grounded).toBe(true); expect(soldier.platformId).toBe(route.target);
    }
  });
});
