import { Random } from '../core/random';
import { GAMEPLAY } from '../core/tuning';
import { cellKey, DIRECTIONS, sameCell, type Action, type Bomb, type Controller, type Difficulty, type Direction, type MatchState, type Player, type Point, type PowerUp } from '../core/types';
import { blastTiles, buildDangerMap, dangerForPlayer, isSafe, sharedDangerMap, type DangerMap } from './hazard';
import { findSafeRoute, manhattan, movementTime, neighbors, reachableTiles, type RouteStep, type Transition } from './pathfinding';

export const AI_PROFILES = {
  easy: { reaction:.46, bombInterval:3.1, blockValue:1, pickupValue:2.2, attackValue:2, foresight:1.5, mistakeChance:.18 },
  normal: { reaction:.22, bombInterval:1.15, blockValue:1.3, pickupValue:3, attackValue:3.7, foresight:2.7, mistakeChance:0 },
  hard: { reaction:.13, bombInterval:.65, blockValue:1.1, pickupValue:4, attackValue:5, foresight:3.5, mistakeChance:0 },
  expert: { reaction:.085, bombInterval:.42, blockValue:.95, pickupValue:4.1, attackValue:6.2, foresight:4.2, mistakeChance:0 },
} as const;

const center = (point:Point):Point=>({x:Math.round(point.x),y:Math.round(point.y)});
const centered = (point:Point,tolerance=.14):boolean => Math.abs(point.x-Math.round(point.x))<tolerance && Math.abs(point.y-Math.round(point.y))<tolerance;

/** Values depend on upgrades the bot actually owns. The AI never inspects the
 * hidden power-up table, never modifies simulation state and uses the same
 * move/bomb/ability commands as a local human controller. */
export function powerUpValue(type:PowerUp,player:Player):number {
  switch (type) {
    case 'bomb':return player.capacity>=GAMEPLAY.maxBombs?.15:player.capacity===1?2:1.05;
    case 'fire':return player.range>=GAMEPLAY.maxRange?.15:player.range<=3?1.7:1;
    case 'speed':return player.speed>=GAMEPLAY.maxSpeed?.15:1.65;
    case 'push':return player.push?.35:1.8;
    case 'kick':return player.kick?.25:player.push?1.5:.95;
    case 'shield':return player.shield?.4:2.1;
    case 'invincible':return 1.8;
    case 'remote':return 1.2;
    case 'rapid':return .9;
    case 'portal':return player.portalCharges>0?.6:1.25;
  }
}

/** Scores only visible information: breakable tiles, opponents and exits. */
export function bombPlacementScore(state:MatchState,player:Player,point:Point,difficulty:Difficulty):number {
  const profile=AI_PROFILES[difficulty];
  const blast=blastTiles(state,point,player.range);
  let score=0;
  for (const tile of blast) {
    if (state.arena.tiles[tile.y]![tile.x]==='block') score+=profile.blockValue;
    if (state.pickups.some(pickup=>sameCell(pickup,tile))) score-=1.4;
    for (const enemy of state.players) {
      if (!enemy.alive || enemy.id===player.id || enemy.invincibleUntil>state.time+1.3 || !sameCell(enemy,tile)) continue;
      score+=profile.attackValue;
      if (difficulty==='expert') {
        const exits=neighbors(state,center(enemy)).filter(exit=>!blast.some(danger=>sameCell(exit.point,danger))).length;
        score+=Math.max(0,3-exits)*1.3;
      }
    }
  }
  return score;
}

export class AIController implements Controller {
  readonly difficulty:Difficulty;
  private readonly seed:number;
  private random:Random;
  private nextThink=0;
  private lastBomb=-Infinity;
  private lastAbility=-Infinity;
  private waypoint?:Point;
  private direction?:Direction;
  private previousCell='';
  private sameCellSince=0;
  private visits=new Map<string,number>();
  private lastStateTime=-1;

  constructor(difficulty:Difficulty,seed=1) { this.difficulty=difficulty; this.seed=seed; this.random=new Random(seed); }

