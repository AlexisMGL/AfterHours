import { Random } from '../core/random';
import { hasPortalEscape } from '../core/portals';
import { cellKey, DIRECTIONS, type Arena, type Direction, type MapId, type Point, type PowerUp, type Tile } from '../core/types';

export interface MapDefinition {
  id: MapId;
  name: string;
  subtitle: string;
  description: string;
  mechanic: string;
  icon: string;
  colors: { floor: string; floorAlt: string; wall: string; block: string; accent: string; bg: string };
}

export const MAPS: MapDefinition[] = [
  { id: 'mall', name: 'NEON GALLERIA', subtitle: 'Shopping Mall', description: 'After-hours mayhem among neon storefronts and merchandise crates.', mechanic: 'Moving walkways carry players and loose bombs.', icon: '⇢', colors: {floor:'#464265',floorAlt:'#50486d',wall:'#8478ab',block:'#e5a15a',accent:'#ff73c2',bg:'#211d39'} },
  { id: 'airport', name: 'DEPARTURE ZERO', subtitle: 'Airport', description: 'Clear the luggage lanes in a moonlit international terminal.', mechanic: 'Long baggage belts turn sliding bombs into express deliveries.', icon: '⇉', colors: {floor:'#284b64',floorAlt:'#31566b',wall:'#84a5b5',block:'#e8b849',accent:'#66e5ff',bg:'#122b40'} },
  { id: 'jungle', name: 'JADE TEMPLE', subtitle: 'Jungle', description: 'Ancient gateways and living vines conceal a forgotten tropical ruin.', mechanic: 'Vegetation regrows after a warning. Ancient portals cross the arena.', icon: '↟', colors: {floor:'#36513a',floorAlt:'#3d5b3d',wall:'#849170',block:'#5fa94b',accent:'#b6ee77',bg:'#172e28'} },
  { id: 'factory', name: 'STEAMWORKS', subtitle: 'Factory', description: 'A glowing production floor of steel, steam and unstable machinery.', mechanic: 'Steam vents flash a warning before a dangerous pressure release.', icon: '≋', colors: {floor:'#394555',floorAlt:'#414d5b',wall:'#8395a3',block:'#be7546',accent:'#ffa94d',bg:'#202735'} },
  { id: 'boat', name: 'STORM DECK', subtitle: 'Cargo Ship', description: 'Ride the swell between cargo stacks on an adventurous night voyage.', mechanic: 'A warning bell precedes ship rolls that slide loose bombs.', icon: '≈', colors: {floor:'#695546',floorAlt:'#745d49',wall:'#668c9c',block:'#b98a52',accent:'#60dddb',bg:'#112e45'} },
];

const SIZE = 15;
const LAST = SIZE - 1;
const rotate = ({ x, y }: Point): Point => ({ x: LAST - y, y: x });
const orbit = (p: Point): Point[] => {
  const result = [p];
  for (let n = 1; n < 4; n++) result.push(rotate(result[n - 1]!));
  return result.filter((point, index) => result.findIndex(other => other.x === point.x && other.y === point.y) === index);
};
const canonicalKey = (p: Point): string => orbit(p).map(q => cellKey(q.x, q.y)).sort()[0]!;
const weights: [PowerUp, number][] = [['bomb',26],['fire',24],['speed',17],['push',11],['shield',7],['kick',4],['rapid',4],['remote',3],['portal',2],['invincible',2]];

function weightedUpgrade(random: Random): PowerUp {
  let value = random.next() * 100;
  for (const [type, weight] of weights) {
    value -= weight;
    if (value < 0) return type;
  }
  return 'bomb';
}

/** Rotational orbits receive one random draw, including their hidden upgrade.
 * This gives all four corners identical opportunities without removing seeded variety. */
