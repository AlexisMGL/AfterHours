import { describe,expect,it } from 'vitest';
import { buildNavigation,createArena,MAPS,validateArena } from '../src/frontline/maps/maps';
import { TacticalAI,weaponUtility } from '../src/frontline/ai/controller';
import { findRoute,Navigator } from '../src/frontline/ai/navigation';
import { chest,eye,lineOfSight,PERCEPTION,visibleEnemies } from '../src/frontline/ai/perception';
import { ShooterMatch } from '../src/frontline/core/engine';
import { WEAPONS } from '../src/frontline/core/config';
import type { Action,Difficulty,MapId,MatchConfig,MatchState,Mode,Vec } from '../src/frontline/core/types';

const config=(overrides:Partial<MatchConfig>={}):MatchConfig=>({mapId:'aircraft',mode:'deathmatch',botCount:7,difficulty:'elite',humanClass:'assault',human:false,seed:47,scoreLimit:30,rounds:3,timeLimit:90,eventFrequency:'normal',...overrides});

describe('Frontline world structure',()=>{
 it.each(MAPS)('$id has accessible flags and multiple connected elevations',map=>{
  for(let seed=0;seed<8;seed++){
   const arena=createArena(map.id,seed);
   expect(validateArena(arena),`${map.id} seed${seed}`).toEqual({valid:true,errors:[]});
   expect(arena.width).toBeGreaterThanOrEqual(4000);
   expect(arena.flagSpawns).toHaveLength(3);
   expect(new Set(arena.flagSpawns.map(point=>point.y)).size).toBe(3);
   expect(createArena(map.id,seed)).toEqual(arena);
  }
 });
 it('connects every fixed gallery, distributed spawn, crate and objective in both directions',()=>{
  for(const map of MAPS){
   const arena=createArena(map.id,51);
   for(const start of arena.flagSpawns)for(const goal of [...arena.spawns,...arena.flagSpawns,...arena.crateSpawns])expect(findRoute(arena,start,goal),`${map.id} ${start.x},${start.y} → ${goal.x},${goal.y}`).not.toBeNull();
   expect(Object.values(arena.nav.edges).flat().some(edge=>edge.kind==='ladder')).toBe(true);
   expect(Object.values(arena.nav.edges).flat().some(edge=>edge.kind==='jump')).toBe(true);
   expect(Object.values(arena.nav.edges).flat().some(edge=>edge.kind==='drop')).toBe(true);
  }
 });
 it('exposes lift edges and rebuilds after dynamic geometry is removed',()=>{
  const arena=createArena('factory',4);
  expect(Object.values(arena.nav.edges).flat().some(edge=>edge.kind==='lift')).toBe(true);
  expect(arena.platforms.some(platform=>platform.moving)).toBe(true);
  const variant=createArena('factory',99);
  expect(variant.platforms).not.toEqual(arena.platforms);
  for(const platform of arena.platforms)if(platform.hp!==undefined)platform.active=false;
  arena.nav=buildNavigation(arena);
  expect(validateArena(arena)).toEqual({valid:true,errors:[]});
 });
});