  reset():void {
    this.random=new Random(this.seed); this.nextThink=0; this.lastBomb=-Infinity; this.lastAbility=-Infinity;
    this.waypoint=undefined; this.direction=undefined; this.previousCell=''; this.sameCellSince=0;
    this.visits.clear(); this.lastStateTime=-1;
  }

  getAction(state:MatchState,playerId:number):Action {
    const player=state.players.find(participant=>participant.id===playerId);
    if (!player?.alive || state.status!=='playing') return {};
    if (state.time<this.lastStateTime) this.reset();
    this.lastStateTime=state.time;
    const key=cellKey(player.x,player.y);
    if (key!==this.previousCell) {
      this.previousCell=key; this.sameCellSince=state.time;
      this.visits.set(key,(this.visits.get(key)??0)+1);
    }
    const continuing=this.continueMove(state,player);
    if (state.time<this.nextThink) return continuing;
    const profile=AI_PROFILES[this.difficulty];
    this.nextThink=state.time+profile.reaction*(.92+this.random.next()*.16);
    const danger=dangerForPlayer(sharedDangerMap(state),player.id);
    const immediateThreat=!isSafe(danger,player,state.time,state.time+profile.foresight,.12,player.invincibleUntil);
    const blocked=state.time-this.sameCellSince>1.15;
    // Finish a cardinal tile before turning; otherwise rounding a half-crossed
    // cell repeatedly sends bots into the corner of the adjacent pillar.
    if (continuing.move && !blocked && isSafe(danger,this.waypoint!,state.time,state.time+.6,.13,player.invincibleUntil) && !immediateThreat) return continuing;
    if (immediateThreat) {
      const route=findSafeRoute(state,player,danger,{until:state.time+Math.max(3.2,profile.foresight)});
      if (route && route.length>1) return this.followRoute(player,route);
      if (route?.length===1) { this.clearMove(); return this.remoteAction(state,player,danger)??{}; }
      const push=this.tryPush(state,player,danger,true);
      if (push) return push;
      // When a fuse is already too short for a complete tile, retain the best
      // exit rather than freezing. Shield/invincibility still obey engine rules.
      const exits=neighbors(state,center(player)).filter(exit=>isSafe(danger,exit.point,state.time+.15,state.time+.8,.04,player.invincibleUntil));
      if (exits.length) return this.followTransition(player,exits[0]!);
      return continuing;
    }
    const remote=this.remoteAction(state,player,danger);
    if (remote) return remote;
    const portal=this.portalAction(state,player);
    if (portal) return portal;
    if (centered(player) && state.time-this.lastBomb>=profile.bombInterval && player.capacity>state.bombs.filter(bomb=>bomb.owner===player.id).length && !state.bombs.some(bomb=>sameCell(bomb,player))) {
      const score=bombPlacementScore(state,player,center(player),this.difficulty);
      const threshold=this.difficulty==='easy'?1.4:.7;
      if (score>=threshold && !(this.difficulty==='easy' && this.random.next()<.55)) {
        const bomb=this.virtualBomb(state,player);
        const withBomb=buildDangerMap(state,bomb);
        const escape=findSafeRoute(state,player,withBomb,{ignoreBombId:bomb.id,until:bomb.detonateAt+GAMEPLAY.flameDuration+.25,maxTime:bomb.detonateAt-.16,allowWait:false});
        if (escape && escape.length>1) {
          this.lastBomb=state.time;
          const action=this.followRoute(player,escape);
          action.bomb=true;
          return action;
        }
      }
    }
    const push=this.tryPush(state,player,danger,false);
    if (push) return push;
    if (continuing.move && !blocked) return continuing;
    this.clearMove();
    const targets=reachableTiles(state,player);
    let best:typeof targets[number]|undefined;
    let bestScore=-Infinity;
    const enemies=state.players.filter(enemy=>enemy.alive && enemy.id!==player.id);
    for (const candidate of targets) {
      if (!candidate.first || candidate.distance===0) continue;
      const eta=state.time+candidate.distance/player.speed;
      if (state.players.some(other=>other.alive && other.id!==player.id && sameCell(other,candidate.first!.entry))) continue;
      if (!isSafe(danger,candidate.first.entry,state.time,state.time+.48,.13,player.invincibleUntil) || !isSafe(danger,candidate.first.point,state.time+.2,state.time+.6,.1,player.invincibleUntil)) continue;
      if (!isSafe(danger,candidate.point,Math.min(eta,danger.until-.1),Math.min(eta+.45,danger.until),.08,player.invincibleUntil)) continue;
      let value=0;
      const pickup=state.pickups.find(item=>sameCell(item,candidate.point));
      if (pickup) value+=profile.pickupValue*powerUpValue(pickup.type,player);
      value+=bombPlacementScore(state,player,candidate.point,this.difficulty)*.9;
      const enemyDistance=Math.min(...enemies.map(enemy=>manhattan(enemy,candidate.point)),20);
      value+=Math.max(0,14-enemyDistance)*.045;
      if (this.difficulty==='expert') {
        const exits=neighbors(state,candidate.point).length;
        value+=Math.min(3,exits)*.12;
        // Prefer a second way out when attacking an opponent's corridor.
        if (exits===1 && enemyDistance<5) value-=.8;
      }
      value=value/(1+candidate.distance*.2)-candidate.distance*.045;
      value-=Math.min(5,this.visits.get(cellKey(candidate.point.x,candidate.point.y))??0)*.075;
      value+=this.random.next()*.055;
      if (this.difficulty==='easy' && this.random.next()<profile.mistakeChance) value-=.75;
      if (value>bestScore) {bestScore=value;best=candidate;}
    }
    if (best?.first) return this.followTransition(player,best.first);
    return {};
  }

