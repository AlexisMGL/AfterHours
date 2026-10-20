import { Random } from '../../core/random';
import { PHYSICS } from '../core/config';
import type { Arena, MapId, NavEdge, NavGraph, NavNode, Palette, Platform, Vec } from '../core/types';
import { createSkybreach } from './skybreach';
import { LADDER_HEADROOM, openPhysicalShafts } from './solid-layout';
import { jumpReachable } from './jump-navigation';

export interface MapDefinition { id:MapId;name:string;subtitle:string;description:string;mechanic:string;palette:Palette }
export const MAPS:MapDefinition[]=[
 {id:'aircraft',name:'SKYBREACH',subtitle:'Cargo Aircraft',description:'Six connected aircraft sections: an open ramp, stepped freight holds, crew service, avionics and the flight deck.',mechanic:'Real cargo cover, overhead flanks, turbulence and ramp depressurization.',palette:{sky:'#203e58',far:'#385972',near:'#496f87',ground:'#536b7c',edge:'#aec9d5',accent:'#f3bb65'}},
 {id:'factory',name:'CINDERLINE',subtitle:'Factory',description:'Four stories of assembly lines, industrial elevators and furnace-lit steel.',mechanic:'Conveyors, warning steam, elevators and a rolling power failure.',palette:{sky:'#23262f',far:'#353d47',near:'#4d5862',ground:'#4b535e',edge:'#91a0aa',accent:'#ffa05c'}},
 {id:'forest',name:'VERDANT FRONT',subtitle:'Forest',description:'Abandoned bunkers beneath cliff paths, tree bridges and lookout towers.',mechanic:'Changing rain and fog, falling timber and clearly marked wildfire.',palette:{sky:'#829b9a',far:'#385854',near:'#284841',ground:'#526247',edge:'#8c9a70',accent:'#b7dc9a'}},
 {id:'city',name:'BLACKOUT DISTRICT',subtitle:'City',description:'Cross ruined apartments, rooftops and covered streets in a neon-lit urban district.',mechanic:'Breakable cover, outages and telegraphed structural damage.',palette:{sky:'#24233e',far:'#35334c',near:'#4d4b60',ground:'#545868',edge:'#9296ad',accent:'#b5a0f4'}},
 {id:'harbor',name:'IRON TIDE',subtitle:'Harbor',description:'Container stacks, warehouses and high crane gantries overlook a busy commercial port.',mechanic:'Travelling crane cargo, signalled container deliveries and coastal squalls.',palette:{sky:'#34556d',far:'#335063',near:'#426678',ground:'#5f6870',edge:'#99afb9',accent:'#e9c87f'}},
 {id:'ship',name:'TEMPEST',subtitle:'Ship',description:'From the engine room to the bridge, hold a massive ship against a rising storm.',mechanic:'Ship rolling, escalating rain, lightning and a gradually flooding lower deck.',palette:{sky:'#1d3448',far:'#284b60',near:'#3a5a70',ground:'#526271',edge:'#8da9bc',accent:'#6fd9df'}},
];

const WIDTH=4800,HEIGHT=1200,FLOOR=1120;
type Span=[number,number];
type Layout=Record<number,Span[]>;
const layouts:Record<Exclude<MapId,'aircraft'>,Layout>={
 factory:{900:[[140,1100],[1230,2160],[2290,3330],[3460,4660]],680:[[360,1380],[1510,2480],[2610,3560],[3690,4680]],460:[[620,1640],[1770,2870],[3000,4240]]},
 forest:{900:[[120,1030],[1170,2190],[2330,3440],[3580,4680]],680:[[300,1260],[1400,2430],[2570,3630],[3770,4700]],460:[[590,1530],[1670,2710],[2850,4190]]},
 city:{900:[[120,940],[1080,2060],[2200,3220],[3360,4680]],680:[[400,1400],[1540,2640],[2780,3800],[3940,4680]],460:[[700,1400],[1760,2640],[3010,3980]]},
 harbor:{900:[[180,1220],[1360,2380],[2520,3480],[3620,4640]],680:[[480,1380],[1520,2640],[2780,3860],[4000,4700]],460:[[940,1880],[2020,3020],[3160,4200]]},
 ship:{900:[[100,1460],[1600,3050],[3190,4700]],680:[[300,1280],[1420,2680],[2820,4500]],460:[[900,1900],[2040,3500],[3640,4300]]},
};