describe('Frontline navigation execution and fair perception',()=>{
 it('physically climbs a ladder to a higher floor using ordinary controller actions',()=>{
  const match=new ShooterMatch(config({botCount:3}));
  const soldier=match.state.soldiers[0]!;
  const ladder=match.state.arena.ladders[0]!;
  soldier.x=ladder.x+ladder.w/2;soldier.y=1120;soldier.platformId=1;soldier.grounded=true;
  const goal={x:soldier.x,y:900},navigator=new Navigator();
  navigator.setGoal(match.state,soldier,goal);
  let climbing=false;
  for(let frame=0;frame<180;frame++){
   const action=navigator.getAction(match.state,soldier);climbing ||= action.climb===-1;
   match.step({0:action});
  }
  expect(climbing).toBe(true);
  expect(soldier.y).toBeCloseTo(900,0);
  expect(soldier.grounded).toBe(true);
 });
 it('physically tours all three flag elevations on every map',()=>{
  for(const map of MAPS){
   const match=new ShooterMatch(config({mapId:map.id,botCount:3,timeLimit:0}));
   const soldier=match.state.soldiers[0]!,navigator=new Navigator();
   for(const goal of match.state.arena.flagSpawns){
    navigator.setGoal(match.state,soldier,goal);
    for(let frame=0;frame<2400&&(Math.abs(soldier.x-goal.x)>65||Math.abs(soldier.y-goal.y)>15);frame++)match.step({0:navigator.getAction(match.state,soldier)});
    expect(Math.abs(soldier.x-goal.x),`${map.id}: flag at ${goal.x},${goal.y}, soldier ${soldier.x},${soldier.y}`).toBeLessThan(66);
    expect(Math.abs(soldier.y-goal.y),`${map.id}: flag elevation ${goal.y}`).toBeLessThan(16);
   }
  }
 },60_000);
 it('sees only enemies within real geometry and fog-limited sight',()=>{
  const match=new ShooterMatch(config({botCount:3})),state=match.state;
  const soldier=state.soldiers[0]!,enemy=state.soldiers[1]!;
  soldier.x=100;soldier.y=1120;enemy.x=500;enemy.y=1120;
  for(const platform of state.arena.platforms)if(platform.hp!==undefined)platform.active=false;
  expect(visibleEnemies(state,soldier)).toContain(enemy);
  state.arena.platforms.push({id:999,x:280,y:1020,w:80,h:100,oneWay:false,material:'metal',active:true});
  expect(lineOfSight(state,eye(soldier),chest(enemy))).toBe(false);
  expect(visibleEnemies(state,soldier)).not.toContain(enemy);
  state.arena.platforms.at(-1)!.active=false;enemy.x=1400;
  expect(visibleEnemies(state,soldier)).toContain(enemy);
  state.weather.fog=.65;
  expect(visibleEnemies(state,soldier)).not.toContain(enemy);
 });
 it('cannot shoot or chase an unobserved enemy using its hidden live position',()=>{
  const first=new ShooterMatch(config({botCount:3})),second=new ShooterMatch(config({botCount:3}));
  for(const match of [first,second]){
   const soldier=match.state.soldiers[0]!;soldier.x=100;soldier.y=1120;
   for(const enemy of match.state.soldiers.filter(unit=>unit.team===1)){enemy.x=4500;enemy.y=460;}
  }
  second.state.soldiers[1]!.x=4000;second.state.soldiers[1]!.y=900;
  const a=new TacticalAI('elite',9),b=new TacticalAI('elite',9);
  expect(a.getAction(first.state,0)).toEqual(b.getAction(second.state,0));
  expect(a.target).toEqual(b.target);
  expect(a.getAction(first.state,0).fire).toBe(false);
 });
 it('investigates approximate heard shots through cover without shooting unseen targets',()=>{
  const match=new ShooterMatch(config({botCount:3})),state=match.state;
  const soldier=state.soldiers[0]!,enemy=state.soldiers[1]!;
  soldier.x=100;soldier.y=1120;enemy.x=650;enemy.y=1120;
  state.arena.platforms.push({id:999,x:350,y:1000,w:90,h:120,oneWay:false,material:'metal',active:true});
  state.events=[{type:'shot',x:650,y:1089,soldierId:enemy.id,weapon:'vanguard'}];
  const ai=new TacticalAI('elite',1),action=ai.getAction(state,0);
  expect(ai.tacticalState).toBe('investigate');
  expect(ai.target!.x).toBeGreaterThan(600);expect(ai.target!.x).toBeLessThan(700);
  expect(action.fire).toBe(false);
 });
 it('has distinct reaction, perception, memory, predictive aim and precision profiles',()=>{
  expect(PERCEPTION.recruit.reaction).toBeGreaterThan(PERCEPTION.regular.reaction);
  expect(PERCEPTION.regular.reaction).toBeGreaterThan(PERCEPTION.veteran.reaction);
  expect(PERCEPTION.veteran.reaction).toBeGreaterThan(PERCEPTION.elite.reaction);
  expect(PERCEPTION.recruit.aimError).toBeGreaterThan(PERCEPTION.elite.aimError*3);
  const soldier=new ShooterMatch(config()).state.soldiers[0]!;
  expect(weaponUtility('ranger',soldier)).toBeGreaterThan(weaponUtility('kestrel',soldier));
 });
 it('splits team assignments among all three flags on separate elevations',()=>{
  const match=new ShooterMatch(config({mode:'flags',botCount:15}));match.state.crates=[];
  const targets=new Set<number>();
  for(const soldier of match.state.soldiers.filter(unit=>unit.team===0)){
   const ai=new TacticalAI('elite',soldier.id+9);ai.getAction(match.state,soldier.id);
   targets.add(ai.target!.y);
  }
  expect(targets.size).toBe(3);
 });
 it('uses all four class abilities through simulation actions and reloads finite ammunition',()=>{
  for(const classId of ['assault','support','defense','sniper'] as const){
   const match=new ShooterMatch(config({humanClass:classId,botCount:3})),state=match.state;
   const soldier=state.soldiers[0]!,enemy=state.soldiers[1]!;
   soldier.x=100;soldier.y=1120;soldier.health-=45;enemy.x=600;enemy.y=1120;enemy.protectedUntil=0;
   for(const platform of state.arena.platforms)if(platform.hp!==undefined)platform.active=false;
   const ai=new TacticalAI('elite',19),action=ai.getAction(state,0);
   expect(action.ability,`${classId} uses its ability`).toBe(true);
   match.step({0:action});
   expect(state.events.some(event=>event.type==='ability'&&event.soldierId===0)).toBe(true);
   soldier.weapons[soldier.activeWeapon].ammo=0;
   state.time+=1;state.tick++;
   const emptyAction=ai.getAction(state,0);
   expect(emptyAction.fire).toBe(false);
   expect(emptyAction.reload).toBe(true);
  }
 });
});

