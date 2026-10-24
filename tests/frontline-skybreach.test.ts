import { describe, expect, it } from 'vitest';
import { findRoute, Navigator } from '../src/frontline/ai/navigation';
import { PHYSICS } from '../src/frontline/core/config';
import { ShooterMatch } from '../src/frontline/core/engine';
import { moveSoldier } from '../src/frontline/core/physics';
import { FIXED_DT, type AircraftZone, type Arena, type NavEdge, type NavNode, type Vec } from '../src/frontline/core/types';
import { buildNavigation, createArena } from '../src/frontline/maps/maps';

/** A standing soldier must fit inside the advertised space, including the
 * playable surface at its bottom edge. Background-only vistas do not count. */
const inZone = (point: Vec, zone: AircraftZone): boolean => point.x >= zone.x + PHYSICS.radius
  && point.x <= zone.x + zone.w - PHYSICS.radius && point.y >= zone.y + PHYSICS.height
  && point.y <= zone.y + zone.h + 1;
const exteriorZones = (arena: Arena): AircraftZone[] => arena.aircraftZones?.filter(zone => zone.kind === 'exterior') ?? [];
const interiorNodes = (arena: Arena): NavNode[] => arena.nav.nodes.filter(node => arena.aircraftZones?.some(zone => zone.kind === 'interior' && inZone(node, zone))
  && !exteriorZones(arena).some(zone => inZone(node, zone)));
const outsideNodes = (arena: Arena, zones: AircraftZone[]): NavNode[] => arena.nav.nodes.filter(node => zones.some(zone => inZone(node, zone)));
const closest = (nodes: NavNode[], point: Vec): NavNode => {
  expect(nodes.length, `No standing navigation surface near ${point.x},${point.y}`).toBeGreaterThan(0);
  return nodes.reduce((best, node) => Math.hypot(node.x - point.x, node.y - point.y) < Math.hypot(best.x - point.x, best.y - point.y) ? node : best);
};
const centre = (zone: AircraftZone): Vec => ({ x: zone.x + zone.w / 2, y: zone.y + zone.h });

function exteriorCircuits(arena: Arena): { name: string; zones: AircraftZone[] }[] {
  const zones = exteriorZones(arena);
  return [
    { name: 'roof', zones: zones.filter(zone => zone.id.includes('roof')) },
    { name: 'wing', zones: zones.filter(zone => zone.id.includes('wing')) },
    { name: 'tail', zones: zones.filter(zone => zone.id.includes('tail')) },
  ];
}

function filteredGraph(arena: Arena, keep: (from: NavNode, to: NavNode, edge: NavEdge) => boolean): Arena {
  return { ...arena, nav: { nodes: arena.nav.nodes, edges: Object.fromEntries(arena.nav.nodes.map(node => [node.id,
    (arena.nav.edges[node.id] ?? []).filter(edge => keep(node, arena.nav.nodes[edge.to]!, edge)),
  ])) } };
}

