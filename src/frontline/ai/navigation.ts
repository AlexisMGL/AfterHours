import { distance, type Action, type Arena, type MatchState, type NavEdge, type NavGraph, type NavNode, type Soldier, type Vec } from '../core/types';
import { PHYSICS } from '../core/config';

export interface NavigationPath { nodes:NavNode[];edges:NavEdge[];cost:number }
interface Traversal {path:NavigationPath;index:number;phase:'approach'|'climb'|'exit'|'land'|'fall'}
const graphOrigins=new WeakMap<NavGraph,Map<number,Vec>>();
function origins(arena:Arena):Map<number,Vec>{
 let values=graphOrigins.get(arena.nav);
 if(!values){values=new Map(arena.platforms.map(platform=>[platform.id,{x:platform.x,y:platform.y}]));graphOrigins.set(arena.nav,values);}
 return values;
}
export function currentNode(arena:Arena,node:NavNode):NavNode {
 const platform=arena.platforms.find(surface=>surface.id===node.platformId);
 const origin=origins(arena).get(node.platformId);
 return platform?.moving&&origin?{...node,x:node.x+platform.x-origin.x,y:node.y+platform.y-origin.y}:node;
}
export function nearestNode(arena:Arena,point:Vec,platformId?:number|null):NavNode|undefined {
 let best:NavNode|undefined,bestDistance=Infinity;
 for(const raw of arena.nav.nodes){
  const node=currentNode(arena,raw);
  const platform=arena.platforms.find(surface=>surface.id===node.platformId);
  if(!platform?.active)continue;
  const score=Math.abs(node.x-point.x)+Math.abs(node.y-point.y)*1.9+(platformId!==undefined&&platformId!==null&&node.platformId!==platformId?350:0);
  if(score<bestDistance){best=node;bestDistance=score;}
 }
 return best;
}

class Queue {
 private values:{id:number;cost:number}[]=[];
 push(value:{id:number;cost:number}):void {const list=this.values;list.push(value);let index=list.length-1;while(index>0){const parent=(index-1)>>1;if(list[parent]!.cost<=value.cost)break;list[index]=list[parent]!;index=parent;}list[index]=value;}
 pop():{id:number;cost:number}|undefined {const list=this.values;if(!list.length)return undefined;const result=list[0]!,last=list.pop()!;if(list.length){let index=0;while(index*2+1<list.length){let child=index*2+1;if(child+1<list.length&&list[child+1]!.cost<list[child]!.cost)child++;if(last.cost<=list[child]!.cost)break;list[index]=list[child]!;index=child;}list[index]=last;}return result;}
}

/** A* over live platform identities. Optional risk penalties let tactical bots
 * choose a safe detour without changing physical movement rules. */
export function findRoute(arena:Arena,from:Vec,to:Vec,platformId?:number|null,risk?:(node:NavNode)=>number):NavigationPath|null {
 const start=nearestNode(arena,from,platformId),goal=nearestNode(arena,to);
 if(!start||!goal)return null;
 const frontier=new Queue();frontier.push({id:start.id,cost:0});
 const costs=new Map<number,number>([[start.id,0]]),parents=new Map<number,{from:number;edge:NavEdge}>();
 while(true){
  const next=frontier.pop();if(!next)break;
  if(next.id===goal.id){
   const nodes:NavNode[]=[arena.nav.nodes[goal.id]!],edges:NavEdge[]=[];let current=goal.id;
   while(current!==start.id){const previous=parents.get(current);if(!previous)return null;edges.push(previous.edge);nodes.push(arena.nav.nodes[previous.from]!);current=previous.from;}
   return{nodes:nodes.reverse(),edges:edges.reverse(),cost:costs.get(goal.id)!};
  }
  const current=arena.nav.nodes[next.id];if(!current)continue;
  for(const edge of arena.nav.edges[next.id]??[]){
   const raw=arena.nav.nodes[edge.to];if(!raw)continue;
   const target=currentNode(arena,raw);
   if(!arena.platforms.some(platform=>platform.id===target.platformId&&platform.active))continue;
   const cost=costs.get(next.id)!+edge.cost+(risk?.(target)??0);
   if(cost>=(costs.get(edge.to)??Infinity))continue;
   costs.set(edge.to,cost);parents.set(edge.to,{from:next.id,edge});
   frontier.push({id:edge.to,cost:cost+distance(target,goal)*.35});
  }
 }
 return null;
}

/** Cached route execution runs every frame; costly graph searches run only on
 * new goals, geometry changes, or failed progress. */
export class Navigator {
 path:NavigationPath|null=null;
 goal?:Vec;
 private graph?:NavGraph;
 private index=1;
 private plannedAt=-Infinity;
 private previous?:Vec;
 private checkedAt=0;
 private stuckFor=0;
 private jumpAt=-Infinity;
 private recoveredAt=-Infinity;
 private traversal?:Traversal;

