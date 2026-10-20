import { PHYSICS } from '../core/config';
import type { Arena, Platform, Vec } from '../core/types';

export const SHAFT_WIDTH=64;
export const LADDER_HEADROOM=80;
interface Shaft {left:number;right:number;top:number;bottom:number}

/** Galleries have literal openings. The legacy oneWay flag is retained only
 * for art/structural grouping, never as permission to cross a solid slab. */
export function openPhysicalShafts(arena:Arena):void {
 const original=[...arena.platforms];
 const bottom=original.find(platform=>platform.w>=arena.width*.9&&platform.y>=arena.height-100);
 // Clear the boarding space below the lowest stop as well as the passenger
 // space above the car. Cargo underneath an elevator can otherwise seal the
 // ground route while its top is too close to the car to stand on.
 const liftShafts:Shaft[]=original.filter(platform=>platform.moving?.axis==='y').map(platform=>({left:platform.x-32,right:platform.x+platform.w+32,top:Math.min(platform.moving!.from,platform.moving!.to)-PHYSICS.height-12,bottom:Math.max(platform.moving!.from,platform.moving!.to)+platform.h+PHYSICS.height+12}));
 // A ladder must not terminate in the middle of an elevator's broad opening.
 // Move it to a nearby overlapping landing before making its smaller shaft.
 for(const ladder of arena.ladders){
  const upper=ladder.y+58,lower=ladder.y+ladder.h-5,old=ladder.x+ladder.w/2;
  const candidates=[old,...liftShafts.flatMap(shaft=>[shaft.left-70,shaft.right+70]),old-110,old+110,old-190,old+190];
  const usable=(x:number):boolean=>!liftShafts.some(shaft=>x>shaft.left-32&&x<shaft.right+32&&upper<shaft.bottom&&lower>shaft.top)
   &&[upper,lower].every(y=>original.some(platform=>platform.active&&!platform.moving&&Math.abs(platform.y-y)<3&&x>=platform.x+70&&x<=platform.x+platform.w-70));
  const x=candidates.filter(usable).sort((a,b)=>Math.abs(a-old)-Math.abs(b-old))[0];
  if(x!==undefined)ladder.x=x-ladder.w/2;
  ladder.y=upper-LADDER_HEADROOM;ladder.h=lower-ladder.y+5;
 }
 const ladderShafts:Shaft[]=arena.ladders.map(ladder=>({left:ladder.x+ladder.w/2-SHAFT_WIDTH/2,right:ladder.x+ladder.w/2+SHAFT_WIDTH/2,top:ladder.y+LADDER_HEADROOM-86,bottom:ladder.y+ladder.h-7}));
 const shafts=[...liftShafts,...ladderShafts];
 let nextId=Math.max(...original.map(platform=>platform.id))+1;
 const platforms:Platform[]=[];
 for(const platform of original){
  if(platform===bottom||platform.moving||!platform.active){platforms.push(platform);continue;}
  const cuts=shafts.filter(shaft=>platform.y<shaft.bottom&&platform.y+platform.h>shaft.top&&platform.x<shaft.right&&platform.x+platform.w>shaft.left);
  if(!cuts.length){platforms.push(platform);continue;}
  // Recognizable physical props remain whole. Obstructing cover is removed
  // from the shaft, rather than being drawn as a sliced barrel or machine.
  if(!platform.oneWay){continue;}
  let spans:[number,number][]=[[platform.x,platform.x+platform.w]];
  for(const cut of cuts){
   const next:[number,number][]=[];
   for(const[left,right]of spans){
    if(cut.left>=right||cut.right<=left){next.push([left,right]);continue;}
    if(cut.left-left>=44)next.push([left,Math.min(right,cut.left)]);
    if(right-cut.right>=44)next.push([Math.max(left,cut.right),right]);
   }
   spans=next;
  }
  spans.forEach(([left,right],index)=>platforms.push({...platform,id:index===0?platform.id:nextId++,x:left,w:right-left}));
 }
 arena.platforms=platforms;
 // Flags, loot crates and spawns stand on real support after a shaft is cut.
 const relocate=(point:Vec):void=>{
  const supports=platforms.filter(platform=>platform.active&&!platform.moving&&Math.abs(platform.y-point.y)<3&&platform.w>=PHYSICS.radius*2+12);
  let best=point.x,distance=Infinity;
  for(const support of supports){
   const x=Math.max(support.x+22,Math.min(support.x+support.w-22,point.x));
   const blocked=platforms.some(other=>other.id!==support.id&&other.active&&x+PHYSICS.radius>other.x&&x-PHYSICS.radius<other.x+other.w&&point.y>other.y+1&&point.y-PHYSICS.height<other.y+other.h);
   if(!blocked&&Math.abs(x-point.x)<distance){best=x;distance=Math.abs(x-point.x);}
  }
  point.x=best;
 };
 for(const point of [...arena.spawns,...arena.flagSpawns,...arena.crateSpawns])relocate(point);
}
