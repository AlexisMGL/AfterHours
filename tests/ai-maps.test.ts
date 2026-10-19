import { describe, expect, it } from 'vitest';
import { AIController, AI_PROFILES, bombPlacementScore, powerUpValue } from '../src/ai/controller';
import { blastTiles, buildDangerMap, dangerForPlayer, isSafe } from '../src/ai/hazard';
import { findPath, findSafeRoute, reachableTiles } from '../src/ai/pathfinding';
import { Match } from '../src/core/engine';
import { cellKey, type Action, type Bomb, type Difficulty, type MapId, type Point } from '../src/core/types';
import { createArena, MAPS, validateArena } from '../src/maps/maps';

const ids:MapId[]=['mall','airport','jungle','factory','boat'];
function openMatch():Match {
  const match=new Match({mapId:'mall',seed:7,opponents:1,difficulties:['expert']});
  for (let y=1;y<14;y++) for (let x=1;x<14;x++) match.state.arena.tiles[y]![x]='floor';
  match.state.arena.hidden={};match.state.arena.conveyors=[];
  match.state.arena.vents=[];match.state.portals=[];
  return match;
}
function bomb(id:number,point:Point,detonateAt=2.5,range=2):Bomb {
  return {...point,id,owner:0,range,detonateAt,remote:false,slideSpeed:0,slideRemaining:0,portalCooldown:0,passThrough:[0]};
}

describe('fair seeded arenas',()=>{
  it.each(ids)('%s loads many reproducible, symmetric, valid variants',id=>{
    for (let seed=0;seed<30;seed++) {
      const arena=createArena(id,seed);
      expect(validateArena(arena),`${id}, seed ${seed}`).toEqual({valid:true,errors:[]});
      expect(createArena(id,seed)).toEqual(arena);
      expect(arena.spawns).toHaveLength(4);
    }
    expect(createArena(id,12).tiles).not.toEqual(createArena(id,42).tiles);
  });

  it('gives every spawn a proven timed escape from its first bomb',()=>{
    for (const id of ids) for (let seed=0;seed<5;seed++) {
      const match=new Match({mapId:id,seed,opponents:3,difficulties:['expert','expert','expert']});
      for (const player of match.state.players) {
        const planted=bomb(-100-player.id,player);
        planted.owner=player.id;planted.passThrough=[player.id];
        const danger=buildDangerMap(match.state,planted);
        const escape=findSafeRoute(match.state,player,danger,{ignoreBombId:planted.id,until:3.1,maxTime:2.2,allowWait:false});
        expect(escape,`${id}, seed ${seed}, player ${player.id}`).not.toBeNull();
        expect(escape!.length).toBeGreaterThan(1);
        expect(isSafe(danger,escape!.at(-1)!,escape!.at(-1)!.at,3.1)).toBe(true);
      }
    }
  });

  it('validates separation, perimeter, walkability, structural access and hidden upgrades',()=>{
    const arena=createArena('mall',1);
    arena.tiles[0]![1]='floor';
    arena.tiles[1]![1]='wall';
    arena.hidden['1,1']='fire';
    const validation=validateArena(arena);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(error=>error.includes('perimeter'))).toBe(true);
    expect(validation.errors.some(error=>error.includes('spawn'))).toBe(true);
    expect(validation.errors.some(error=>error.includes('Upgrade'))).toBe(true);
  });

  it('weights common upgrades above rare abilities and preserves corner fairness',()=>{
    const counts:Record<string,number>={};
    for (let seed=0;seed<100;seed++) for (const type of Object.values(createArena('mall',seed).hidden)) counts[type]=(counts[type]??0)+1;
    expect(counts.bomb!+counts.fire!+counts.speed!).toBeGreaterThan((counts.remote!+counts.invincible!+counts.portal!)*5);
    expect(Object.keys(counts)).toHaveLength(10);
  });

  it('provides distinct mechanics on all five environments',()=>{
    expect(MAPS.map(map=>map.id)).toEqual(ids);
    expect(createArena('mall',1).conveyors.length).toBeGreaterThan(0);
    expect(createArena('airport',1).conveyors.length).toBeGreaterThan(createArena('mall',1).conveyors.length);
    expect(createArena('jungle',1).vegetation.length).toBeGreaterThan(0);
    expect(createArena('factory',1).vents).toHaveLength(4);
    for (const id of ['jungle','factory','boat'] as MapId[]) expect(createArena(id,1).portals).toHaveLength(2);
  });
  it('keeps a walking exit at every generated portal across seeds',()=>{
    for (const id of ['jungle','factory','boat'] as MapId[]) for (let seed=0;seed<100;seed++) {
      const arena=createArena(id,seed);
      for (const gate of arena.portals) for (const end of [gate.a,gate.b]) {
        const exits=[[end.x-1,end.y],[end.x+1,end.y],[end.x,end.y-1],[end.x,end.y+1]];
        expect(exits.some(([x,y])=>arena.tiles[y]![x]==='floor'),`${id}, seed ${seed}, mouth ${end.x},${end.y}`).toBe(true);
      }
    }
  });
  it('rejects an arena with an isolated portal mouth',()=>{
    const arena=createArena('jungle',1);
    const end=arena.portals[0]!.a;
    for (const [x,y] of [[end.x-1,end.y],[end.x+1,end.y],[end.x,end.y-1],[end.x,end.y+1]]) arena.tiles[y]![x]='block';
    expect(validateArena(arena).errors).toContain('Portal endpoint has no walking exit.');
  });
});