export function createArena(id: MapId, seed: number): Arena {
  const mapIndex = MAPS.findIndex(map => map.id === id);
  if (mapIndex < 0) throw new Error(`Unknown arena: ${id}`);
  const random = new Random((seed ^ Math.imul(mapIndex + 1, 0x9e3779b1)) >>> 0);
  const tiles: Tile[][] = Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => x === 0 || y === 0 || x === LAST || y === LAST || (x % 2 === 0 && y % 2 === 0) ? 'wall' : 'floor'));
  const arena: Arena = {
    id, width: SIZE, height: SIZE, tiles,
    spawns: [{x:1,y:1},{x:13,y:13},{x:13,y:1},{x:1,y:13}],
    hidden: {}, portals: [], conveyors: [], vents: [], vegetation: [],
  };
  // Open a handful of support columns into long lanes. Their rotational images
  // preserve four-way fairness, while each environment has a distinct silhouette.
  const gaps: Partial<Record<MapId, Point[]>> = {
    airport: [{x:6,y:2},{x:6,y:4}],
    jungle: [{x:4,y:4}],
    factory: [{x:6,y:6}],
    boat: [{x:4,y:6}],
  };
  for (const point of gaps[id] ?? []) for (const p of orbit(point)) tiles[p.y]![p.x] = 'floor';
  const safe = new Set<string>();
  // An initial bomb at (1,1) leaves (3,2) and (2,3) outside its cross.
  // All four copies are enclosed by destructible frontier blocks at the start.
  const startArea = [{x:1,y:1},{x:2,y:1},{x:3,y:1},{x:1,y:2},{x:1,y:3},{x:3,y:2},{x:2,y:3}];
  for (const point of startArea) for (const p of orbit(point)) safe.add(cellKey(p.x,p.y));
  const visited = new Set<string>();
  for (let y = 1; y < LAST; y++) for (let x = 1; x < LAST; x++) {
    if (tiles[y]![x] === 'wall') continue;
    const point = {x,y};
    const key = canonicalKey(point);
    if (visited.has(key)) continue;
    visited.add(key);
    const group = orbit(point);
    const density = id === 'airport' ? .57 : id === 'jungle' ? .68 : id === 'boat' ? .62 : .64;
    const blocked = !safe.has(cellKey(x,y)) && random.next() < density;
    const hidden = blocked && random.next() < .43 ? weightedUpgrade(random) : undefined;
    const vegetation = id === 'jungle' && blocked && random.next() < .55;
    for (const p of group) {
      tiles[p.y]![p.x] = blocked ? 'block' : 'floor';
      if (hidden) arena.hidden[cellKey(p.x,p.y)] = hidden;
      if (vegetation) arena.vegetation.push(p);
    }
  }
  // These three frontier cells keep every starting pocket separate, even for
  // particularly sparse seeds. A guaranteed common upgrade rewards opening it.
  for (const point of [{x:4,y:1},{x:1,y:4},{x:3,y:3}]) for (const p of orbit(point)) tiles[p.y]![p.x] = 'block';
  const startingUpgrade = random.next() < .5 ? 'bomb' : 'fire';
  for (const p of orbit({x:3,y:3})) arena.hidden[cellKey(p.x,p.y)] = startingUpgrade;
  const clear = (p: Point): void => {
    tiles[p.y]![p.x] = 'floor';
    delete arena.hidden[cellKey(p.x,p.y)];
    arena.vegetation = arena.vegetation.filter(v => v.x !== p.x || v.y !== p.y);
  };
  const addBelt = (point: Point, direction: Direction): void => {
    clear(point);
    if (!arena.conveyors.some(belt => belt.x === point.x && belt.y === point.y)) arena.conveyors.push({...point,direction});
  };
  if (id === 'mall') {
    const turns: Direction[] = ['right','down','left','up'];
    for (let x = 5; x <= 7; x++) orbit({x,y:3}).forEach((p,i) => addBelt(p,turns[i]!));
  } else if (id === 'airport') {
    // Two parallel, opposing baggage lanes, repeated across the terminal.
    for (let x = 3; x <= 11; x++) {
      addBelt({x,y:5}, 'right');
      addBelt({x:LAST-x,y:9}, 'left');
    }
    for (let y = 3; y <= 11; y++) {
      if (y !== 5 && y !== 9) {
        addBelt({x:9,y},'down');
        addBelt({x:5,y:LAST-y},'up');
      }
    }
  } else {
    const gates = [{a:{x:3,y:7},b:{x:11,y:7}},{a:{x:7,y:3},b:{x:7,y:11}}];
    arena.portals = gates.map((gate,index) => ({id:index+1,...gate,until:Infinity}));
    // Preserve a symmetric walking area around every mouth; clearing only the
    // portal tile can leave it surrounded by seeded destructible blocks.
    for (const gate of gates) for (const end of [gate.a, gate.b]) {
      clear(end);
      for (const delta of Object.values(DIRECTIONS)) {
        const neighbor = { x: end.x + delta.x, y: end.y + delta.y };
        if (tiles[neighbor.y]?.[neighbor.x] !== 'wall') clear(neighbor);
      }
    }
    if (id === 'factory') {
      arena.vents = orbit({x:5,y:5});
      arena.vents.forEach(clear);
    }
  }
  return arena;
}

