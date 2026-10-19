import { Random } from '../../core/random';
import { PHYSICS, WEAPONS } from '../core/config';
import { clamp, distance, type Action, type Controller, type Difficulty, type MatchState, type Soldier, type Vec, type WeaponId } from '../core/types';
import { Navigator, nearestNode } from './navigation';
import { chest, eye, lineOfSight, PERCEPTION, visibleEnemies, type EnemyMemory } from './perception';

export type TacticalState='patrol'|'attack'|'cover'|'retreat'|'reload'|'heal'|'resupply'|'capture'|'defend'|'investigate';
export const AI_PROFILES=PERCEPTION;
const rarity={common:0,uncommon:1,rare:2,epic:3};

export function weaponUtility(id:WeaponId,soldier:Soldier):number {
 const weapon=WEAPONS[id];
 let score=weapon.damage*Math.min(weapon.pellets,5)/Math.max(.2,weapon.interval)*.025+rarity[weapon.rarity]*1.5;
 if(soldier.classId==='sniper')score+=weapon.category==='sniper'||weapon.category==='dmr'?5:0;
 if(soldier.classId==='support')score+=weapon.category==='smg'||weapon.category==='rifle'?4:0;
 if(soldier.classId==='defense')score+=weapon.category==='lmg'||weapon.category==='shotgun'?4:0;
 if(soldier.classId==='assault')score+=weapon.category==='rifle'||weapon.category==='smg'?4:0;
 if(weapon.explosion)score-=1.5;
 return score;
}

/** Tactical bots operate only on public geometry, visible enemies, audible
 * events, and expiring observations. They never read an unseen enemy's live
 * position to choose an aim point or an investigation route. */
export class TacticalAI implements Controller {
 readonly difficulty:Difficulty;
 readonly navigator=new Navigator();
 tacticalState:TacticalState='patrol';
 target?:Vec;
 private readonly seed:number;
 private random:Random;
 private nextThink=0;
 private combat:Action={};
 private memories=new Map<number,EnemyMemory>();
 private eventsTick=-1;
 private lastTime=-1;
 private alive=false;
 private patrol=0;
 private patrolUntil=0;
 private lastGrenade=-Infinity;
 private selectedEnemy?:number;
 private lastObservedPosition?:Vec;
 private progressAt=0;
 private blockedSince=0;

 constructor(difficulty:Difficulty,seed=1){this.difficulty=difficulty;this.seed=seed;this.random=new Random(seed);}
 reset():void {
  this.random=new Random(this.seed);this.navigator.reset();this.nextThink=0;this.combat={};this.memories.clear();this.eventsTick=-1;this.lastTime=-1;this.alive=false;this.patrol=0;this.patrolUntil=0;this.lastGrenade=-Infinity;this.selectedEnemy=undefined;this.lastObservedPosition=undefined;this.progressAt=0;this.blockedSince=0;this.target=undefined;this.tacticalState='patrol';
 }
 getAction(state:MatchState,soldierId:number):Action {
  const soldier=state.soldiers.find(unit=>unit.id===soldierId);
  if(!soldier||state.phase!=='playing')return{};
  if(state.time<this.lastTime)this.reset();
  this.lastTime=state.time;
  if(!soldier.alive){this.alive=false;this.combat={};this.navigator.clear();return{};}
  if(!this.alive){this.alive=true;this.navigator.reset();this.nextThink=state.time;this.memories.clear();this.patrol=(soldier.id+this.seed)%3;}
  this.hear(state,soldier);
  let pulse:Action={};
  if(state.time>=this.nextThink){
   this.nextThink=state.time+PERCEPTION[this.difficulty].reaction*(.9+this.random.next()*.2);
   pulse=this.decide(state,soldier);
  }
  const movement=this.navigator.getAction(state,soldier);
  const action:Action={...movement,...this.combat,...pulse};
  const slot=soldier.weapons[soldier.activeWeapon];
  if(slot.ammo<=0||slot.reloadUntil>state.time)action.fire=false;
  return action;
 }

 private hear(state:MatchState,soldier:Soldier):void {
  if(this.eventsTick===state.tick)return;
  this.eventsTick=state.tick;
  const profile=PERCEPTION[this.difficulty];
  for(const event of state.events){
   if(event.type!=='shot'&&event.type!=='footstep'&&event.type!=='explosion')continue;
   if(event.soldierId===undefined)continue;
   const source=state.soldiers.find(unit=>unit.id===event.soldierId);
   if(!source||source.team===soldier.team)continue;
   const range=event.type==='footstep'?profile.hearing*.36:profile.hearing;
   if(distance(event,soldier)>range)continue;
   const existing=this.memories.get(source.id);
   if(existing&&!existing.heard&&state.time-existing.at<.4)continue;
   // Sound localization is deliberately approximate. A shot behind cover is
   // an investigation cue, never permission to aim at its hidden shooter.
   const error=event.type==='footstep'?65:38;
   this.memories.set(source.id,{id:source.id,x:clamp(event.x+(this.random.next()-.5)*error,20,state.arena.width-20),y:event.y,at:state.time,vx:0,vy:0,heard:true});
  }
  for(const [id,memory]of this.memories)if(state.time-memory.at>profile.memory)this.memories.delete(id);
 }