  private virtualBomb(state:MatchState,player:Player):Bomb {
    return {...center(player),id:-1000-player.id,owner:player.id,range:player.range,detonateAt:state.time+(player.rapidUntil>state.time?GAMEPLAY.rapidFuse:GAMEPLAY.bombFuse),remote:false,slideSpeed:0,slideRemaining:0,portalCooldown:0,passThrough:[player.id]};
  }

  private remoteAction(state:MatchState,player:Player,danger:DangerMap):Action|undefined {
    if (player.remoteUntil<=state.time || player.portalCharges>0 || state.time-this.lastAbility<.5) return undefined;
    const owned=state.bombs.filter(bomb=>bomb.owner===player.id && bomb.remote);
    if (!owned.length) return undefined;
    let useful=false;
    for (const bomb of owned) {
      const blast=blastTiles(state,bomb,bomb.range);
      if (blast.some(point=>sameCell(point,player)) && player.invincibleUntil<state.time+.6) return undefined;
      if (blast.some(point=>state.arena.tiles[point.y]![point.x]==='block' || state.players.some(enemy=>enemy.alive && enemy.id!==player.id && sameCell(enemy,point)))) useful=true;
    }
    if (!useful || !isSafe(danger,player,state.time,state.time+.2,.03,player.invincibleUntil)) return undefined;
    this.lastAbility=state.time; return {...this.continueMove(state,player),ability:true};
  }

  private portalAction(state:MatchState,player:Player):Action|undefined {
    // Ability precedence is shared with the human: charged portals consume E
    // before remote detonation. Place entrances on safe junctions and complete
    // the pair only after reaching a genuinely different part of the arena.
    if ((this.difficulty!=='hard' && this.difficulty!=='expert') || player.portalCharges<=0 || state.time-this.lastAbility<1.2 || !centered(player)) return undefined;
    if (state.bombs.some(bomb=>sameCell(bomb,player)) || state.portals.some(gate=>sameCell(gate.a,player)||sameCell(gate.b,player))) return undefined;
    if (player.portalAnchor ? manhattan(player,player.portalAnchor)<5 : neighbors(state,center(player)).length<2) return undefined;
    this.lastAbility=state.time;
    return {...this.continueMove(state,player),ability:true};
  }