export function createArena(id:MapId,seed:number):Arena {
 const definition=MAPS.find(map=>map.id===id);
 if(!definition)throw new Error(`Unknown frontline map: ${id}`);
 if(id==='aircraft'){const arena=createSkybreach(seed,definition.palette);openPhysicalShafts(arena);arena.nav=buildNavigation(arena);return arena;}
 const random=new Random(seed^Math.imul(MAPS.indexOf(definition)+1,0x45d9f3b));
 let nextId=1;
 const material=id==='forest'?'wood':id==='city'?'stone':'metal';
 const floor:Platform={id:nextId++,x:0,y:FLOOR,w:WIDTH,h:80,oneWay:false,material,active:true};
 const arena:Arena={id,name:definition.name,width:WIDTH,height:HEIGHT,platforms:[floor],ladders:[],spawns:[],crateSpawns:[],flagSpawns:[],nav:{nodes:[],edges:{}},hazards:[],palette:{...definition.palette}};
 const tiers=new Map<number,Platform[]>([[FLOOR,[floor]]]);
 for(const y of [900,680,460]){
  const platforms:Platform[]=layouts[id][y]!.map(([x,end])=>({id:nextId++,x,y,w:end-x,h:id==='forest'?24:22,oneWay:true,material,active:true,...(id==='factory'&&y===900?{conveyor:x<2400?36:-36}:{})}));
  arena.platforms.push(...platforms);tiers.set(y,platforms);
 }
 // Every gallery has two independent permanent ladder routes to the floor
 // below. A destroyed optional bridge or a moving lift cannot strand a flag.
 let ladderId=1;
 for(const y of [900,680,460]){
  const lower=tiers.get(y+220)!;
  for(const upper of tiers.get(y)!){
   const overlaps=lower.map(platform=>({left:Math.max(platform.x,upper.x)+48,right:Math.min(platform.x+platform.w,upper.x+upper.w)-48})).filter(span=>span.right-span.left>=70);
   const first=overlaps[0]!,last=overlaps.at(-1)!;
   const positions=[first.left+Math.min(75,(first.right-first.left)/3),last.right-Math.min(75,(last.right-last.left)/3)];
   for(const x of positions)arena.ladders.push({id:ladderId++,x:x-20,y:y-58,w:40,h:283});
  }
 }
 // Low intermediate footholds add an accessible jumping route alongside the
 // ladders. The 110 px rise is below the real 140 px ballistic jump apex.
 for(const y of [1010,790,570]){
  const upper=tiers.get(y-110)!;
  const choices=[upper[0]!,upper.at(-1)!];
  for(let index=0;index<choices.length;index++){
   const support=choices[index]!;
   const x=index===0?support.x+support.w*.62:support.x+support.w*.28;
   arena.platforms.push({id:nextId++,x:x-65,y,w:130,h:16,oneWay:true,material,active:true});
  }
 }
 // Team spawning spans three heights; no team is forced to climb from a
 // single vulnerable corner. Engine selects the safest appropriate point.
 for(const team of [0,1] as const){
  for(const y of [1120,900,680,460]){
   const candidates=tiers.get(y)!;
   const platform=team===0?candidates[0]!:candidates.at(-1)!;
   const x=team===0?platform.x+110:platform.x+platform.w-110;
   arena.spawns.push({x,y,team},{x:team===0?x+130:x-130,y,team});
  }
 }
 const flagSurface=(y:number,preferred:number):Vec=>{
  const surfaces=tiers.get(y)!;
  const delta=(platform:Platform):number=>Math.abs(Math.max(platform.x+110,Math.min(platform.x+platform.w-110,preferred))-preferred);
  const surface=surfaces.reduce((best,platform)=>delta(platform)<delta(best)?platform:best);
  return{x:Math.max(surface.x+110,Math.min(surface.x+surface.w-110,preferred)),y};
 };
 arena.flagSpawns=[flagSurface(900,1120),flagSurface(460,2400),flagSurface(680,3680)];
 for(const y of [1120,900,680,460]){
  const surfaces=tiers.get(y)!;
  const first=surfaces[0]!,last=surfaces.at(-1)!;
  arena.crateSpawns.push({x:first.x+first.w*.48,y},{x:last.x+last.w*.52,y});
 }
 const safeAt=(x:number,y:number):boolean=>![...arena.spawns,...arena.flagSpawns,...arena.crateSpawns].some(point=>Math.abs(point.y-y)<80&&Math.abs(point.x-x)<120)&&!arena.ladders.some(ladder=>y>=ladder.y&&y<=ladder.y+ladder.h&&Math.abs(ladder.x+ladder.w/2-x)<76)&&!arena.platforms.some(platform=>platform.hp!==undefined&&!platform.oneWay&&Math.abs(platform.y+platform.h-y)<3&&Math.abs(platform.x+platform.w/2-x)<160);
 for(const [y,surfaces]of tiers){
  for(const support of surfaces){
   const number=y===1120?6:2;
   for(let n=0;n<number;n++){
    const width=72+random.int(35),height=62+random.int(35);
    let x=support.x+80+(support.w-160)*(n+.45)/number+(random.next()-.5)*110;
    for(let attempt=0;attempt<8&&!safeAt(x,y);attempt++)x=support.x+70+random.next()*(support.w-140);
    if(!safeAt(x,y))continue;
    arena.platforms.push({id:nextId++,x:x-width/2,y:y-height,w:width,h:height,oneWay:false,material:id==='city'&&n%2===0?'glass':material,active:true,hp:130+random.int(100)});
   }
  }
 }
 // Optional geometry gives the six arenas different silhouettes and genuinely
 // different shortcuts, while the permanent four-tier backbone stays intact.
 if(id==='factory')for(const x of [1150,3380])arena.platforms.push({id:nextId++,x,y:1010,w:130,h:18,oneWay:true,material:'metal',active:true,moving:{axis:'y',from:1010,to:570,period:9,phase:x===1150?0:.5}});
 if(id==='harbor')arena.platforms.push({id:nextId++,x:1750,y:570,w:240,h:30,oneWay:true,material:'metal',active:true,moving:{axis:'x',from:1750,to:2950,period:15,phase:0}});
 if(id==='ship')arena.platforms.push({id:nextId++,x:2270,y:1010,w:180,h:18,oneWay:true,material:'metal',active:true,moving:{axis:'y',from:1010,to:790,period:10,phase:.3}});
 if(id==='forest')arena.platforms.push({id:nextId++,x:2210,y:570,w:300,h:20,oneWay:true,material:'wood',active:true,hp:160});
 if(id==='city')arena.platforms.push({id:nextId++,x:2660,y:570,w:320,h:20,oneWay:true,material:'stone',active:true,hp:180});
 openPhysicalShafts(arena);arena.nav=buildNavigation(arena);
 return arena;
}

