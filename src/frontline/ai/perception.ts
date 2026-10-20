import { lineOfSight as geometryLineOfSight, pointInCombatView, soldierInCombatView } from '../core/physics';
import { distance, type Difficulty, type MatchState, type Soldier, type Vec } from '../core/types';

export const PERCEPTION:Record<Difficulty,{sight:number;hearing:number;memory:number;reaction:number;aimError:number;lead:number}>={
 recruit:{sight:380,hearing:650,memory:3.2,reaction:.62,aimError:.145,lead:0},
 regular:{sight:420,hearing:850,memory:4.8,reaction:.24,aimError:.061,lead:.1},
 veteran:{sight:450,hearing:1000,memory:6,reaction:.145,aimError:.035,lead:.2},
 elite:{sight:480,hearing:1100,memory:7,reaction:.105,aimError:.023,lead:.32},
};
export const eye=(point:Vec):Vec=>({x:point.x,y:point.y-37});
export const chest=(point:Vec):Vec=>({x:point.x,y:point.y-29});
/** The same geometry query used by authoritative hitscan weapons. */
export const lineOfSight=(state:MatchState,from:Vec,to:Vec):boolean=>geometryLineOfSight(state.arena,from,to);
export function sightRange(state:MatchState,soldier:Soldier):number {
 const focus=soldier.classId==='sniper'&&soldier.abilityUntil>state.time?1.12:1;
 return Math.min(480,PERCEPTION[soldier.difficulty].sight*focus)*(1-Math.min(.65,state.weather.fog)*.6);
}
/** Perception uses the camera's current world rectangle when supplied. Neither
 * an offscreen observer nor an offscreen target can join the visible fight. */
export function canSeeEnemy(state:MatchState,soldier:Soldier,enemy:Soldier):boolean {
 if(!soldier.alive||!enemy.alive||enemy.team===soldier.team)return false;
 const origin=eye(soldier),target=chest(enemy);
 if(!soldierInCombatView(state,soldier)||!soldierInCombatView(state,enemy)||!pointInCombatView(state,origin)||!pointInCombatView(state,chest(soldier))||!pointInCombatView(state,target))return false;
 return distance(origin,target)<=sightRange(state,soldier)&&lineOfSight(state,origin,target);
}
export function visibleEnemies(state:MatchState,soldier:Soldier):Soldier[]{
 if(!soldier.alive)return[];
 return state.soldiers.filter(enemy=>canSeeEnemy(state,soldier,enemy));
}

export interface EnemyMemory extends Vec { id:number;at:number;vx:number;vy:number;heard:boolean }
