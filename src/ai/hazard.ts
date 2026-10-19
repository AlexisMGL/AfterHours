import { GAMEPLAY } from '../core/tuning';
import { cellKey, DIRECTIONS, sameCell, type Bomb, type MatchState, type Point, type Tile } from '../core/types';

export interface HazardInterval { start: number; end: number; source: 'bomb' | 'flame' | 'steam' | 'closing'; owner?: number; remotePotential?: boolean }
export interface OccupancyInterval { start: number; end: number; bombId: number }
export interface DangerMap {
  hazards: Map<string, HazardInterval[]>;
  occupancy: Map<string, OccupancyInterval[]>;
  explosions: Map<number, { at: number; point: Point; tiles: Point[] }>;
  now: number;
  until: number;
}
const SAMPLE = 1 / 60;

/** Bomb rays stop at the first destructible tile, and never travel through a portal. */
export function blastTiles(state: Pick<MatchState, 'arena'>, point: Point, range: number, tiles: Tile[][] = state.arena.tiles): Point[] {
  const origin = {x:Math.round(point.x),y:Math.round(point.y)};
  const result = [origin];
  for (const delta of Object.values(DIRECTIONS)) for (let distance = 1; distance <= range; distance++) {
    const next = {x:origin.x+delta.x*distance,y:origin.y+delta.y*distance};
    const tile = tiles[next.y]?.[next.x] ?? 'wall';
    if (tile === 'wall') break;
    result.push(next);
    if (tile === 'block') break;
  }
  return result;
}

const addHazard = (danger: DangerMap, point: Point, interval: HazardInterval): void => {
  const key = cellKey(point.x,point.y);
  const list = danger.hazards.get(key) ?? [];
  list.push(interval);
  danger.hazards.set(key,list);
};

function addOccupancy(danger: DangerMap, bomb: Bomb, time: number): void {
  const key = cellKey(bomb.x,bomb.y);
  const list = danger.occupancy.get(key) ?? [];
  const last = list[list.length-1];
  if (last?.bombId === bomb.id && last.end >= time - SAMPLE * 1.1) last.end=time+SAMPLE;
  else list.push({start:time-SAMPLE,end:time+SAMPLE,bombId:bomb.id});
  danger.occupancy.set(key,list);
}

/** A short, private forward simulation predicts moving bombs, belts, gates,
 * ship rolls, flame contacts and chain reactions. It never mutates game state
 * and reads no hidden upgrades or future random choices. */
