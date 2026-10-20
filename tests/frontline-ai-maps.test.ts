import { describe,expect,it } from 'vitest';
import { buildNavigation,createArena,MAPS,validateArena } from '../src/frontline/maps/maps';
import { TacticalAI,weaponUtility } from '../src/frontline/ai/controller';
import { findRoute,Navigator } from '../src/frontline/ai/navigation';
import { canSeeEnemy,chest,eye,lineOfSight,PERCEPTION,sightRange,visibleEnemies } from '../src/frontline/ai/perception';
import { ShooterMatch } from '../src/frontline/core/engine';
import { PHYSICS,WEAPONS } from '../src/frontline/core/config';
import type { Action,Difficulty,MapId,MatchConfig,MatchState,Mode,Vec } from '../src/frontline/core/types';

const config=(overrides:Partial<MatchConfig>={}):MatchConfig=>({mapId:'aircraft',mode:'deathmatch',botCount:7,difficulty:'elite',humanClass:'assault',human:false,seed:47,scoreLimit:30,rounds:3,timeLimit:90,eventFrequency:'normal',...overrides});
function assertClearBody(state:MatchState,point:Vec):void {
 const epsilon=1e-5,left=point.x-PHYSICS.radius,right=point.x+PHYSICS.radius,top=point.y-PHYSICS.height;
 const solid=state.arena.platforms.find(platform=>platform.active&&left<platform.x+platform.w-epsilon&&right>platform.x+epsilon&&top<platform.y+platform.h-epsilon&&point.y>platform.y+epsilon);
 if(solid)throw new Error(`Character at ${point.x},${point.y} overlaps solid platform ${solid.id} (${solid.x},${solid.y},${solid.w},${solid.h}).`);
}

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
  const landing=match.state.arena.nav.nodes.filter(node=>Math.abs(node.y-900)<2&&Math.abs(node.x-soldier.x)<92).sort((a,b)=>Math.abs(a.x-soldier.x)-Math.abs(b.x-soldier.x))[0]!;
  const goal={x:landing.x,y:landing.y},navigator=new Navigator();
  navigator.setGoal(match.state,soldier,goal);
  let climbing=false;
  for(let frame=0;frame<180;frame++){
   const action=navigator.getAction(match.state,soldier);climbing ||= action.climb===-1;
   match.step({0:action});assertClearBody(match.state,soldier);
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
    for(let frame=0;frame<2400&&(Math.abs(soldier.x-goal.x)>65||Math.abs(soldier.y-goal.y)>15);frame++){match.step({0:navigator.getAction(match.state,soldier)});assertClearBody(match.state,soldier);}
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
  state.arena.platforms.at(-1)!.active=false;enemy.x=550;
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
   soldier.x=100;soldier.y=1120;soldier.health-=45;enemy.x=480;enemy.y=1120;enemy.protectedUntil=0;
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

/** A small unobstructed combat fixture keeps camera/perception regressions
 * independent of authored cargo placement and navigation test geometry. */
function viewportFight():ShooterMatch {
 const match=new ShooterMatch(config({botCount:3})),state=match.state;
 state.arena.platforms=state.arena.platforms.filter(platform=>platform.id===1);
 state.arena.ladders=[];state.arena.nav=buildNavigation(state.arena);state.crates=[];
 state.time=5;state.tick=300;
 const human=state.soldiers[0]!,observer=state.soldiers[1]!;
 human.x=200;human.y=1120;human.protectedUntil=0;
 observer.x=520;observer.y=1120;observer.protectedUntil=0;
 for(const soldier of state.soldiers.slice(2)){soldier.x=4200+soldier.id*40;soldier.y=1120;}
 state.combatView={x:0,y:600,w:960,h:600};
 return match;
}

describe('Local AI perception follows the visible camera every simulation tick',()=>{
 it('limits every difficulty and Focus to a nearby encounter distance',()=>{
  const {state}=viewportFight(),observer=state.soldiers[1]!,human=state.soldiers[0]!;
  expect(Object.values(PERCEPTION).map(profile=>profile.sight)).toEqual([380,420,450,480]);
  observer.classId='sniper';observer.abilityUntil=state.time+5;
  for(const difficulty of ['recruit','regular','veteran','elite'] as Difficulty[]){
   observer.difficulty=difficulty;expect(sightRange(state,observer)).toBeLessThanOrEqual(480);
  }
  human.x=30;observer.difficulty='elite';
  expect(canSeeEnemy(state,observer,human)).toBe(false);
  human.x=100;
  expect(canSeeEnemy(state,observer,human)).toBe(true);
  state.arena.platforms.push({id:999,x:300,y:1020,w:60,h:100,oneWay:false,material:'metal',active:true});
  expect(canSeeEnemy(state,observer,human)).toBe(false);
  state.arena.platforms.at(-1)!.active=false;
  state.combatView={x:0,y:600,w:400,h:600};
  expect(canSeeEnemy(state,observer,human)).toBe(false);
 });
 it('forbids an offscreen soldier from seeing or firing at the visible human',()=>{
  const {state}=viewportFight(),human=state.soldiers[0]!,observer=state.soldiers[1]!;
  human.x=700;observer.x=1000;
  expect(visibleEnemies(state,observer)).not.toContain(human);
  const action=new TacticalAI('elite',4).getAction(state,observer.id);
  expect(action.fire).toBe(false);expect(action.grenade).not.toBe(true);
 });
 it('forbids aiming at an offscreen target even when it is within local sight range',()=>{
  const {state}=viewportFight(),human=state.soldiers[0]!,observer=state.soldiers[1]!;
  human.x=1000;observer.x=700;
  expect(canSeeEnemy(state,observer,human)).toBe(false);
  expect(new TacticalAI('elite',4).getAction(state,observer.id).fire).toBe(false);
 });
 it('cancels a cached burst immediately when the camera moves off its target',()=>{
  const {state}=viewportFight(),observer=state.soldiers[1]!,ai=new TacticalAI('elite',4);
  expect(ai.getAction(state,observer.id).fire).toBe(true);
  state.time+=1/60;state.tick++;
  state.combatView={x:400,y:600,w:960,h:600};
  expect(ai.getAction(state,observer.id).fire).toBe(false);
  state.time+=1/60;state.tick++;state.combatView={x:0,y:600,w:960,h:600};
  expect(ai.getAction(state,observer.id).fire).toBe(false);
  state.time+=.2;state.tick++;
  expect(ai.getAction(state,observer.id).fire).toBe(true);
 });
 it('cancels a cached burst when only its observer leaves the moving camera view',()=>{
  const {state}=viewportFight(),observer=state.soldiers[1]!,ai=new TacticalAI('elite',4);
  expect(ai.getAction(state,observer.id).fire).toBe(true);
  state.time+=1/60;state.tick++;state.combatView={x:0,y:600,w:400,h:600};
  expect(ai.getAction(state,observer.id).fire).toBe(false);
 });
 it('cancels firing and grenade decisions on the first tick that cover blocks LOS',()=>{
  const {state}=viewportFight(),observer=state.soldiers[1]!,human=state.soldiers[0]!,ai=new TacticalAI('elite',4);
  human.classId='defense';
  const attack=ai.getAction(state,observer.id);
  expect(attack.fire).toBe(true);expect(attack.grenade).toBe(true);
  state.time+=1/60;state.tick++;
  state.arena.platforms.push({id:999,x:340,y:1020,w:60,h:100,oneWay:false,material:'metal',active:true});
  const blocked=ai.getAction(state,observer.id);
  expect(blocked.fire).toBe(false);expect(blocked.grenade).toBe(false);
 });
 it('cancels firing immediately when a target moves beyond local sight',()=>{
  const {state}=viewportFight(),observer=state.soldiers[1]!,human=state.soldiers[0]!,ai=new TacticalAI('elite',4);
  expect(ai.getAction(state,observer.id).fire).toBe(true);
  state.time+=1/60;state.tick++;human.x=20;
  expect(ai.getAction(state,observer.id).fire).toBe(false);
 });
 it('allows audible investigation without revealing the shooter or granting a shot',()=>{
  const {state}=viewportFight(),human=state.soldiers[0]!,observer=state.soldiers[1]!;
  human.x=700;observer.x=1000;
  state.events=[{type:'shot',soldierId:human.id,x:human.x,y:human.y-31,weapon:'vanguard'}];
  const ai=new TacticalAI('elite',4),action=ai.getAction(state,observer.id);
  expect(ai.tacticalState).toBe('investigate');expect(ai.target!.x).toBeLessThan(750);
  expect(action.fire).toBe(false);expect(action.grenade).not.toBe(true);
 });
 it('reloads finite ammunition and collects a nearby upgrade through actual engine commands',()=>{
  const match=viewportFight(),observer=match.state.soldiers[1]!,human=match.state.soldiers[0]!,ai=new TacticalAI('elite',4);
  human.health=human.maxHealth=10_000;
  observer.weapons[0].ammo=1;observer.weapons[0].reserve=6;
  let reloadEvents=0;
  for(let frame=0;frame<210;frame++){
   match.step({1:ai.getAction(match.state,observer.id)});
   reloadEvents+=match.state.events.filter(event=>event.type==='reload'&&event.soldierId===observer.id).length;
  }
  expect(reloadEvents).toBeGreaterThan(0);
  expect(observer.weapons[0].reserve).toBe(0);
  expect(observer.stats.shots).toBeGreaterThan(1);
  const crateMatch=viewportFight(),collector=crateMatch.state.soldiers[1]!,collectorAI=new TacticalAI('elite',4);
  crateMatch.state.crates=[{id:99,x:collector.x,y:collector.y,weapon:'ranger',readyAt:0}];
  crateMatch.step({1:collectorAI.getAction(crateMatch.state,collector.id)});
  expect(collector.weapons[0].id).toBe('ranger');
  expect(crateMatch.state.events.some(event=>event.type==='crate'&&event.soldierId===collector.id)).toBe(true);
 });
});

describe('Skybreach aircraft sections, physical cover and occlusion',()=>{
 it('keeps the starting run and first jump clear of aircraft cargo',()=>{
  const match=new ShooterMatch(config({botCount:3})),soldier=match.state.soldiers[0]!;
  expect(soldier.x).toBe(110);expect(soldier.y).toBe(1120);
  match.step({0:{move:1}},.35);
  expect(soldier.x).toBeGreaterThan(180);
  match.step({0:{jump:true}});
  let minimum=soldier.y;
  for(let frame=0;frame<70;frame++){match.step({});minimum=Math.min(minimum,soldier.y);}
  expect(minimum).toBeLessThan(1000);expect(soldier.y).toBe(1120);
 });
 it('authors six coherent connected sections, varied physical cargo and background scenery across seeds',()=>{
  for(let seed=0;seed<24;seed++){
   const arena=createArena('aircraft',seed);
   expect(validateArena(arena),`aircraft seed${seed}`).toEqual({valid:true,errors:[]});
   expect(arena.sections?.map(section=>section.id)).toEqual(['ramp','heavy-cargo','supply','service','avionics','flightdeck']);
   expect(arena.sections!.reduce((width,section)=>width+section.w,0)).toBe(arena.width);
   expect(arena.decorations!.length).toBeGreaterThanOrEqual(100);
   expect(new Set(arena.decorations!.map(item=>item.kind)).size).toBe(9);
   const props=arena.platforms.filter(platform=>!platform.oneWay&&platform.skin!=='deck');
   expect(props.length,`seed${seed}: actual physical cover`).toBeGreaterThanOrEqual(17);
   expect(new Set(props.map(platform=>platform.skin)).size,`seed${seed}: recognizable prop types`).toBeGreaterThanOrEqual(12);
   for(const prop of props)expect(arena.nav.nodes.some(node=>node.platformId===prop.id),`${prop.skin} ${prop.label} has a navigable top`).toBe(true);
  }
 });
 it('blocks vision through every real prop and deck, while rear-wall windows remain scenery',()=>{
  const match=new ShooterMatch(config()),state=match.state;
  for(const platform of state.arena.platforms){
   if(platform.skin==='deck'&&platform.y===1120)continue;
   const y=platform.y+platform.h/2;
   expect(lineOfSight(state,{x:platform.x-3,y},{x:platform.x+platform.w+3,y}),`${platform.skin} ${platform.label}`).toBe(false);
  }
  expect(lineOfSight(state,{x:1095,y:1080},{x:1095,y:850})).toBe(true);
  expect(lineOfSight(state,{x:870,y:140},{x:870,y:190})).toBe(true);
 });
 it('never spots or fires at a soldier concealed by a traversal deck in either direction',()=>{
  for(const inverse of [false,true]){
   const match=new ShooterMatch(config({botCount:3})),state=match.state;
   for(const platform of state.arena.platforms)if(platform.hp!==undefined)platform.active=false;
   const soldier=state.soldiers[0]!,enemy=state.soldiers[1]!;
   soldier.x=500;soldier.y=inverse?900:1120;enemy.x=500;enemy.y=inverse?1120:900;enemy.protectedUntil=0;
   expect(visibleEnemies(state,soldier)).not.toContain(enemy);
   expect(new TacticalAI('elite',9).getAction(state,soldier.id).fire).toBe(false);
  }
 });
 it('physically reaches the stepped cargo stacks and elevated supply crates on different seeds',()=>{
  for(const seed of [5,67,191]){
   const match=new ShooterMatch(config({seed,botCount:3,timeLimit:0,eventFrequency:'reduced'})),soldier=match.state.soldiers[0]!,navigator=new Navigator();
   for(const goal of match.state.arena.crateSpawns.slice(-2)){
    navigator.setGoal(match.state,soldier,goal);
    for(let frame=0;frame<2400&&(Math.abs(soldier.x-goal.x)>40||Math.abs(soldier.y-goal.y)>8);frame++){match.step({0:navigator.getAction(match.state,soldier)});assertClearBody(match.state,soldier);}
    expect(Math.abs(soldier.x-goal.x),`seed${seed}: cargo ${goal.x},${goal.y}, soldier ${soldier.x},${soldier.y}`).toBeLessThan(41);
    expect(Math.abs(soldier.y-goal.y)).toBeLessThan(9);
   }
  }
 },60_000);
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