 private decide(state:MatchState,soldier:Soldier):Action {
  const profile=PERCEPTION[this.difficulty];
  const visible=visibleEnemies(state,soldier);
  for(const enemy of visible)this.memories.set(enemy.id,{id:enemy.id,x:enemy.x,y:enemy.y,vx:enemy.vx,vy:enemy.vy,at:state.time,heard:false});
  const enemies=visible.sort((a,b)=>this.threatScore(state,soldier,b)-this.threatScore(state,soldier,a));
  const enemy=enemies[0];
  this.selectedEnemy=enemy?.id;
  this.combat={fire:false,aim:soldier.aim};
  const pulse:Action={};
  const slot=soldier.weapons[soldier.activeWeapon],weapon=WEAPONS[slot.id];
  const allies=state.soldiers.filter(unit=>unit.alive&&unit.team===soldier.team&&unit.id!==soldier.id);
  const range=enemy?distance(soldier,enemy):Infinity;
  const closeSniper=soldier.classId==='sniper'&&range<260;
  if(closeSniper&&soldier.activeWeapon===0&&soldier.weapons[1].ammo>0)pulse.switchWeapon=1;
  else if(!closeSniper&&soldier.activeWeapon===1&&soldier.weapons[0].ammo>0&&range>420)pulse.switchWeapon=0;
  if(slot.ammo===0&&slot.reserve===0){
   const other=soldier.activeWeapon===0?1:0;
   if(soldier.weapons[other].ammo+soldier.weapons[other].reserve>0)pulse.switchWeapon=other;
  }
  const reloading=slot.reloadUntil>state.time;
  const shouldReload=slot.reserve>0&&!reloading&&(slot.ammo===0||(!enemy&&slot.ammo<weapon.magazine*.68)||(range>weapon.range*.9&&slot.ammo<weapon.magazine*.4));
  if(shouldReload)pulse.reload=true;
  if(enemy){
   const target=chest(enemy);
   const flight=weapon.speed>0?Math.min(.8,range/weapon.speed):profile.lead*.16;
   const lead=this.difficulty==='recruit'?0:flight;
   target.x+=enemy.vx*lead;target.y+=enemy.vy*lead*.3;
   if(this.difficulty==='elite'&&weapon.category==='sniper'&&this.random.next()<.45)target.y-=12;
   let angle=Math.atan2(target.y-(soldier.y-31),target.x-soldier.x);
   if(weapon.category==='launcher')angle-=Math.sign(target.x-soldier.x)*Math.min(.25,range/3000);
   const error=profile.aimError*(.65+range/1800)*(this.random.next()+this.random.next()-1);
   this.combat.aim=angle+error;
   this.combat.fire=range<=weapon.range*.96&&slot.ammo>0&&!reloading&&enemy.protectedUntil<=state.time&&lineOfSight(state,{x:soldier.x,y:soldier.y-31},chest(enemy));
   if(weapon.explosion&&range<weapon.explosion+85)this.combat.fire=false;
   const aggressive=state.config.mode!=='elimination'||soldier.health>soldier.maxHealth*.65;
   const allowed=this.difficulty!=='recruit'||this.random.next()<.42;
   if(soldier.abilityReadyAt<=state.time&&allowed){
    if(soldier.classId==='assault'&&(aggressive||soldier.health<soldier.maxHealth*.4))pulse.ability=true;
    if(soldier.classId==='defense'&&(state.time-soldier.lastDamageAt<2||range<800||enemies.length>1))pulse.ability=true;
    if(soldier.classId==='sniper'&&range>300&&slot.ammo>0)pulse.ability=true;
   }
   if(soldier.grenades>0&&state.time-this.lastGrenade>5&&range>220&&range<680&&this.difficulty!=='recruit'){
    const cluster=enemies.filter(targetEnemy=>distance(targetEnemy,enemy)<170).length;
    if((cluster>1||this.difficulty==='elite'&&enemy.classId==='defense')&&!allies.some(ally=>distance(ally,enemy)<180)){
     pulse.grenade=true;this.lastGrenade=state.time;
    }
   }
  }
  const wounded=[soldier,...allies].filter(ally=>distance(ally,soldier)<220&&ally.maxHealth-ally.health>12);
  if(soldier.classId==='support'&&soldier.abilityReadyAt<=state.time&&wounded.reduce((sum,ally)=>sum+ally.maxHealth-ally.health,0)>32&&!state.stations.some(station=>station.team===soldier.team&&station.until>state.time&&distance(station,soldier)<180)&&!(this.difficulty==='recruit'&&this.random.next()<.5))pulse.ability=true;
  const nearbyCrate=state.crates.find(crate=>crate.readyAt<=state.time&&distance(crate,soldier)<72);
  if(nearbyCrate&&(weaponUtility(nearbyCrate.weapon,soldier)>weaponUtility(soldier.weapons[0].id,soldier)+.4||soldier.weapons[0].ammo+soldier.weapons[0].reserve<WEAPONS[soldier.weapons[0].id].magazine)){
   pulse.switchWeapon=0;pulse.interact=true;
  }
  let goal:Vec|undefined;
  const lowHealth=soldier.health<soldier.maxHealth*(state.config.mode==='elimination'?.5:.32);
  if(enemy&&(lowHealth||reloading||shouldReload)&&this.difficulty!=='recruit'){
   goal=this.coverPoint(state,soldier,enemy);
   this.tacticalState=lowHealth?'retreat':'reload';
  }
  if(!goal&&soldier.health<soldier.maxHealth*.68){
   const station=state.stations.filter(item=>item.team===soldier.team&&item.until>state.time&&item.capacity>0&&distance(item,soldier)<700).sort((a,b)=>distance(a,soldier)-distance(b,soldier))[0];
   if(station){goal=station;this.tacticalState='heal';}
  }
  const totalAmmo=soldier.weapons[0].ammo+soldier.weapons[0].reserve;
  if(!goal&&(totalAmmo<WEAPONS[soldier.weapons[0].id].magazine||!enemy)){
   const loot=state.loot.filter(item=>item.until>state.time&&distance(item,soldier)<650&&lineOfSight(state,eye(soldier),{x:item.x,y:item.y-15})).sort((a,b)=>distance(a,soldier)-distance(b,soldier))[0];
   if(loot&&totalAmmo<WEAPONS[soldier.weapons[0].id].magazine*1.8){goal=loot;this.tacticalState='resupply';}
   if(!goal){
    const crate=state.crates.filter(item=>item.readyAt<=state.time&&distance(item,soldier)<(totalAmmo<15?1400:350)&&(!enemy||range>600)).sort((a,b)=>distance(a,soldier)-distance(b,soldier))[0];
    if(crate&&(totalAmmo<15||distance(crate,soldier)<170&&weaponUtility(crate.weapon,soldier)>weaponUtility(soldier.weapons[0].id,soldier)+1)){
     goal=crate;this.tacticalState='resupply';
    }
   }
  }
  const objective=this.objective(state,soldier,allies);
  if(!goal&&state.config.mode==='flags'){
   goal=objective;
   this.tacticalState=state.flags.some(flag=>distance(flag,objective)<25&&flag.owner===soldier.team)?'defend':'capture';
  }
  if(!goal&&enemy){
   const preferred=this.preferredRange(weapon.category);
   if(range<preferred*.42&&this.difficulty!=='recruit'){
    const away=Math.sign(soldier.x-enemy.x)||((soldier.id%2)?1:-1);
    goal={x:clamp(soldier.x+away*260,45,state.arena.width-45),y:soldier.y};this.tacticalState='retreat';
   }else if(range>preferred*1.1||Math.abs(enemy.y-soldier.y)>190){goal={x:enemy.x,y:enemy.y};this.tacticalState='attack';}
   else{
    this.tacticalState='attack';
    const direction=Math.sin(state.time*.85+soldier.id*2)>0?1:-1;
    const surface=state.arena.platforms.find(platform=>platform.id===soldier.platformId);
    const x=soldier.x+direction*95;
    if(surface&&x>surface.x+35&&x<surface.x+surface.w-35&&this.difficulty!=='recruit')goal={x,y:soldier.y};
    else goal={x:soldier.x,y:soldier.y};
   }
  }
  if(!goal){
   const remembered=[...this.memories.values()].filter(memory=>state.time-memory.at<profile.memory).sort((a,b)=>b.at-a.at)[0];
   if(remembered){goal={x:clamp(remembered.x+remembered.vx*Math.min(.6,state.time-remembered.at),30,state.arena.width-30),y:remembered.y};this.tacticalState='investigate';}
   else{goal=objective;this.tacticalState='patrol';}
  }
  if(state.time-this.progressAt>2){
   const moved=this.lastObservedPosition?distance(this.lastObservedPosition,soldier):100;
   this.blockedSince=moved<15&&goal&&distance(goal,soldier)>130?this.blockedSince+(state.time-this.progressAt):0;
   this.lastObservedPosition={x:soldier.x,y:soldier.y};this.progressAt=state.time;
   if(this.blockedSince>5){
    this.navigator.clear();this.patrol=(this.patrol+1)%3;this.patrolUntil=0;goal=this.objective(state,soldier,allies);this.blockedSince=0;
    if(soldier.grounded)pulse.jump=true;
   }
  }
  if(goal){
   // A goal point in mid-air is projected onto navigable support, rather than
   // repeatedly ordering a jump to an unreachable enemy animation position.
   const node=nearestNode(state.arena,goal);
   const obstructed=state.arena.platforms.some(platform=>platform.active&&!platform.oneWay&&goal!.x+PHYSICS.radius>platform.x&&goal!.x-PHYSICS.radius<platform.x+platform.w&&goal!.y>platform.y+2&&goal!.y-PHYSICS.height<platform.y+platform.h);
   const supported=state.arena.platforms.some(platform=>platform.active&&Math.abs(platform.y-goal!.y)<5&&goal!.x+PHYSICS.radius>platform.x&&goal!.x-PHYSICS.radius<platform.x+platform.w);
   const groundedGoal=node&&(Math.abs(node.y-goal.y)>18||obstructed||!supported)?{x:node.x,y:node.y}:goal;
   this.target={...groundedGoal};this.navigator.setGoal(state,soldier,groundedGoal);
  }
  return pulse;
 }