function flood(arena: Arena, start: Point, blocksPassable: boolean): Set<string> {
  const seen = new Set<string>([cellKey(start.x,start.y)]);
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor]!;
    for (const delta of Object.values(DIRECTIONS)) {
      const next = {x:current.x+delta.x,y:current.y+delta.y};
      const tile = arena.tiles[next.y]?.[next.x];
      const key = cellKey(next.x,next.y);
      if (!tile || tile === 'wall' || (!blocksPassable && tile === 'block') || seen.has(key)) continue;
      seen.add(key); queue.push(next);
    }
  }
  return seen;
}

/** Validates structural connectivity, symmetric opportunities and spawn escapes.
 * Connectivity deliberately treats blocks as removable; initial pockets must
 * remain disconnected until players open a route with a bomb. */
export function validateArena(arena: Arena): {valid:boolean;errors:string[]} {
  const errors: string[] = [];
  if (arena.width !== SIZE || arena.height !== SIZE || arena.tiles.length !== SIZE || arena.tiles.some(row => row.length !== SIZE)) return {valid:false,errors:['Arena must be a complete 15 × 15 grid.']};
  if (arena.spawns.length !== 4 || new Set(arena.spawns.map(p => cellKey(p.x,p.y))).size !== 4) errors.push('Exactly four distinct spawns are required.');
  for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) {
    const tile = arena.tiles[y]![x]!;
    if ((x===0 || y===0 || x===LAST || y===LAST) && tile!=='wall') errors.push(`Open perimeter at ${x},${y}.`);
    const rotated = rotate({x,y});
    if (tile !== arena.tiles[rotated.y]![rotated.x]) errors.push(`Unfair obstacle distribution at ${x},${y}.`);
    if (arena.hidden[cellKey(x,y)] && tile !== 'block') errors.push(`Upgrade outside a block at ${x},${y}.`);
    if (arena.hidden[cellKey(x,y)] !== arena.hidden[cellKey(rotated.x,rotated.y)]) errors.push(`Unfair hidden upgrade at ${x},${y}.`);
  }
  const first = arena.spawns[0];
  if (first) {
    const connected = flood(arena,first,true);
    let traversable=0;
    for (const row of arena.tiles) traversable += row.filter(tile => tile!=='wall').length;
    if (connected.size !== traversable) errors.push('Permanent walls isolate part of the arena.');
  }
  let pocketSize: number | undefined;
  for (const spawn of arena.spawns) {
    if (arena.tiles[spawn.y]?.[spawn.x] !== 'floor') { errors.push(`Invalid spawn at ${spawn.x},${spawn.y}.`); continue; }
    const pocket = flood(arena,spawn,false);
    if (pocketSize !== undefined && pocket.size !== pocketSize) errors.push('Starting pockets differ in size.');
    pocketSize=pocket.size;
    if (arena.spawns.some(other => other !== spawn && pocket.has(cellKey(other.x,other.y)))) errors.push('Participants are not separated at the start.');
    const safeEscape = [...pocket].some(key => {
      const [x,y]=key.split(',').map(Number) as [number,number];
      return x !== spawn.x && y !== spawn.y;
    });
    if (pocket.size < 5 || !safeEscape) errors.push(`No safe initial bomb escape at ${spawn.x},${spawn.y}.`);
  }
  for (const portal of arena.portals) for (const end of [portal.a,portal.b]) {
    if (arena.tiles[end.y]?.[end.x] !== 'floor') errors.push('Portal endpoint is not walkable.');
    else if (!hasPortalEscape(arena, end)) errors.push('Portal endpoint has no walking exit.');
  }
  for (const special of [...arena.conveyors,...arena.vents]) if (arena.tiles[special.y]?.[special.x] !== 'floor') errors.push('Special floor tile is obstructed.');
  return {valid:errors.length===0,errors};
}
