export type MapId = 'mall' | 'airport' | 'jungle' | 'factory' | 'boat';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Tile = 'floor' | 'wall' | 'block';
export type PowerUp = 'bomb' | 'fire' | 'speed' | 'push' | 'kick' | 'shield' | 'invincible' | 'remote' | 'rapid' | 'portal';
export interface Point { x: number; y: number }
export interface Action { move?: Direction; bomb?: boolean; ability?: boolean }
export interface Controller { getAction(state: MatchState, playerId: number): Action; reset(): void }
export interface FutureRemoteController extends Controller { submit(tick: number, action: Action): void }
export const DIRECTIONS: Record<Direction, Point> = { up: {x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} };
export const FIXED_DT = 1 / 60;
export const POWER_UPS: PowerUp[] = ['bomb','fire','speed','push','kick','shield','invincible','remote','rapid','portal'];
export interface PlayerStats { bombs: number; blocks: number; pickups: number; kills: number; largestChain: number; survival: number }
export interface Player extends Point {
  id: number; name: string; color: string; alive: boolean; human: boolean; facing: Direction;
  capacity: number; range: number; speed: number; push: boolean; kick: boolean; shield: boolean;
  invincibleUntil: number; remoteUntil: number; rapidUntil: number; portalCharges: number;
  portalCooldown: number; portalAnchor?: Point; stats: PlayerStats;
}
export interface Bomb extends Point {
  id: number; owner: number; range: number; detonateAt: number; remote: boolean;
  direction?: Direction; slideSpeed: number; slideRemaining: number; portalCooldown: number; passThrough: number[];
}
export interface Flame extends Point { until: number; owner: number }
export interface Pickup extends Point { type: PowerUp; revealedAt: number }
export interface Portal { id: number; a: Point; b: Point; until: number }
export interface Conveyor extends Point { direction: Direction }
export interface Regrowth extends Point { at: number }
export interface GameEvent extends Point { type: 'bomb'|'explosion'|'block'|'pickup'|'teleport'|'death'|'shield'|'warning'|'victory'|'combo'|'kick'; player?: number; value?: number; powerUp?: PowerUp }
export interface Arena {
  id: MapId; width: number; height: number; tiles: Tile[][]; spawns: Point[];
  hidden: Record<string, PowerUp>; portals: Portal[]; conveyors: Conveyor[]; vents: Point[]; vegetation: Point[];
}
export interface MatchConfig { mapId: MapId; seed: number; opponents: number; difficulties: Difficulty[]; suddenDeathAt?: number }
export interface MatchState {
  tick: number; time: number; seed: number; arena: Arena; players: Player[]; bombs: Bomb[]; flames: Flame[];
  pickups: Pickup[]; portals: Portal[]; regrowth: Regrowth[]; events: GameEvent[];
  status: 'playing'|'finished'; winner: number|null; suddenDeathAt: number; closingTiles: Point[]; closingAt: number; closedRing: number;
}
export const cellKey = (x: number, y: number): string => `${Math.round(x)},${Math.round(y)}`;
export const tileAt = (arena: Arena, x: number, y: number): Tile => arena.tiles[Math.round(y)]?.[Math.round(x)] ?? 'wall';
export const sameCell = (a: Point, b: Point): boolean => Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y);
