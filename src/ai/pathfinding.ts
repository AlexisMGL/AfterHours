import { GAMEPLAY } from '../core/tuning';
import { hasPortalEscape } from '../core/portals';
import { cellKey, DIRECTIONS, sameCell, type Direction, type MatchState, type Player, type Point } from '../core/types';
import { bombBlocks, isSafe, type DangerMap } from './hazard';

export interface Transition { point: Point; entry: Point; move: Direction; portalUntil?: number }
export interface RouteStep extends Point { at: number; move?: Direction; entry?: Point }
export interface EscapeOptions { start?: Point; startTime?: number; until?: number; maxTime?: number; ignoreBombId?: number; allowWait?: boolean }
export const manhattan = (a:Point,b:Point):number => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

export function walkable(state: MatchState, point: Point, avoidBombs=true): boolean {
  return state.arena.tiles[point.y]?.[point.x]==='floor' && (!avoidBombs || !state.bombs.some(bomb=>sameCell(bomb,point)));
}

/** Entering a gate is one movement edge; its exit is the edge destination. */
export function neighbors(state: MatchState, point: Point, avoidBombs=true, allowPortals=true): Transition[] {
  const result:Transition[]=[];
  for (const [move,delta] of Object.entries(DIRECTIONS) as [Direction,Point][]) {
    const entry={x:point.x+delta.x,y:point.y+delta.y};
    if (!walkable(state,entry,avoidBombs)) continue;
    let destination=entry;
    let portalUntil:number|undefined;
    if (allowPortals) for (const gate of state.portals) {
      if (gate.until<=state.time) continue;
      const exit=sameCell(entry,gate.a)?gate.b:sameCell(entry,gate.b)?gate.a:undefined;
      if (exit && walkable(state,exit,avoidBombs) && !state.players.some(player=>player.alive && sameCell(player,exit))
        && hasPortalEscape(state.arena,exit,neighbor=>walkable(state,neighbor,avoidBombs) && !state.players.some(player=>player.alive && sameCell(player,neighbor)))) {
        destination={...exit}; portalUntil=gate.until; break;
      }
    }
    result.push({point:destination,entry,move,portalUntil});
  }
  return result;
}

/** Breadth-first paths include both portal mouths, so a caller can steer to
 * the entrance without interpreting a distant exit as a movement direction. */
export function findPath(state: MatchState, start: Point, goal: Point, allowPortals=true): Point[] | null {
  const origin={x:Math.round(start.x),y:Math.round(start.y)};
  const queue:Point[]=[origin];
  const visited=new Set([cellKey(origin.x,origin.y)]);
  const parents=new Map<string,{previous:Point;transition:Transition}>();
  for (let cursor=0;cursor<queue.length;cursor++) {
    const point=queue[cursor]!;
    if (sameCell(point,goal)) {
      const segments:Point[][]=[];
      let current=point;
      while (!sameCell(current,origin)) {
        const parent=parents.get(cellKey(current.x,current.y))!;
        segments.push(sameCell(parent.transition.entry,parent.transition.point)?[parent.transition.point]:[parent.transition.entry,parent.transition.point]);
        current=parent.previous;
      }
      return [origin,...segments.reverse().flat()];
    }
    for (const transition of neighbors(state,point,true,allowPortals)) {
      const key=cellKey(transition.point.x,transition.point.y);
      if (visited.has(key)) continue;
      visited.add(key); parents.set(key,{previous:point,transition}); queue.push(transition.point);
    }
  }
  return null;
}

export function movementTime(state: MatchState, player: Player, point: Point, direction: Direction):number {
  const belt=state.arena.conveyors.find(tile=>sameCell(tile,point));
  let speed=player.speed;
  if (belt) {
    const intended=DIRECTIONS[direction],flow=DIRECTIONS[belt.direction];
    speed+=(intended.x*flow.x+intended.y*flow.y)*GAMEPLAY.conveyorSpeed;
  }
  return 1/Math.max(1,speed);
}

