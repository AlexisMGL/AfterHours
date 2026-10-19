import { lineOfSight as geometryLineOfSight } from '../core/physics';
import { distance, type Difficulty, type MatchState, type Soldier, type Vec } from '../core/types';

export const PERCEPTION:Record<Difficulty,{sight:number;hearing:number;memory:number;reaction:number;aimError:number;lead:number}>={
 recruit:{sight:950,hearing:650,memory:3.2,reaction:.43,aimError:.105,lead:0},
 regular:{sight:1150,hearing:850,memory:4.8,reaction:.24,aimError:.061,lead:.1},
 veteran:{sight:1350,hearing:1000,memory:6,reaction:.145,aimError:.035,lead:.2},
 elite:{sight:1500,hearing:1100,memory:7,reaction:.105,aimError:.023,lead:.32},
};
export const eye=(point:Vec):Vec=>({x:point.x,y:point.y-37});
export const chest=(point:Vec):Vec=>({x:point.x,y:point.y-29});
/** The same geometry query used by authoritative hitscan weapons. */
export const lineOfSight=(state:MatchState,from:Vec,to:Vec):boolean=>geometryLineOfSight(state.arena,from,to);
export function sightRange(state:MatchState,soldier:Soldier):number {
 const focus=soldier.classId==='sniper'&&soldier.abilityUntil>state.time?1.12:1;
 return PERCEPTION[soldier.difficulty].sight*(1-Math.min(.65,state.weather.fog)*.6)*focus;
}
export function visibleEnemies(state:MatchState,soldier:Soldier):Soldier[]{
 if(!soldier.alive)return[];
 const range=sightRange(state,soldier),origin=eye(soldier);
 return state.soldiers.filter(enemy=>enemy.alive&&enemy.team!==soldier.team&&distance(origin,chest(enemy))<=range&&lineOfSight(state,origin,chest(enemy)));
}

export interface EnemyMemory extends Vec { id:number;at:number;vx:number;vy:number;heard:boolean }