export function buildDangerMap(state: MatchState, additionalBomb?: Bomb, horizon = 5): DangerMap {
  const danger: DangerMap = {hazards:new Map(),occupancy:new Map(),explosions:new Map(),now:state.time,until:state.time+horizon};
  for (const flame of state.flames) if (flame.until > state.time) addHazard(danger,flame,{start:state.time,end:flame.until,source:'flame',owner:flame.owner});
  for (const vent of state.arena.vents) {
    const firstCycle = Math.floor(state.time/GAMEPLAY.steamPeriod);
    for (let cycle = firstCycle; cycle*GAMEPLAY.steamPeriod+GAMEPLAY.steamStart <= danger.until; cycle++) {
      const start=cycle*GAMEPLAY.steamPeriod+GAMEPLAY.steamStart;
      const end=cycle*GAMEPLAY.steamPeriod+GAMEPLAY.steamEnd;
      if (end > state.time) addHazard(danger,vent,{start,end,source:'steam'});
    }
  }
  if (state.closingTiles.length) for (const point of state.closingTiles) addHazard(danger,point,{start:state.closingAt,end:Infinity,source:'closing'});
  const terrain = state.arena.tiles.map(row=>[...row]);
  const bombs = state.bombs.map(bomb=>({...bomb,passThrough:[...bomb.passThrough]}));
  if (additionalBomb) bombs.push({...additionalBomb,passThrough:[...additionalBomb.passThrough]});
  const live = new Map(bombs.map(bomb=>[bomb.id,bomb]));
  const portalLocks = new Map<number,string>();
  const remoteThreats = bombs.filter(bomb => bomb.remote && bomb.owner !== additionalBomb?.owner);
  // Remote enemies can choose to detonate at any moment. Their current cross
  // remains a possible danger until the fuse's upper bound, rather than being
  // treated as a conveniently predictable regular bomb.
  const free = (x:number,y:number,except:Bomb):boolean => {
    const radius=.3;
    for (const px of [x-radius,x+radius]) for (const py of [y-radius,y+radius]) if (terrain[Math.round(py)]?.[Math.round(px)] !== 'floor') return false;
    for (const other of live.values()) if (other.id!==except.id && Math.hypot(other.x-x,other.y-y)<.61) return false;
    for (const player of state.players) if (player.alive && !except.passThrough.includes(player.id) && Math.abs(player.x-x)<.58 && Math.abs(player.y-y)<.58) return false;
    return true;
  };
  for (let time = state.time; time <= danger.until+SAMPLE/2 && live.size; time += SAMPLE) {
    const previous=time-SAMPLE;
    for (const bomb of live.values()) {
      addOccupancy(danger,bomb,time);
      if (time > state.time) {
        if (state.arena.id==='boat' && Math.floor(time/GAMEPLAY.boatPeriod)>Math.floor(previous/GAMEPLAY.boatPeriod) && !bomb.direction) {
          bomb.direction=Math.floor(time/GAMEPLAY.boatPeriod)%2===1?'left':'right';
          bomb.slideSpeed=2.2; bomb.slideRemaining=1;
        }
        const belt=state.arena.conveyors.find(point=>sameCell(point,bomb));
        if (belt && (!bomb.direction || (bomb.direction!==belt.direction && Math.abs(bomb.x-Math.round(bomb.x))<.085 && Math.abs(bomb.y-Math.round(bomb.y))<.085))) {
          const flow=DIRECTIONS[belt.direction];
          const cx=Math.round(bomb.x),cy=Math.round(bomb.y);
          if (free(cx+flow.x,cy+flow.y,bomb)) {
            if (bomb.direction) {bomb.x=cx;bomb.y=cy;}
            bomb.direction=belt.direction;
            bomb.slideSpeed=Math.max(bomb.slideSpeed,GAMEPLAY.conveyorBombSpeed);
            bomb.slideRemaining=Math.max(bomb.slideRemaining,1);
          } else if (bomb.direction) {bomb.x=cx;bomb.y=cy;bomb.direction=undefined;bomb.slideRemaining=0;}
        }
        if (bomb.direction) {
          const delta=DIRECTIONS[bomb.direction];
          const distance=Math.min(bomb.slideSpeed*SAMPLE,bomb.slideRemaining);
          const x=bomb.x+delta.x*distance,y=bomb.y+delta.y*distance;
          if (free(x,y,bomb)) {
            bomb.x=x; bomb.y=y; bomb.slideRemaining-=distance;
            if (bomb.slideRemaining<=.001) { bomb.direction=undefined; bomb.x=Math.round(bomb.x); bomb.y=Math.round(bomb.y); }
          } else {
            const cx=Math.round(bomb.x),cy=Math.round(bomb.y);
            if (free(cx,cy,bomb)) {bomb.x=cx;bomb.y=cy;}
            bomb.direction=undefined; bomb.slideRemaining=0;
          }
        }
        const lock=portalLocks.get(bomb.id);
        if (lock && lock!==cellKey(bomb.x,bomb.y)) portalLocks.delete(bomb.id);
        if (!portalLocks.has(bomb.id) && bomb.portalCooldown <= time && Math.abs(bomb.x-Math.round(bomb.x))<=.12 && Math.abs(bomb.y-Math.round(bomb.y))<=.12) {
          for (const portal of state.portals) {
            if (portal.until<=time) continue;
            const exit=sameCell(bomb,portal.a)?portal.b:sameCell(bomb,portal.b)?portal.a:undefined;
            if (exit && free(exit.x,exit.y,bomb)) {
              bomb.x=exit.x; bomb.y=exit.y; bomb.portalCooldown=time+GAMEPLAY.portalCooldown;
              portalLocks.set(bomb.id,cellKey(exit.x,exit.y)); break;
            }
          }
        }
      }
    }
    const queue: Bomb[]=[];
    for (const bomb of live.values()) {
      if (bomb.detonateAt<=time+.001 || (danger.hazards.get(cellKey(bomb.x,bomb.y))??[]).some(hazard=>hazard.source!=='closing' && hazard.start<=time && hazard.end>time)) queue.push(bomb);
    }
    for (let index=0;index<queue.length;index++) {
      const bomb=queue[index]!;
      if (!live.delete(bomb.id)) continue;
      const cells=blastTiles(state,bomb,bomb.range,terrain);
      danger.explosions.set(bomb.id,{at:time,point:{x:bomb.x,y:bomb.y},tiles:cells});
      for (const point of cells) {
        addHazard(danger,point,{start:time,end:time+GAMEPLAY.flameDuration,source:'bomb',owner:bomb.owner});
        if (terrain[point.y]![point.x]==='block') terrain[point.y]![point.x]='floor';
        for (const other of live.values()) if (sameCell(other,point)) queue.push(other);
      }
    }
  }
  for (const bomb of remoteThreats) for (const point of blastTiles(state,bomb,bomb.range)) addHazard(danger,point,{start:state.time+.22,end:Math.min(danger.until,bomb.detonateAt+.45),source:'bomb',owner:bomb.owner,remotePotential:true});
  for (const intervals of danger.hazards.values()) intervals.sort((a,b)=>a.start-b.start);
  return danger;
}

export function isSafe(danger: DangerMap, point: Point, start: number, end=start, margin=.09, invincibleUntil=0): boolean {
  return !(danger.hazards.get(cellKey(point.x,point.y))??[]).some(hazard => {
    const vulnerableStart=hazard.source==='closing'?start:Math.max(start,invincibleUntil);
    return vulnerableStart<=end && hazard.start-margin<=end && hazard.end+margin>=vulnerableStart;
  });
}

export function bombBlocks(danger: DangerMap, point: Point, start: number, end: number, ignoredId?: number): boolean {
  return (danger.occupancy.get(cellKey(point.x,point.y))??[]).some(interval=>interval.bombId!==ignoredId && interval.start-.04<=end && interval.end+.04>=start);
}

/** A remote owner knows it will not press E before reaching safety. Other
 * players must allow for that unknown button press. Actual fuse/chain hazards
 * remain dangerous to everybody, including the owner. */
export function dangerForPlayer(danger:DangerMap,playerId:number):DangerMap {
  let changed=false;
  const hazards=new Map<string,HazardInterval[]>();
  for (const [key,intervals] of danger.hazards) {
    const filtered=intervals.filter(interval=>!interval.remotePotential || interval.owner!==playerId);
    if (filtered.length!==intervals.length) changed=true;
    hazards.set(key,filtered);
  }
  return changed?{...danger,hazards}:danger;
}

const cache=new WeakMap<MatchState,{tick:number;time:number;danger:DangerMap}>();
/** Controllers deciding on the same simulation tick share the expensive forecast. */
export function sharedDangerMap(state: MatchState): DangerMap {
  const existing=cache.get(state);
  if (existing && existing.tick===state.tick && existing.time===state.time) return existing.danger;
  const danger=buildDangerMap(state);
  cache.set(state,{tick:state.tick,time:state.time,danger});
  return danger;
}