 reset():void {this.path=null;this.goal=undefined;this.graph=undefined;this.index=1;this.plannedAt=-Infinity;this.previous=undefined;this.checkedAt=0;this.stuckFor=0;this.jumpAt=-Infinity;this.recoveredAt=-Infinity;this.traversal=undefined;}
 setGoal(state:MatchState,soldier:Soldier,goal:Vec):void {
  const traversing=this.traversal?.path===this.path&&this.traversal.phase!=='approach'&&(!soldier.grounded||soldier.climbing);
  if(this.goal&&distance(this.goal,goal)<60&&this.graph===state.arena.nav&&(state.time-this.plannedAt<2||traversing)&&this.path)return;
  const risk=(node:NavNode):number=>{
   let value=0;
   for(const hazard of state.arena.hazards)if(hazard.damage>0&&hazard.starts<state.time+2&&hazard.ends>state.time&&node.x>hazard.x-20&&node.x<hazard.x+hazard.w+20&&node.y>hazard.y&&node.y<hazard.y+hazard.h+54)value+=1100;
   if(node.y>state.weather.floodY-30)value+=850;
   return value;
  };
  this.path=findRoute(state.arena,soldier,goal,soldier.grounded?soldier.platformId:undefined,risk);
  this.goal={...goal};this.graph=state.arena.nav;this.index=1;this.plannedAt=state.time;this.traversal=undefined;
 }
 clear():void {this.path=null;this.goal=undefined;this.traversal=undefined;}
 getAction(state:MatchState,soldier:Soldier):Action {
  if(!this.goal)return{};
  if(state.time-this.checkedAt>.9){
   const progress=this.previous?distance(this.previous,soldier):100;
   this.stuckFor=progress<10?this.stuckFor+(state.time-this.checkedAt):0;
   this.previous={x:soldier.x,y:soldier.y};this.checkedAt=state.time;
   if(this.stuckFor>2.8){this.path=null;this.plannedAt=-Infinity;this.stuckFor=0;}
  }
  if(this.graph!==state.arena.nav||!this.path)this.setGoal(state,soldier,this.goal);
  const path=this.path;
  if(!path){const jump=soldier.grounded&&state.time-this.jumpAt>1;if(jump)this.jumpAt=state.time;return{move:Math.abs(this.goal.x-soldier.x)>25?this.goal.x>soldier.x?1:-1:0,jump};}
  while(this.index<path.nodes.length){
   const target=currentNode(state.arena,path.nodes[this.index]!);
   const edge=path.edges[this.index-1]!;
   if(Math.abs(soldier.x-target.x)<24&&Math.abs(soldier.y-target.y)<12&&soldier.grounded&&soldier.platformId===target.platformId){this.index++;this.traversal=undefined;}
   else break;
  }
  if(this.index>=path.nodes.length){
   const dx=this.goal.x-soldier.x;
   return{move:Math.abs(dx)>20?(dx>0?1:-1):0};
  }
  const source=currentNode(state.arena,path.nodes[this.index-1]!);
  const target=currentNode(state.arena,path.nodes[this.index]!);
  const edge=path.edges[this.index-1]!;
  // A jump may land on an intervening ledge before its nominal
  // destination. Replan from that real support instead of repeatedly jumping
  // on the higher ledge while trying to reach a lower cover top.
  if(soldier.grounded&&soldier.platformId!==null&&soldier.platformId!==source.platformId&&soldier.platformId!==target.platformId&&this.recoveredAt!==state.time){
   this.recoveredAt=state.time;this.path=null;this.plannedAt=-Infinity;
   this.setGoal(state,soldier,this.goal);
   return this.getAction(state,soldier);
  }
  const dx=target.x-soldier.x,dy=target.y-soldier.y;
  const move:Action['move']=Math.abs(dx)>10?(dx>0?1:-1):0;
  // A replanned route may start on a nearby support while the body is still
  // attached to its ladder. Jump free instead of hanging with zero climb input.
  if(soldier.climbing&&edge.kind!=='ladder'&&edge.kind!=='drop'){
   const jump=state.time-this.jumpAt>.65;if(jump)this.jumpAt=state.time;
   return{move,jump};
  }
  if(edge.kind==='ladder'){
   const ladder=state.arena.ladders.find(value=>value.id===edge.ladderId);
   const viaX=edge.viaX??(ladder?ladder.x+ladder.w/2:target.x),exitY=edge.exitY??target.y-32;
   const direction:Action['climb']=target.y>source.y?1:-1;
   const traversal=this.edgeTraversal(path);
   const toward=(x:number,tolerance=3):Action['move']=>Math.abs(x-soldier.x)>tolerance?x>soldier.x?1:-1:0;
   if(traversal.phase==='approach'){
    if(Math.abs(soldier.x-viaX)>4)return{move:toward(viaX),climb:Math.abs(soldier.x-viaX)<32?direction:0};
    traversal.phase='climb';
   }
   if(traversal.phase==='climb'){
    const reached=direction<0?soldier.y<=exitY+1:soldier.y>=exitY-1;
    if(!reached)return{climb:direction,move:toward(viaX)};
    if(Math.abs(target.x-viaX)<8)return{climb:direction,move:toward(target.x)};
    traversal.phase='exit';
   }
   if(traversal.phase==='exit'){
    const platform=state.arena.platforms.find(value=>value.id===target.platformId);
    const overLip=platform&&soldier.x>=platform.x+15&&soldier.x<=platform.x+platform.w-15;
    if(overLip){traversal.phase='land';return{};}
    // Keep the feet above the solid lip during the diagonal exit. Descending
    // through its rectangle is never used as a shortcut to the landing.
    return{climb:-1,move:toward(target.x,1)};
   }
   if(soldier.climbing){
    const jump=state.time-this.jumpAt>.65;if(jump)this.jumpAt=state.time;
    return{move:toward(target.x,8),jump};
   }
   return{move:soldier.grounded?toward(target.x,8):0};
  }
  if(edge.kind==='lift'){
   const currentPlatform=state.arena.platforms.find(platform=>platform.id===soldier.platformId);
   const destination=state.arena.platforms.find(platform=>platform.id===target.platformId);
   if(currentPlatform?.moving){
    if(Math.abs(dy)<115&&Math.abs(dx)<230){const jump=dy<-15&&soldier.grounded&&state.time-this.jumpAt>.7;if(jump)this.jumpAt=state.time;return{move,jump};}
    return{move:Math.abs(soldier.x-(currentPlatform.x+currentPlatform.w/2))>24?soldier.x<currentPlatform.x+currentPlatform.w/2?1:-1:0};
   }
   if(destination?.moving&&Math.abs(dy)>115)return{move:Math.abs(soldier.x-source.x)>25?source.x>soldier.x?1:-1:0};
   const jump=soldier.grounded&&state.time-this.jumpAt>.8;if(jump)this.jumpAt=state.time;
   return{move,jump};
  }
  if(edge.kind==='jump'){
   const destination=state.arena.platforms.find(platform=>platform.id===target.platformId);
   const acrossDestination=destination&&soldier.y>destination.y+1&&soldier.y-54<destination.y+destination.h
    &&Math.min(soldier.x,source.x)<destination.x+destination.w+14&&Math.max(soldier.x,source.x)>destination.x-14;
   // A nearest-node replan can put the authored launch on the opposite side
   // of a crate. Its near side is also a valid launch; walking to the far side
   // first would press forever against the same solid crate.
   if(soldier.grounded&&Math.abs(soldier.y-source.y)<15&&!acrossDestination){
    const offset=source.x-soldier.x;
    // Match the graph's standing launch: arriving at running speed can put
    // the head below a solid foothold before the upward arc clears its side.
    if(Math.abs(offset)>3){
     const stopping=soldier.vx*soldier.vx/(2*PHYSICS.friction)+Math.abs(soldier.vx)/60+2;
     return{move:offset*soldier.vx>0&&Math.abs(offset)<=stopping?0:offset>0?1:-1};
    }
    if(Math.abs(soldier.vx)>20)return{move:0};
   }
   const jump=soldier.grounded&&state.time-this.jumpAt>.65;
   if(jump)this.jumpAt=state.time;
   return{move,jump};
  }
  if(edge.kind==='drop'){
   const platform=state.arena.platforms.find(surface=>surface.id===source.platformId);
   const traversal=this.edgeTraversal(path),viaX=edge.viaX??(platform?(target.x<source.x?platform.x-24:platform.x+platform.w+24):target.x);
   if(traversal.phase==='approach'){
    const outside=!platform||soldier.x+14<=platform.x||soldier.x-14>=platform.x+platform.w;
    if(!outside||Math.abs(soldier.x-viaX)>3)return{move:viaX>soldier.x?1:-1};
    traversal.phase='fall';
   }
   const clear=!platform||soldier.y-54>=platform.y+platform.h||soldier.grounded&&soldier.platformId===target.platformId;
   const x=clear?target.x:viaX;
   return{move:Math.abs(x-soldier.x)>5?x>soldier.x?1:-1:0};
  }
  return{move,jump:this.stuckFor>1.5&&soldier.grounded&&state.time-this.jumpAt>.8};
 }
 private edgeTraversal(path:NavigationPath):Traversal {
  if(this.traversal?.path!==path||this.traversal.index!==this.index)this.traversal={path,index:this.index,phase:'approach'};
  return this.traversal;
 }
}