const peak=PHYSICS.jumpSpeed**2/(2*PHYSICS.gravity);
const bodyBlocked=(arena:Arena,a:Vec,b:Vec,supportId:number):Platform[]=>arena.platforms.filter(platform=>platform.active&&platform.id!==supportId&&platform.x<Math.max(a.x,b.x)+PHYSICS.radius&&platform.x+platform.w>Math.min(a.x,b.x)-PHYSICS.radius&&platform.y<a.y-2&&platform.y+platform.h>a.y-PHYSICS.height+3);

/** Builds a directed platformer graph from live collision geometry. Nodes
 * retain their platform identity so controllers can track moving surfaces. */
export function buildNavigation(arena:Arena):NavGraph {
 const graph:NavGraph={nodes:[],edges:{}};
 const byPlatform=new Map<number,NavNode[]>();
 const active=arena.platforms.filter(platform=>platform.active&&platform.w>=30);
 const addEdge=(from:number,to:number,kind:NavEdge['kind'],cost:number,detail:Partial<NavEdge>={}):void=>{
  if(from===to)return;
  const list=graph.edges[from]!;
  if(!list.some(edge=>edge.to===to&&edge.kind===kind))list.push({to,kind,cost:Math.max(1,cost),...detail});
 };
 for(const platform of active){
  const margin=Math.min(22,platform.w/3),left=platform.x+margin,right=platform.x+platform.w-margin;
  // A full body can stand on a strip narrower than the usual 22px node
  // margin. Keep real lip nodes so cargo next to a shaft does not hide a
  // physically usable landing from the graph.
  const bodyMargin=PHYSICS.radius+.1;
  const positions=[left,right,platform.x+platform.w/2];
  for(const[normal,lip]of [[left,platform.x+bodyMargin],[right,platform.x+platform.w-bodyMargin]]){
   if(bodyBlocked(arena,{x:normal!,y:platform.y},{x:normal!,y:platform.y},platform.id).length
     &&!bodyBlocked(arena,{x:lip!,y:platform.y},{x:lip!,y:platform.y},platform.id).length)positions.push(lip!);
  }
  for(let x=left+130;x<right;x+=130)positions.push(x);
  for(const ladder of arena.ladders){const x=ladder.x+ladder.w/2;if(x>=left&&x<=right&&platform.y>=ladder.y&&platform.y<=ladder.y+ladder.h+4)positions.push(x);}
  for(const point of [...arena.spawns,...arena.flagSpawns,...arena.crateSpawns])if(Math.abs(point.y-platform.y)<3&&point.x>=left&&point.x<=right)positions.push(point.x);
  for(const obstacle of arena.platforms)if(obstacle.active&&obstacle.id!==platform.id&&obstacle.y+obstacle.h>platform.y-4&&obstacle.y<platform.y){
   for(const x of [obstacle.x-PHYSICS.radius-10,obstacle.x+obstacle.w+PHYSICS.radius+10])if(x>=left&&x<=right)positions.push(x);
  }
  // A solid raised foothold must be approached from outside its underside.
  // These launch nodes make the side jump explicit instead of jumping through.
  for(const obstacle of arena.platforms)if(obstacle.active&&!obstacle.moving&&obstacle.id!==platform.id&&platform.y-obstacle.y>4&&platform.y-obstacle.y<=peak-9){
   for(const x of [obstacle.x-PHYSICS.radius-12,obstacle.x+obstacle.w+PHYSICS.radius+12])if(x>=left&&x<=right)positions.push(x);
  }
  const unique=[...new Set(positions.map(value=>Math.round(value*10)/10))].filter(x=>bodyBlocked(arena,{x,y:platform.y},{x,y:platform.y},platform.id).length===0).sort((a,b)=>a-b);
  const nodes=unique.map(x=>{const node={id:graph.nodes.length,x,y:platform.y,platformId:platform.id};graph.nodes.push(node);graph.edges[node.id]=[];return node;});
  byPlatform.set(platform.id,nodes);
  for(let i=1;i<nodes.length;i++){
   const a=nodes[i-1]!,b=nodes[i]!,obstacles=bodyBlocked(arena,a,b,platform.id);
   const kind=obstacles.length===0?'walk':undefined;
   if(kind){addEdge(a.id,b.id,kind,Math.abs(b.x-a.x));addEdge(b.id,a.id,kind,Math.abs(b.x-a.x));}
  }
 }
 const nearest=(nodes:NavNode[],x:number):NavNode=>nodes.reduce((a,b)=>Math.abs(a.x-x)<Math.abs(b.x-x)?a:b);
 for(const ladder of arena.ladders){
  const x=ladder.x+ladder.w/2,upper=ladder.y+LADDER_HEADROOM,lower=ladder.y+ladder.h-5;
  const groups=new Map<number,NavNode[]>();
  for(const node of graph.nodes){
   if((Math.abs(node.y-upper)>2&&Math.abs(node.y-lower)>2)||Math.abs(node.x-x)>92||active.find(platform=>platform.id===node.platformId)?.moving)continue;
   const list=groups.get(node.y)??[];list.push(node);groups.set(node.y,list);
  }
  const levels=[...groups.entries()].map(([y,nodes])=>({y,nodes:[...[-1,0,1].map(side=>nodes.filter(node=>Math.abs(node.x-x)<8?side===0:side===Math.sign(node.x-x)).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0])].filter((node):node is NavNode=>!!node)})).sort((a,b)=>a.y-b.y);
  const connect=(a:NavNode,b:NavNode):void=>addEdge(a.id,b.id,'ladder',Math.abs(a.y-b.y)*1.25+Math.abs(a.x-x)+Math.abs(b.x-x)+55,{ladderId:ladder.id,viaX:x,exitY:Math.abs(b.x-x)<8?b.y:b.y-32});
  for(let index=1;index<levels.length;index++)for(const a of levels[index-1]!.nodes)for(const b of levels[index]!.nodes){connect(a,b);connect(b,a);}
  for(const level of levels)for(const a of level.nodes)for(const b of level.nodes)if((a.x-x)*(b.x-x)<0)connect(a,b);
 }
 const checkedJumps=new Set<string>();
 for(const source of active){
  const sourceNodes=byPlatform.get(source.id)!;
  if(!sourceNodes.length)continue;
  for(const target of active){
   if(source.id===target.id)continue;
   const targetNodes=byPlatform.get(target.id)!;
   if(!targetNodes.length)continue;
   const dy=source.y-target.y;
   if(dy>=-65&&dy<=peak-9){
    const horizontalGap=Math.max(0,target.x-source.x-source.w,source.x-target.x-target.w);
    if(horizontalGap<=115){
     for(const probe of [target.x-PHYSICS.radius-12,target.x+target.w+PHYSICS.radius+12,target.x+22,target.x+target.w/2,target.x+target.w-22,source.x+22,source.x+source.w-22]){
      const x=Math.max(source.x+22,Math.min(source.x+source.w-22,probe));
      const a=nearest(sourceNodes,x),b=nearest(targetNodes,a.x);
      const dx=Math.abs(a.x-b.x);
      const jumpKey=`${a.id}:${b.id}`;
      if(dx<=165&&(Math.abs(dy)>4||dx>5)&&!checkedJumps.has(jumpKey)){
       checkedJumps.add(jumpKey);
       if(jumpReachable(arena,a,b,target.id))addEdge(a.id,b.id,'jump',dx+Math.abs(dy)+90);
      }
     }
    }
   }
  }
  // Descending always walks off a real edge. No floor can be dropped through.
  for(const node of sourceNodes){
   if(node!==sourceNodes[0]&&node!==sourceNodes.at(-1))continue;
   const direction=node===sourceNodes[0]?-1:1;
   let x=direction<0?source.x-24:source.x+source.w+24;
   // Clear the full body from a small underlying overhang before falling.
   // Otherwise a nominal drop can repeatedly catch a 1–2px deck lip.
   for(let pass=0;pass<4;pass++)for(const platform of active){
    if(platform.id===source.id||platform.y<=source.y+8)continue;
    if(x+PHYSICS.radius<=platform.x||x-PHYSICS.radius>=platform.x+platform.w)continue;
    const clear=direction<0?platform.x-PHYSICS.radius-4:platform.x+platform.w+PHYSICS.radius+4;
    if((clear-x)*direction>0&&(clear-x)*direction<=32)x=clear;
   }
   if(bodyBlocked(arena,node,{x,y:source.y},source.id).length)continue;
   const below=active.filter(platform=>platform.id!==source.id&&platform.y>source.y+8&&platform.x<x+PHYSICS.radius&&platform.x+platform.w>x-PHYSICS.radius).sort((a,b)=>a.y-b.y)[0];
   if(below&&byPlatform.get(below.id)!.length){const destination=nearest(byPlatform.get(below.id)!,x);addEdge(node.id,destination.id,'drop',Math.abs(node.x-destination.x)+(below.y-source.y)*.55+45,{viaX:x});}
  }
  if(source.moving){
   const liftNode=nearest(sourceNodes,source.x+source.w/2);
   for(const target of active.filter(platform=>!platform.moving&&platform.id!==source.id&&byPlatform.get(platform.id)!.length)){
    const movement=source.moving;
    const vertical=movement.axis==='y';
    const minY=vertical?Math.min(movement.from,movement.to):source.y-12,maxY=vertical?Math.max(movement.from,movement.to):source.y+12;
    const minX=vertical?source.x:Math.min(movement.from,movement.to),maxX=vertical?source.x+source.w:Math.max(movement.from,movement.to)+source.w;
    if(target.y>=minY-90&&target.y<=maxY+90&&target.x<maxX+80&&target.x+target.w>minX-80){
     const stop=nearest(byPlatform.get(target.id)!,Math.max(target.x+22,Math.min(target.x+target.w-22,source.x+source.w/2)));
     const cost=Math.abs(stop.x-liftNode.x)+Math.abs(stop.y-liftNode.y)+movement.period*85;
     addEdge(stop.id,liftNode.id,'lift',cost);addEdge(liftNode.id,stop.id,'lift',cost);
    }
   }
  }
 }
 return graph;
}