describe('navigation and time-aware tactical hazards',()=>{
  it('finds a shortest path around solid geometry and rejects disconnected destinations',()=>{
    const {state}=openMatch();
    state.arena.tiles[1]![2]='wall';
    const path=findPath(state,{x:1,y:1},{x:3,y:1});
    expect(path).toHaveLength(5);
    expect(path).not.toContainEqual({x:2,y:1});
    state.arena.tiles[2]![1]='block';
    expect(findPath(state,{x:1,y:1},{x:3,y:1})).toBeNull();
  });

  it('routes through linked portal entrances, not through walls',()=>{
    const {state}=openMatch();
    state.portals=[{id:1,a:{x:2,y:1},b:{x:11,y:11},until:100}];
    const path=findPath(state,{x:1,y:1},{x:12,y:11});
    expect(path).toEqual([{x:1,y:1},{x:2,y:1},{x:11,y:11},{x:12,y:11}]);
    expect(reachableTiles(state,{x:1,y:1}).find(item=>item.point.x===12 && item.point.y===11)?.distance).toBe(2);
  });
  it('does not plan a teleport into an isolated pocket and uses it once opened',()=>{
    const {state}=openMatch();
    state.portals=[{id:1,a:{x:2,y:1},b:{x:11,y:11},until:100}];
    for (const [x,y] of [[10,11],[12,11],[11,10],[11,12]]) state.arena.tiles[y]![x]='block';
    expect(findPath(state,{x:1,y:1},{x:11,y:11})).toBeNull();
    state.arena.tiles[11]![12]='floor';
    expect(findPath(state,{x:1,y:1},{x:12,y:11})).toEqual([{x:1,y:1},{x:2,y:1},{x:11,y:11},{x:12,y:11}]);
  });

  it('stops predicted rays on a destructible block and a solid wall',()=>{
    const {state}=openMatch();
    state.arena.tiles[3]![4]='block';state.arena.tiles[2]![3]='wall';
    const blast=blastTiles(state,{x:3,y:3},5);
    expect(blast).toContainEqual({x:4,y:3});
    expect(blast).not.toContainEqual({x:5,y:3});
    expect(blast).not.toContainEqual({x:3,y:2});
  });

  it('predicts a chain reaction before the second bomb original fuse',()=>{
    const {state}=openMatch();
    state.bombs=[bomb(1,{x:3,y:3},.6,3),bomb(2,{x:5,y:3},2.5,2)];
    const danger=buildDangerMap(state);
    expect(danger.explosions.get(1)!.at).toBeCloseTo(.6,1);
    expect(danger.explosions.get(2)!.at).toBeCloseTo(.6,1);
    expect(isSafe(danger,{x:5,y:5},.65,.8)).toBe(false);
    expect(isSafe(danger,{x:5,y:5},1.3,1.5)).toBe(true);
  });

  it('predicts moving bomb destinations and portal transit without mutating them',()=>{
    const {state}=openMatch();
    state.portals=[{id:1,a:{x:5,y:3},b:{x:9,y:9},until:100}];
    state.bombs=[{...bomb(1,{x:3,y:3},1.3),direction:'right',slideSpeed:4,slideRemaining:3}];
    const original=structuredClone(state.bombs);
    const danger=buildDangerMap(state);
    const predicted=danger.explosions.get(1)!;
    expect(predicted.point.x).toBeGreaterThanOrEqual(9);
    expect(predicted.point.y).toBe(9);
    expect(state.bombs).toEqual(original);
    expect(danger.occupancy.has('4,3')).toBe(true);
  });

  it('identifies a safe bent escape and refuses an enclosed suicidal bomb',()=>{
    const match=new Match({mapId:'mall',seed:4,opponents:1,difficulties:['expert']});
    const player=match.state.players[0]!;
    const planted=bomb(10,player);
    expect(findSafeRoute(match.state,player,buildDangerMap(match.state,planted),{ignoreBombId:10})).not.toBeNull();
    match.state.arena.tiles[2]![1]='block';
    match.state.arena.tiles[1]![2]='block';
    expect(findSafeRoute(match.state,player,buildDangerMap(match.state,planted),{ignoreBombId:10})).toBeNull();
    const ai=new AIController('expert');
    expect(ai.getAction(match.state,0).bomb).not.toBe(true);
  });

  it('models active flames, telegraphed steam and closing walls by time',()=>{
    const {state}=openMatch();
    state.time=6;state.arena.vents=[{x:4,y:4}];
    state.flames=[{x:3,y:3,until:6.4,owner:1}];
    state.closingTiles=[{x:1,y:2}];state.closingAt=8;
    const danger=buildDangerMap(state);
    expect(isSafe(danger,{x:3,y:3},6,6.2)).toBe(false);
    expect(isSafe(danger,{x:3,y:3},6.6,6.7)).toBe(true);
    expect(isSafe(danger,{x:4,y:4},6,6.5)).toBe(true);
    expect(isSafe(danger,{x:4,y:4},7.1,7.5)).toBe(false);
    expect(isSafe(danger,{x:1,y:2},8.1,9)).toBe(false);
  });

  it('distinguishes an enemy remote trigger from the owner waiting to escape',()=>{
    const {state}=openMatch();
    state.bombs=[{...bomb(1,{x:1,y:1},8),remote:true}];
    const forecast=buildDangerMap(state);
    expect(isSafe(dangerForPlayer(forecast,1),{x:2,y:1},.3,1)).toBe(false);
    expect(isSafe(dangerForPlayer(forecast,0),{x:2,y:1},.3,1)).toBe(true);
    state.bombs[0]!.detonateAt=.7;
    expect(isSafe(dangerForPlayer(buildDangerMap(state),0),{x:2,y:1},.8,1)).toBe(false);
  });

  it('has genuinely different difficulty profiles and values useful upgrades',()=>{
    const {state}=openMatch();
    const player=state.players[0]!;
    expect(AI_PROFILES.easy.reaction).toBeGreaterThan(AI_PROFILES.normal.reaction);
    expect(AI_PROFILES.normal.reaction).toBeGreaterThan(AI_PROFILES.hard.reaction);
    expect(AI_PROFILES.hard.reaction).toBeGreaterThan(AI_PROFILES.expert.reaction);
    state.players[1]!.x=3;state.players[1]!.y=1;
    expect(bombPlacementScore(state,player,player,'expert')).toBeGreaterThan(bombPlacementScore(state,player,player,'normal'));
    expect(powerUpValue('bomb',player)).toBeGreaterThan(powerUpValue('remote',player));
    player.capacity=6;
    expect(powerUpValue('bomb',player)).toBeLessThan(powerUpValue('remote',player));
  });
});

