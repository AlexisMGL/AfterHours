import { Random } from '../../core/random';
import type { Arena, ArenaDecoration, ArenaSection, Palette, Platform, PlatformSkin, Vec } from '../core/types';

/** Aircraft scenery lives on the rear fuselage wall. Every cargo item,
 * machine, stair and gallery in the combat plane is collision geometry. */
export function createSkybreach(seed:number,palette:Palette):Arena {
 const random=new Random(seed^0x42b65a91);
 let platformId=1,ladderId=1;
 const arena:Arena={id:'aircraft',name:'SKYBREACH',width:4800,height:1200,platforms:[],ladders:[],spawns:[],crateSpawns:[],flagSpawns:[],nav:{nodes:[],edges:{}},hazards:[],palette:{...palette},decorations:[],sections:[]};
 const sections:ArenaSection[]=[
  {id:'ramp',name:'01 / LOADING RAMP',x:0,w:720,color:'#385e72',accent:'#8dddef'},
  {id:'heavy-cargo',name:'02 / HEAVY CARGO',x:720,w:930,color:'#6b6457',accent:'#ffbf78'},
  {id:'supply',name:'03 / SUPPLY HOLD',x:1650,w:1000,color:'#416f65',accent:'#a4dfb7'},
  {id:'service',name:'04 / CREW SERVICE',x:2650,w:800,color:'#655a76',accent:'#d2baf0'},
  {id:'avionics',name:'05 / AVIONICS',x:3450,w:720,color:'#3e657c',accent:'#8bdaf0'},
  {id:'flightdeck',name:'06 / FLIGHT DECK',x:4170,w:630,color:'#6a8190',accent:'#f3d79b'},
 ];
 arena.sections=sections;
 const addPlatform=(x:number,y:number,w:number,h:number,skin:PlatformSkin,options:Partial<Platform>={}):Platform=>{
  const platform:Platform={id:platformId++,x,y,w,h,skin,oneWay:false,material:'metal',active:true,...options};arena.platforms.push(platform);return platform;
 };
 const tiers=new Map<number,Platform[]>();
 const ground=addPlatform(0,1120,4800,80,'deck',{color:'#536b7c',label:'LOWER CARGO DECK'});tiers.set(1120,[ground]);
 const floors:[number,[number,number][]][]=[
  [900,[[220,650],[1210,2040],[2230,2690],[2900,3410],[3650,4140],[4310,4740]]],
  [680,[[100,700],[880,1520],[1690,2270],[2460,3070],[3250,3900],[4080,4740]]],
  [460,[[500,1200],[1390,2050],[2240,2860],[3050,3700],[3890,4730]]],
 ];
 for(const[y,spans]of floors){
  const platforms=spans.map(([x,end],index)=>addPlatform(x,y,end-x,y===460?18:24,y===460?'catwalk':'deck',{oneWay:true,color:sections.find(section=>x>=section.x&&x<section.x+section.w)?.color,label:y===460?'OVERHEAD SERVICE':`GALLERY ${index+1}`}));
  tiers.set(y,platforms);
 }
 for(const y of [900,680,460])for(const upper of tiers.get(y)!){
  const lower=tiers.get(y+220)!;
  const spans=lower.map(platform=>({left:Math.max(platform.x,upper.x)+45,right:Math.min(platform.x+platform.w,upper.x+upper.w)-45})).filter(span=>span.right-span.left>55);
  const first=spans[0]!,last=spans.at(-1)!;
  const positions=[first.left+Math.min(64,(first.right-first.left)*.23),last.right-Math.min(64,(last.right-last.left)*.23)];
  for(const x of positions)arena.ladders.push({id:ladderId++,x:x-20,y:y-58,w:40,h:283});
 }
 for(const team of [0,1] as const)for(const y of [1120,900,680,460]){
  const platform=team===0?tiers.get(y)![0]!:tiers.get(y)!.at(-1)!;
  const x=team===0?platform.x+110:platform.x+platform.w-110;
  arena.spawns.push({x,y,team},{x:team===0?x+130:x-130,y,team});
 }
 arena.flagSpawns=[{x:1510,y:900},{x:2450,y:460},{x:3780,y:680}];
 arena.crateSpawns=[{x:565,y:1120},{x:4200,y:1120},{x:1740,y:900},{x:3900,y:900},{x:1180,y:680},{x:3590,y:680},{x:1730,y:460},{x:4480,y:460}];
 const reserved=(x:number,y:number,w:number):boolean=>{
  const left=x-24,right=x+w+24;
  return [...arena.spawns,...arena.crateSpawns,...arena.flagSpawns].some(point=>point.y>=y-5&&point.y<=y+135&&point.x>left-50&&point.x<right+50)
   ||arena.ladders.some(ladder=>y+130>=ladder.y&&y<=ladder.y+ladder.h&&ladder.x+ladder.w/2>left-14&&ladder.x+ladder.w/2<right+14);
 };
 const cargoColors=['#4e91ad','#df9659','#579f8d','#9a81b1','#b49b62'];
 const prop=(x:number,feet:number,w:number,h:number,skin:PlatformSkin,label:string,color?:string,hp?:number):Platform=>addPlatform(x,feet-h,w,h,skin,{label,color:color??cargoColors[random.int(cargoColors.length)],hp:hp??180+random.int(100),material:skin==='pallet'||skin==='supply-crate'?'wood':'metal'});

 // The open cargo bay is a real stepped stack, rather than a decal pasted
 // across a generic floor. Both stack tops are reachable in ordinary jumps.
 prop(785,1120,290,110,'cargo-orange','CARGO 7A','#d99557',300);
 prop(905,1010,170,104,'cargo-blue','7A / UPPER','#579abb',230);
 addPlatform(725,1010,75,18,'pallet',{oneWay:true,material:'wood',color:'#ac8b61',label:'RAMP STEP'});
 arena.crateSpawns.push({x:990,y:906});
 // A second stepped freight island creates a different central silhouette.
 prop(1980,1120,235,102,'cargo-green','SUPPLY 04','#589f8b',280);
 prop(2100,1018,115,96,'strapped-case','04 / FIELD KIT','#6987a4',200);
 arena.crateSpawns.push({x:2157,y:922});

 // Intermediate footholds are laid out before cover so props retain enough
 // headroom for a full soldier body underneath these physical decks.
 for(const[x,y,w,skin]of [[1120,1010,100,'pallet'],[3100,1010,115,'catwalk'],[1350,790,120,'catwalk'],[4230,790,120,'catwalk'],[1580,570,120,'catwalk'],[3320,570,120,'catwalk']] as[number,number,number,PlatformSkin][]){
  addPlatform(x,y,w,16,skin,{oneWay:true,color:skin==='pallet'?'#af936c':'#7394a5'});
 }
 addPlatform(2260,790,280,16,'catwalk',{oneWay:true,color:'#6d9a9d',label:'EMERGENCY CROSSING',hp:200});

 // Curated cover is varied in width, height, material and tactical use. Its
 // colors and silhouettes communicate the section even without a backdrop.
 const props:[number,number,number,number,PlatformSkin,string,string][]=[
  [395,1120,92,68,'pallet','RAMP PALLET','#b9986f'],
  [1220,1120,116,94,'fuel-barrels','AUX FUEL','#719ab2'],
  [1570,1120,118,79,'strapped-case','FLIGHT SUPPLY','#9294bd'],
  [1835,1120,112,78,'medical','MEDICAL','#72ab99'],
  [2540,1120,122,104,'engine','HYDRAULICS','#70899b'],
  [2860,1120,102,74,'service-cart','CREW SERVICE','#9a86ae'],
  [3195,1120,94,92,'fuel-drum','COOLANT','#68a0b1'],
  [3505,1120,108,108,'avionics','POWER RELAY','#5486ab'],
  [3900,1120,110,88,'supply-crate','NAV STORES','#bb9e6c'],
  [4440,1120,116,108,'avionics','NOSE BATTERY','#7397aa'],
  [1835,900,104,78,'cargo-green','AIRLIFT 03','#68a58b'],
  [2460,900,96,78,'strapped-case','COMMS KIT','#9b8cae'],
  [3125,900,116,92,'engine','ENV CONTROL','#6e94a2'],
  [3975,900,96,74,'medical','TRAUMA KIT','#7db5a5'],
  [4550,900,92,106,'avionics','FLIGHT DATA','#659bc3'],
  [1135,680,92,72,'supply-crate','AIRFRAME KIT','#bb9968'],
  [1945,680,110,82,'cargo-orange','PRIORITY 02','#d7975c'],
  [2750,680,98,76,'service-cart','MAINTENANCE','#a798bb'],
  [3620,680,96,96,'avionics','RADAR LINK','#5c9daf'],
  [4420,680,108,90,'bulkhead','FLIGHT CONTROL','#7b94aa'],
  [960,460,94,66,'strapped-case','OXYGEN','#738ca7'],
  [1900,460,96,70,'supply-crate','SERVICE 02','#b1a27b'],
  [2610,460,94,72,'service-cart','LIFE SUPPORT','#9787a7'],
  [3480,460,110,80,'engine','AIR DUCT','#7197a0'],
  [4570,460,94,76,'avionics','FLIGHT RECORDER','#659fc0'],
 ];
 for(const[x,feet,w,h,skin,label,color]of props){
  const jitter=Math.round((random.next()-.5)*18);
  const position=[0,45,-45,90,-90,135,-135,180,-180,225,-225].map(offset=>x+jitter+offset).find(candidate=>{
   if(reserved(candidate,feet-h,w))return false;
   if(!arena.platforms.some(platform=>platform.active&&Math.abs(platform.y-feet)<2&&candidate>=platform.x+20&&candidate+w<=platform.x+platform.w-20))return false;
   return !arena.platforms.some(platform=>platform.active&&platform.y<feet-2&&platform.y+platform.h>feet-h-55&&candidate+w+18>platform.x&&candidate-18<platform.x+platform.w);
  });
  if(position!==undefined)prop(position,feet,w,h,skin,label,color);
 }

 const decorate=(kind:ArenaDecoration['kind'],x:number,y:number,w:number,h:number,section:ArenaSection,extra:Partial<ArenaDecoration>={}):void=>{arena.decorations!.push({kind,x,y,w,h,section:section.id,color:section.color,accent:section.accent,...extra});};
 for(const section of sections){
  decorate('panel',section.x+22,90,section.w-44,970,section);
  decorate('sign',section.x+70,570,Math.min(340,section.w-125),46,section,{label:section.name});
  decorate('pipe',section.x+40,350,section.w-80,14,section,{color:'#86a4b5'});
  decorate('pipe',section.x+52,1068,section.w-104,10,section,{color:'#6d899a'});
  for(let x=section.x+35;x<section.x+section.w-20;x+=285){
   decorate('rib',x,75,18,1015,section,{color:'#7696a9'});
   decorate('light',x+45,398,115,10,section);
   decorate('light',x+45,990,100,10,section);
  }
  if(section.id==='ramp'){
   decorate('window',section.x+75,720,240,185,section,{color:'#93b7c9',label:'OPEN RAMP'});
   decorate('hatch',section.x+360,735,185,215,section,{label:'RAMP ACTUATOR'});
  }else if(section.id==='heavy-cargo'||section.id==='supply'){
   decorate('cargo-net',section.x+80,740,section.w-180,270,section,{color:'#97aab5'});
   decorate('window',section.x+110,115,185,100,section,{color:'#9ec5d1'});
   decorate('window',section.x+390,115,185,100,section,{color:'#9ec5d1'});
  }else if(section.id==='service'){
   decorate('fan',section.x+70,740,128,128,section);
   decorate('hatch',section.x+350,730,185,220,section,{label:'CREW ACCESS'});
   decorate('pipe',section.x+235,690,18,280,section,{color:'#ada6bd'});
   decorate('window',section.x+100,115,230,100,section,{color:'#b7b9d1'});
  }else if(section.id==='avionics'){
   decorate('panel',section.x+100,735,220,195,section,{color:'#34637b'});
   decorate('fan',section.x+410,760,110,110,section);
   decorate('window',section.x+120,115,220,100,section,{color:'#9ec9da'});
  }else{
   decorate('window',section.x+60,110,section.w-120,165,section,{color:'#b0d3dd',label:'FLIGHT DECK'});
   decorate('window',section.x+145,740,220,130,section,{color:'#94b9c9'});
   decorate('hatch',section.x+395,735,120,195,section,{label:'CREW ONLY'});
  }
 }

 // Compose actual rooms around the combat geometry. These recessed tableaux
 // are attached to the pressure hull, while the crates in front stay physical.
 // A gallery can be split into real ladder shafts afterwards without any
 // background beam repainting the hole as a walkable surface.
 for(const section of sections){
  decorate('pipe',section.x+38,304,section.w-76,35,section,{motif:'ceiling-duct',color:section.id==='service'?'#a18c97':'#81989a'});
  if(section.x>0)decorate('rib',section.x-24,55,56,1030,section,{motif:'pressure-frame'});
  for(const y of[475,915])decorate('light',section.x+section.w*.13,y,section.w*.7,190,section,{motif:'light-pool'});
 }
 const ramp=sections[0]!,freight=sections[1]!,supply=sections[2]!,service=sections[3]!,avionics=sections[4]!,flight=sections[5]!;
 decorate('window',24,719,650,373,ramp,{motif:'ramp-vista'});
 decorate('hatch',763,720,843,367,freight,{motif:'freight-recess'});
 decorate('panel',788,118,774,356,freight,{motif:'cargo-crane',color:'#b28d61'});
 decorate('hatch',1725,136,840,247,supply,{motif:'supply-lockers'});
 decorate('hatch',1700,733,855,350,supply,{motif:'freight-recess',color:'#65917c'});
 decorate('hatch',2691,728,700,357,service,{motif:'medical-bay',accent:'#b9e3c5'});
 decorate('panel',2735,120,633,241,service,{motif:'supply-lockers',color:'#8f829f'});
 decorate('panel',3510,728,603,357,avionics,{motif:'cable-wall'});
 decorate('panel',3504,115,600,246,avionics,{motif:'cable-wall',accent:'#d7b576'});
 decorate('window',4218,115,530,252,flight,{motif:'flight-glass'});
 decorate('window',4210,726,544,286,flight,{motif:'flight-glass'});
 // Small, authored interruptions: a slack restraint under the cargo hoist,
 // a disconnected service cable and a dangling harness above avionics.
 decorate('pipe',1270,360,265,148,freight,{motif:'loose-cable',accent:'#d7aa79'});
 decorate('pipe',3027,367,240,167,service,{motif:'loose-cable'});
 decorate('pipe',3850,954,216,125,avionics,{motif:'loose-cable',accent:'#b8d5b0'});
 for(const platform of arena.platforms.filter(platform=>platform.oneWay&&platform.w>=200)){
  const section=sections.find(section=>platform.x>=section.x&&platform.x<section.x+section.w)??ramp;
  const braceWidth=Math.min(108,platform.w*.22);
  for(const x of[platform.x+13,platform.x+platform.w-braceWidth-13])
   decorate('rib',x,platform.y+platform.h+11,braceWidth,142,section,{motif:'gallery-brace'});
 }
 return arena;
}