describe('Skybreach exterior circuits and interior flanks', () => {
  it('provides permanent playable roof, wing and tail spaces with routes back into the aircraft', () => {
    for (const seed of [0, 7, 47, 191]) {
      const arena = createArena('aircraft', seed), inside = interiorNodes(arena);
      for (const circuit of exteriorCircuits(arena)) {
        expect(circuit.zones.length, `${circuit.name}: an authored outdoor space`).toBeGreaterThan(0);
        for (const zone of circuit.zones) {
          const permanent = outsideNodes(arena, [zone]).filter(node => arena.platforms.some(platform => platform.id === node.platformId && platform.active && platform.hp === undefined));
          expect(permanent.length, `seed ${seed}: ${zone.id} has a permanent walkable surface`).toBeGreaterThan(1);
          const outdoors = closest(permanent, centre(zone)), indoors = closest(inside, outdoors);
          expect(findRoute(arena, indoors, outdoors), `seed ${seed}: enter ${zone.id}`).not.toBeNull();
          expect(findRoute(arena, outdoors, indoors), `seed ${seed}: leave ${zone.id}`).not.toBeNull();
        }
      }
    }
  });

  it('keeps a second separated entrance to every outdoor circuit when one entrance is blocked', () => {
    const arena = createArena('aircraft', 47), inside = interiorNodes(arena);
    for (const circuit of exteriorCircuits(arena)) {
      const outdoors = outsideNodes(arena, circuit.zones), ids = new Set(outdoors.map(node => node.id));
      const crossings = outdoors.flatMap(node => (arena.nav.edges[node.id] ?? []).filter(edge => !ids.has(edge.to)).map(edge => {
        const target = arena.nav.nodes[edge.to]!;
        return { x: (node.x + target.x) / 2, y: (node.y + target.y) / 2 };
      }));
      expect(crossings.length, `${circuit.name}: connections to the rest of the aircraft`).toBeGreaterThan(1);
      const first = crossings[0]!;
      expect(crossings.some(point => Math.hypot(point.x - first.x, point.y - first.y) > 180), `${circuit.name}: entrances separated in space`).toBe(true);
      const alternate = filteredGraph(arena, (from, to) => {
        if (ids.has(from.id) === ids.has(to.id)) return true;
        return Math.hypot((from.x + to.x) / 2 - first.x, (from.y + to.y) / 2 - first.y) > 140;
      });
      const source = closest(outdoors, { x: arena.width / 2, y: arena.height / 2 }), target = closest(inside, source);
      expect(findRoute(alternate, source, target), `${circuit.name}: another exit remains`).not.toBeNull();
      expect(findRoute(alternate, target, source), `${circuit.name}: another entry remains`).not.toBeNull();
    }
  });

  it('can bypass an occupied central interior passage through the exterior and re-enter beyond it', () => {
    const arena = createArena('aircraft', 47), inside = interiorNodes(arena);
    const room = arena.aircraftZones!.filter(zone => zone.kind === 'interior' && zone.w >= 600)
      .sort((a, b) => Math.abs(a.x + a.w / 2 - arena.width / 2) - Math.abs(b.x + b.w / 2 - arena.width / 2))[0]!;
    const cutX = room.x + room.w / 2, indoorIds = new Set(inside.map(node => node.id));
    const blocked = new Set(inside.filter(node => Math.abs(node.x - cutX) < 100).map(node => node.id));
    const source = closest(inside.filter(node => node.x < cutX - 250), { x: cutX - 380, y: room.y + room.h });
    const target = closest(inside.filter(node => node.x > cutX + 250), { x: cutX + 380, y: room.y + room.h });
    const detour = filteredGraph(arena, (from, to) => !blocked.has(from.id) && !blocked.has(to.id)
      && !(indoorIds.has(from.id) && indoorIds.has(to.id) && (from.x - cutX) * (to.x - cutX) < 0));
    for (const [from, to] of [[source, target], [target, source]] as const) {
      const route = findRoute(detour, from, to);
      expect(route, `The central indoor passage at x=${cutX} has an alternative`).not.toBeNull();
      expect(route!.nodes.some(node => exteriorZones(arena).some(zone => inZone(node, zone)))).toBe(true);
    }
  });

  it('varies cargo by seed while preserving the permanent aircraft routes after cover destruction', () => {
    const arenas = [47, 191].map(seed => createArena('aircraft', seed));
    const structure = (arena: Arena) => arena.platforms.filter(platform => platform.hp === undefined).map(platform => ({ x: platform.x, y: platform.y, w: platform.w, h: platform.h }));
    expect(structure(arenas[0]!)).toEqual(structure(arenas[1]!));
    expect(arenas[0]!.platforms.filter(platform => platform.hp !== undefined)).not.toEqual(arenas[1]!.platforms.filter(platform => platform.hp !== undefined));
    for (const arena of arenas) {
      for (const platform of arena.platforms) if (platform.hp !== undefined) platform.active = false;
      arena.nav = buildNavigation(arena);
      const origin = arena.spawns[0]!;
      for (const target of [...arena.spawns, ...arena.flagSpawns]) {
        expect(arena.platforms.some(platform => platform.active && Math.abs(platform.y - target.y) < 1
          && target.x >= platform.x + PHYSICS.radius && target.x <= platform.x + platform.w - PHYSICS.radius), `Permanent spawn/objective ${target.x},${target.y} keeps its support`).toBe(true);
        expect(findRoute(arena, origin, target)).not.toBeNull();
        expect(findRoute(arena, target, origin)).not.toBeNull();
      }
      for (const platform of arena.platforms.filter(platform => platform.hp === undefined && platform.w >= 130)) {
        const landing = arena.nav.nodes.find(node => node.platformId === platform.id);
        expect(landing, `Permanent gallery ${platform.id} has a standing landing after destruction`).toBeDefined();
        expect(findRoute(arena, origin, landing!)).not.toBeNull();
        expect(findRoute(arena, landing!, origin)).not.toBeNull();
      }
      const inside = interiorNodes(arena);
      for (const circuit of exteriorCircuits(arena)) {
        const outdoors = closest(outsideNodes(arena, circuit.zones), centre(circuit.zones[0]!)), indoors = closest(inside, outdoors);
        expect(findRoute(arena, indoors, outdoors), `${circuit.name}: enter after destruction`).not.toBeNull();
        expect(findRoute(arena, outdoors, indoors), `${circuit.name}: return after destruction`).not.toBeNull();
      }
    }
  });

  it.each([false, true])('physically tours the roof and wing then re-enters with the loaded defense class (destroyed cover: %s)', destroyed => {
    for (const seed of [47, 191]) {
      const match = new ShooterMatch({ mapId: 'aircraft', mode: 'deathmatch', botCount: 3, difficulty: 'regular', humanClass: 'defense', seed,
        scoreLimit: 999, rounds: 3, timeLimit: 0, eventFrequency: 'reduced' });
      const state = match.state, arena = state.arena, soldier = state.soldiers[0]!, navigator = new Navigator();
      if (destroyed) {
        for (const platform of arena.platforms) if (platform.hp !== undefined) platform.active = false;
        arena.nav = buildNavigation(arena);
      }
      const inside = interiorNodes(arena), start = closest(inside, { x: 1250, y: 1120 });
      Object.assign(soldier, { x: start.x, y: start.y, platformId: start.platformId, vx: 0, vy: 0, grounded: true, climbing: false });
      const circuits = exteriorCircuits(arena), roof = circuits.find(circuit => circuit.name === 'roof')!, wing = circuits.find(circuit => circuit.name === 'wing')!;
      const goals = [closest(outsideNodes(arena, roof.zones), { x: 2500, y: 330 }),
        closest(outsideNodes(arena, wing.zones), { x: 2400, y: 820 }), closest(inside, { x: 3250, y: 1000 })];
      let previousJump = false, climbed = false;
      for (const goal of goals) {
        navigator.setGoal(state, soldier, goal);
        for (let frame = 0; frame < 4200 && (!soldier.grounded || Math.abs(soldier.x - goal.x) > 28 || Math.abs(soldier.y - goal.y) > 4); frame++) {
          const action = navigator.getAction(state, soldier);
          climbed ||= !!action.climb;
          state.time += FIXED_DT; state.tick++; state.events = [];
          // Exercise the real collision/movement code without combat or
          // weather obscuring whether the authored route itself works.
          moveSoldier(state, soldier, action, FIXED_DT, !!action.jump && !previousJump);
          previousJump = !!action.jump;
          const overlap = arena.platforms.find(platform => platform.active && soldier.x - PHYSICS.radius < platform.x + platform.w - 1e-5
            && soldier.x + PHYSICS.radius > platform.x + 1e-5 && soldier.y - PHYSICS.height < platform.y + platform.h - 1e-5 && soldier.y > platform.y + 1e-5);
          expect(overlap, `seed ${seed}: solid collision at ${soldier.x},${soldier.y}`).toBeUndefined();
          expect(soldier.y, `seed ${seed}: the route cannot fall out of the aircraft`).toBeLessThan(arena.height);
        }
        expect(Math.abs(soldier.x - goal.x), `seed ${seed}: goal ${goal.x},${goal.y}; soldier ${soldier.x},${soldier.y}`).toBeLessThanOrEqual(28);
        expect(soldier.y).toBeCloseTo(goal.y, 0);
        expect(soldier.grounded).toBe(true);
      }
      expect(climbed, 'The route executes its physical ladder transfers').toBe(true);
    }
  }, 60_000);
});