/** Time-expanded flood fill proves an escape through every intermediate tile.
 * Waiting is a real edge, so the search can cross a corridor after flames end.
 * Current bombs may be left, but never re-entered while they still occupy it. */
export function findSafeRoute(state: MatchState, player: Player, danger: DangerMap, options: EscapeOptions={}): RouteStep[] | null {
  const start={x:Math.round(options.start?.x??player.x),y:Math.round(options.start?.y??player.y)};
  const startTime=options.startTime??state.time;
  const until=options.until??Math.min(danger.until,state.time+3.2);
  const maxTime=options.maxTime??Math.min(danger.until,state.time+4);
  const queue:RouteStep[]=[{...start,at:startTime}];
  const parents:number[]=[-1];
  const seen=new Set<string>();
  const timeBucket=.14;
  const key=(point:Point,time:number):string=>`${cellKey(point.x,point.y)}:${Math.floor((time-startTime)/timeBucket)}`;
  seen.add(key(start,startTime));
  const startingBomb=options.ignoreBombId??state.bombs.find(bomb=>sameCell(bomb,start) && bomb.passThrough.includes(player.id))?.id;
  for (let cursor=0;cursor<queue.length && cursor<4500;cursor++) {
    const current=queue[cursor]!;
    const holdUntil=Math.max(until,current.at+.65);
    if (isSafe(danger,current,current.at,holdUntil,.13,player.invincibleUntil)) {
      const route:RouteStep[]=[];
      let index=cursor;
      while (index>=0) { route.push(queue[index]!); index=parents[index]!; }
      return route.reverse();
    }
    const transitions=neighbors(state,current,false,true);
    const choices: {transition?:Transition;point:Point;duration:number}[]=transitions.map(transition=>({transition,point:transition.point,duration:movementTime(state,player,current,transition.move)}));
    if (options.allowWait!==false) choices.push({point:current,duration:timeBucket});
    for (const choice of choices) {
      const arrival=current.at+choice.duration;
      if (arrival>maxTime) continue;
      const entry=choice.transition?.entry??current;
      if (choice.transition?.portalUntil!==undefined && choice.transition.portalUntil<=arrival) choice.point=entry;
      // The character sweeps across both source and entry during a movement.
      if (!isSafe(danger,current,current.at,arrival,.07,player.invincibleUntil) || !isSafe(danger,entry,current.at,arrival,.1,player.invincibleUntil) || !isSafe(danger,choice.point,arrival,arrival+.08,.1,player.invincibleUntil)) continue;
      const mayStandOnOwn=cursor===0 || (sameCell(current,start) && !choice.transition);
      if (bombBlocks(danger,entry,current.at,arrival,mayStandOnOwn && !choice.transition?startingBomb:undefined)) continue;
      if (!sameCell(entry,choice.point) && bombBlocks(danger,choice.point,arrival-.05,arrival+.15)) continue;
      const visitKey=key(choice.point,arrival);
      if (seen.has(visitKey)) continue;
      seen.add(visitKey);
      queue.push({...choice.point,at:arrival,move:choice.transition?.move,entry:choice.transition?.entry});
      parents.push(cursor);
    }
  }
  return null;
}

/** Every currently reachable cell, with its first cardinal command and distance. */
export function reachableTiles(state: MatchState, start: Point): {point:Point;distance:number;first?:Transition}[] {
  const origin={x:Math.round(start.x),y:Math.round(start.y)};
  const queue:{point:Point;distance:number;first?:Transition}[]=[{point:origin,distance:0}];
  const seen=new Set([cellKey(origin.x,origin.y)]);
  for (let cursor=0;cursor<queue.length;cursor++) {
    const current=queue[cursor]!;
    for (const transition of neighbors(state,current.point)) {
      const key=cellKey(transition.point.x,transition.point.y);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({point:transition.point,distance:current.distance+1,first:current.first??transition});
    }
  }
  return queue;
}