 private objective(state:MatchState,soldier:Soldier,allies:Soldier[]):Vec {
  const team=state.soldiers.filter(unit=>unit.team===soldier.team).sort((a,b)=>a.id-b.id);
  const rank=Math.max(0,team.findIndex(unit=>unit.id===soldier.id));
  if(state.config.mode==='flags'&&state.flags.length){
   const assigned=(rank+(soldier.team===1?2:0))%3;
   const ranked=state.flags.map((flag,index)=>{
    let cost=distance(soldier,flag)*.35+(flag.owner===soldier.team?450:0)+(index===assigned?-1050:0);
    if(flag.contested&&distance(soldier,flag)<650)cost-=350;
    const occupants=allies.filter(ally=>distance(ally,flag)<170).length;
    if(flag.owner===soldier.team&&occupants>0&&index!==assigned)cost+=350;
    return{flag,cost};
   }).sort((a,b)=>a.cost-b.cost);
   return ranked[0]!.flag;
  }
  if(state.time>this.patrolUntil||this.target&&distance(soldier,this.target)<100){this.patrol=(this.patrol+1)%3;this.patrolUntil=state.time+8+this.random.next()*7;}
  const publicHotspots=state.arena.flagSpawns;
  const index=soldier.classId==='sniper'?1:(this.patrol+rank)%publicHotspots.length;
  const hotspot=publicHotspots[index]!;
  if(soldier.classId==='support'){
   const lead=allies.filter(ally=>ally.classId!=='support'&&distance(ally,soldier)>140&&distance(ally,soldier)<650).sort((a,b)=>a.health/a.maxHealth-b.health/b.maxHealth)[0];
   if(lead)return{x:lead.x+(soldier.team===0?-95:95),y:lead.y};
  }
  return{x:hotspot.x+((soldier.id%3)-1)*110,y:hotspot.y};
 }