interface Soak {state:MatchState;actions:{climb:number;jump:number;ability:number;reload:number;interact:number;fire:number};positions:Map<number,Vec[]>;maxProjectiles:number;digest:string}
function simulate(mapId:MapId,mode:Mode,seed:number,seconds:number,botCount=15,difficulty:Difficulty='elite'):Soak {
 const match=new ShooterMatch(config({mapId,mode,seed,botCount,difficulty,scoreLimit:seconds>60?9999:mode==='flags'?35:12,timeLimit:seconds,eventFrequency:'normal'}));
 const controllers=match.state.soldiers.map(soldier=>new TacticalAI(difficulty,seed+soldier.id*997));
 const counts={climb:0,jump:0,ability:0,reload:0,interact:0,fire:0};
 const positions=new Map<number,Vec[]>(match.state.soldiers.map(soldier=>[soldier.id,[{x:soldier.x,y:soldier.y}]]));
 let maxProjectiles=0;
 for(let tick=0;tick<seconds*30+1&&match.state.phase!=='finished';tick++){
  const actions:Record<number,Action>={};
  for(const soldier of match.state.soldiers){const action=controllers[soldier.id]!.getAction(match.state,soldier.id);actions[soldier.id]=action;for(const key of Object.keys(counts) as (keyof typeof counts)[])if(action[key])counts[key]++;}
  match.step(actions,1/30);
  maxProjectiles=Math.max(maxProjectiles,match.state.projectiles.length);
  if(tick%30===0)for(const soldier of match.state.soldiers){
   if(!Number.isFinite(soldier.x)||!Number.isFinite(soldier.y)||!Number.isFinite(soldier.vx)||!Number.isFinite(soldier.vy))throw new Error(`Nonfinite soldier ${soldier.id} ${mapId}`);
   if(soldier.x<0||soldier.x>match.state.arena.width||soldier.y>match.state.arena.height+150)throw new Error(`Out-of-bounds soldier ${soldier.id}`);
   positions.get(soldier.id)!.push({x:soldier.x,y:soldier.y});
  }
 }
 const state=match.state;
 return{state,actions:counts,positions,maxProjectiles,digest:JSON.stringify({soldiers:state.soldiers,scores:state.scores,round:state.round,time:state.time,projectiles:state.projectiles})};
}

describe('Frontline deterministic AI integration',()=>{
 it('runs every map and mode with15 bots, real vertical navigation and bounded combat state',()=>{
  for(const map of MAPS)for(const mode of ['deathmatch','elimination','flags'] as Mode[]){
   const result=simulate(map.id,mode,61,24);
   expect(result.state.soldiers).toHaveLength(16);
   expect(result.actions.climb,`${map.id} ${mode}: ladder usage`).toBeGreaterThan(0);
   expect(result.actions.fire,`${map.id} ${mode}: combat`).toBeGreaterThan(0);
   expect(result.actions.ability,`${map.id} ${mode}: abilities`).toBeGreaterThan(0);
   expect(result.maxProjectiles).toBeLessThan(180);
   const travelled=[...result.positions.values()].filter(points=>Math.max(...points.map(point=>point.x))-Math.min(...points.map(point=>point.x))>200);
   expect(travelled.length,`${map.id} ${mode}: mobile bots`).toBeGreaterThanOrEqual(10);
   expect(result.state.soldiers.reduce((sum,soldier)=>sum+soldier.stats.shots,0)).toBeGreaterThan(10);
   if(mode==='flags')expect(result.state.flags.some(flag=>flag.owner!==null||flag.progress>0)).toBe(true);
  }
 },120_000);
 it('repeats seeded fifteen-bot matches exactly and resets controller state',()=>{
  const first=simulate('factory','flags',443,32),second=simulate('factory','flags',443,32);
  expect(second.digest).toBe(first.digest);
  expect(first.actions.reload).toBeGreaterThan(0);
  expect(first.actions.interact).toBeGreaterThan(0);
  const match=new ShooterMatch(config());const ai=new TacticalAI('elite',9);
  const action=ai.getAction(match.state,0);ai.reset();expect(ai.getAction(match.state,0)).toEqual(action);
 },60_000);
 it('keeps fifteen bots stable through announced environmental changes on multiple seeds',()=>{
  for(const [mapId,seed]of [['factory',91],['city',229],['ship',337]] as [MapId,number][]){
   const result=simulate(mapId,'deathmatch',seed,76);
   expect(result.state.eventCycle).toBeGreaterThan(0);
   expect(result.maxProjectiles).toBeLessThan(180);
   expect(result.state.soldiers.reduce((sum,soldier)=>sum+soldier.stats.shots,0)).toBeGreaterThan(100);
   expect(result.actions.climb).toBeGreaterThan(100);
   expect(result.state.phase).toBe('finished');
  }
 },120_000);
});