  private tryPush(state:MatchState,player:Player,danger:DangerMap,defensive:boolean):Action|undefined {
    if (!player.push || (this.difficulty!=='hard' && this.difficulty!=='expert') || !centered(player,.24)) return undefined;
    for (const [direction,delta] of Object.entries(DIRECTIONS) as [Direction,Point][]) {
      const adjacent={x:Math.round(player.x)+delta.x,y:Math.round(player.y)+delta.y};
      const bomb=state.bombs.find(item=>sameCell(item,adjacent) && !item.direction);
      if (!bomb || bomb.detonateAt-state.time<.55) continue;
      const beyond={x:adjacent.x+delta.x,y:adjacent.y+delta.y};
      if (state.arena.tiles[beyond.y]?.[beyond.x]!=='floor' || state.bombs.some(item=>item.id!==bomb.id && sameCell(item,beyond))) continue;
      const offensive=state.players.some(enemy=>enemy.alive && enemy.id!==player.id && ((delta.x!==0 && Math.abs(enemy.y-adjacent.y)<.6 && (enemy.x-adjacent.x)*delta.x>1) || (delta.y!==0 && Math.abs(enemy.x-adjacent.x)<.6 && (enemy.y-adjacent.y)*delta.y>1)));
      if (!defensive && !offensive) continue;
      const moved={...bomb,x:adjacent.x+delta.x*.7,y:adjacent.y+delta.y*.7,direction,slideSpeed:player.kick?GAMEPLAY.kickSpeed:GAMEPLAY.pushSpeed,slideRemaining:player.kick?state.arena.width+state.arena.height-.7:.3};
      const future={...state,bombs:state.bombs.map(item=>item.id===bomb.id?moved:item)};
      const forecast=dangerForPlayer(buildDangerMap(future),player.id);
      const eta=state.time+movementTime(state,player,player,direction);
      if (!isSafe(forecast,adjacent,state.time,eta+.2,.1,player.invincibleUntil) || !isSafe(danger,player,state.time,state.time+.2,.03,player.invincibleUntil)) continue;
      if (!findSafeRoute(future,player,forecast,{start:adjacent,startTime:eta,until:state.time+3.2})) continue;
      this.waypoint=adjacent; this.direction=direction;
      return {move:direction};
    }
    return undefined;
  }

  private followRoute(player:Player,route:RouteStep[]):Action {
    const next=route[1];
    if (!next?.move) {this.clearMove();return {};}
    return this.followTransition(player,{point:next,entry:next.entry??next,move:next.move});
  }

  private followTransition(player:Player,transition:Transition):Action {
    this.waypoint={...transition.entry}; this.direction=transition.move;
    // Correct small lateral offsets before starting a perpendicular corridor.
    const horizontal=transition.move==='left'||transition.move==='right';
    if (horizontal && Math.abs(player.y-Math.round(player.y))>.12) return {move:player.y<Math.round(player.y)?'down':'up'};
    if (!horizontal && Math.abs(player.x-Math.round(player.x))>.12) return {move:player.x<Math.round(player.x)?'right':'left'};
    return {move:transition.move};
  }

  private continueMove(state:MatchState,player:Player):Action {
    if (!this.waypoint || !this.direction) return {};
    const delta=DIRECTIONS[this.direction];
    const distance=(this.waypoint.x-player.x)*delta.x+(this.waypoint.y-player.y)*delta.y;
    const perpendicular=Math.abs(delta.x?this.waypoint.y-player.y:this.waypoint.x-player.x);
    if (distance<.045 || distance>1.6 || perpendicular>.4 || state.arena.tiles[this.waypoint.y]?.[this.waypoint.x]!=='floor') {this.clearMove();return {};}
    return {move:this.direction};
  }

  private clearMove():void {this.waypoint=undefined;this.direction=undefined;}
}