 private threatScore(state:MatchState,soldier:Soldier,enemy:Soldier):number {
  return 1000/(100+distance(soldier,enemy))+(state.time-enemy.lastShotAt<.7?1.1:0)+(this.selectedEnemy===enemy.id?.7:0)+(1-enemy.health/enemy.maxHealth)*.5;
 }
 private preferredRange(category:string):number {
  switch(category){case'sniper':return 1000;case'dmr':return 800;case'rocket':return 750;case'launcher':return 600;case'shotgun':return 270;case'smg':return 410;case'pistol':return 420;default:return 650;}
 }
 private coverPoint(state:MatchState,soldier:Soldier,enemy:Soldier):Vec|undefined {
  let best:Vec|undefined,cost=Infinity;
  for(const cover of state.arena.platforms){
   if(!cover.active||cover.oneWay||cover.h<45||cover.h>145||distance(cover,soldier)>650)continue;
   const floor=cover.y+cover.h;
   for(const x of [cover.x-27,cover.x+cover.w+27]){
    const point={x,y:floor};
    if(distance(point,enemy)<160||lineOfSight(state,chest(enemy),{x,y:floor-31}))continue;
    const node=nearestNode(state.arena,point);if(!node||Math.abs(node.y-floor)>20)continue;
    const score=distance(soldier,point)-distance(enemy,point)*.08;
    if(score<cost){cost=score;best=point;}
   }
  }
  return best;
 }
}