function runBots(mapId:MapId,seed:number,difficulties:Difficulty[],seconds=60):{state:Match['state'];positions:Set<string>[];digest:string} {
  const match=new Match({mapId,seed,opponents:3,difficulties:difficulties.slice(1),suddenDeathAt:18});
  const controllers=match.state.players.map((player,index)=>new AIController(difficulties[index]!,seed+player.id*907));
  const positions=controllers.map(()=>new Set<string>());
  for (let tick=0;tick<seconds*20 && match.state.status==='playing';tick++) {
    const actions:Record<number,Action>={};
    for (const player of match.state.players) {actions[player.id]=controllers[player.id]!.getAction(match.state,player.id);positions[player.id]!.add(cellKey(player.x,player.y));}
    match.step(actions,1/20);
    for (const player of match.state.players) {
      expect(Number.isFinite(player.x)&&Number.isFinite(player.y)).toBe(true);
      expect(player.x).toBeGreaterThanOrEqual(0);expect(player.x).toBeLessThan(15);
    }
  }
  const {state}=match;
  const digest=JSON.stringify({time:state.time,winner:state.winner,players:state.players,bombs:state.bombs,tiles:state.arena.tiles});
  return {state,positions,digest};
}

describe('deterministic AI-only integration soak',()=>{
  it('finishes varied seeded matches on all five maps with active, unstuck bots',()=>{
    for (const id of ids) for (const seed of [3,29,173]) {
      const result=runBots(id,seed,['easy','normal','hard','expert']);
      expect(result.state.status,`${id}, seed ${seed}`).toBe('finished');
      expect(result.state.players.reduce((sum,player)=>sum+player.stats.bombs,0)).toBeGreaterThan(2);
      expect(result.state.players.reduce((sum,player)=>sum+player.stats.blocks,0)).toBeGreaterThan(1);
      for (const player of result.state.players) {
        expect(result.positions[player.id]!.size,`${id}, seed ${seed}, player ${player.id}`).toBeGreaterThan(2);
        if (player.stats.survival>8) expect(player.stats.bombs).toBeGreaterThan(0);
      }
    }
  },120_000);

  it('replays the same expert-only seed exactly and resets controllers cleanly',()=>{
    const first=runBots('jungle',681,['expert','expert','expert','expert']);
    const replay=runBots('jungle',681,['expert','expert','expert','expert']);
    expect(replay.digest).toBe(first.digest);
    const match=new Match({mapId:'mall',seed:1,opponents:1,difficulties:['expert']});
    const ai=new AIController('expert',91);
    const action=ai.getAction(match.state,0);
    ai.reset();
    expect(ai.getAction(match.state,0)).toEqual(action);
  },60_000);
});