export function validateArena(arena:Arena):{valid:boolean;errors:string[]}{
 const errors:string[]=[];
 if(arena.width<2880||arena.height<900)errors.push('Arena is too small for a multi-screen vertical match.');
 if(arena.flagSpawns.length!==3||new Set(arena.flagSpawns.map(flag=>flag.y)).size<3)errors.push('Exactly three flags on distinct elevations are required.');
 const support=(point:Vec):boolean=>arena.platforms.some(platform=>platform.active&&!platform.moving&&Math.abs(point.y-platform.y)<2&&point.x>=platform.x+PHYSICS.radius&&point.x<=platform.x+platform.w-PHYSICS.radius);
 for(const point of [...arena.spawns,...arena.flagSpawns,...arena.crateSpawns])if(!support(point))errors.push(`Unsupported spawn or objective at ${point.x},${point.y}.`);
 for(const team of [0,1])if(arena.spawns.filter(spawn=>spawn.team===team).length<4)errors.push(`Insufficient distributed spawns for team ${team}.`);
 const graph=arena.nav.nodes.length?arena.nav:buildNavigation(arena);
 const nearest=(point:Vec):NavNode|undefined=>graph.nodes.filter(node=>Math.abs(node.y-point.y)<2).sort((a,b)=>Math.abs(a.x-point.x)-Math.abs(b.x-point.x))[0];
 const start=arena.spawns[0]&&nearest(arena.spawns[0]);
 const seen=new Set<number>();const queue=start?[start.id]:[];
 for(let cursor=0;cursor<queue.length;cursor++){const id=queue[cursor]!;if(seen.has(id))continue;seen.add(id);for(const edge of graph.edges[id]??[])if(!seen.has(edge.to))queue.push(edge.to);}
 for(const point of [...arena.spawns,...arena.flagSpawns,...arena.crateSpawns]){const node=nearest(point);if(!node||!seen.has(node.id))errors.push(`Navigation cannot reach ${point.x},${point.y}.`);}
 for(const platform of arena.platforms.filter(platform=>platform.active&&!platform.moving&&platform.oneWay&&platform.w>=130))if(!graph.nodes.some(node=>node.platformId===platform.id&&seen.has(node.id)))errors.push(`Unreachable gallery ${platform.id}.`);
 if(!arena.ladders.length)errors.push('Missing ladder backbone.');
 return{valid:errors.length===0,errors};
}
