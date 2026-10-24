import { Random } from '../../core/random';
import type { Arena, ArenaDecoration, ArenaSection, Palette, Platform, PlatformSkin } from '../core/types';

/** A cutaway aircraft with three genuinely different ways through its centre:
 * the freight hold, an exposed wing and the outside of the pressure hull. */
export function createSkybreach(seed:number,palette:Palette):Arena {
 const random=new Random(seed^0x42b65a91);
 let platformId=1,ladderId=1;
 const arena:Arena={id:'aircraft',name:'SKYBREACH',width:4800,height:1200,platforms:[],ladders:[],spawns:[],crateSpawns:[],flagSpawns:[],nav:{nodes:[],edges:{}},hazards:[],palette:{...palette},decorations:[],sections:[],aircraftZones:[]};
 const sections:ArenaSection[]=[
  {id:'ramp',name:'01 / OPEN TAIL RAMP',x:0,w:720,color:'#385e72',accent:'#8dddef'},
  {id:'heavy-cargo',name:'02 / FREIGHT & HOIST',x:720,w:930,color:'#6b6457',accent:'#ffbf78'},
  {id:'supply',name:'03 / WING ACCESS',x:1650,w:1000,color:'#416f65',accent:'#a4dfb7'},
  {id:'service',name:'04 / CREW SERVICE',x:2650,w:800,color:'#655a76',accent:'#d2baf0'},
  {id:'avionics',name:'05 / AVIONICS',x:3450,w:720,color:'#3e657c',accent:'#8bdaf0'},
  {id:'flightdeck',name:'06 / FLIGHT DECK',x:4170,w:630,color:'#6a8190',accent:'#f3d79b'},
 ];
 arena.sections=sections;
 arena.aircraftZones=[
  {id:'tail-ramp',name:'OPEN TAIL RAMP',kind:'exterior',x:0,y:600,w:650,h:520},
  {id:'roof-aft',name:'AFT FUSELAGE / OUTSIDE',kind:'exterior',x:650,y:0,w:850,h:380},
  {id:'roof-centre',name:'UPPER FUSELAGE / OUTSIDE',kind:'exterior',x:1500,y:0,w:1280,h:330},
  {id:'roof-service',name:'SERVICE ROOF / OUTSIDE',kind:'exterior',x:2780,y:0,w:850,h:370},
  {id:'roof-forward',name:'FORWARD FUSELAGE / OUTSIDE',kind:'exterior',x:3630,y:0,w:570,h:310},
  {id:'nose-roof',name:'COCKPIT CANOPY / OUTSIDE',kind:'exterior',x:4200,y:0,w:600,h:430},
  {id:'wing-balcony',name:'PORT WING / OUTSIDE',kind:'exterior',x:1750,y:610,w:1170,h:210},
  {id:'cargo-hold',name:'DOUBLE HEIGHT FREIGHT HOLD',kind:'interior',x:650,y:380,w:1000,h:740},
  {id:'cargo-loft',name:'FREIGHT ROOF RECESS',kind:'interior',x:1500,y:330,w:150,h:50},
  {id:'supply-cabin',name:'UPPER SUPPLY CABIN',kind:'interior',x:1650,y:330,w:1130,h:280},
  {id:'supply-underpass',name:'LOWER CARGO / WING UNDERPASS',kind:'interior',x:1650,y:820,w:1270,h:300},
  {id:'crew-service',name:'CREW SERVICE & INFIRMARY',kind:'interior',x:2780,y:370,w:670,h:750},
  {id:'avionics-aft',name:'CABLE ACCESS',kind:'interior',x:3450,y:370,w:180,h:750},
  {id:'avionics',name:'AVIONICS / RADAR BAY',kind:'interior',x:3630,y:310,w:540,h:810},
  {id:'cockpit',name:'SPLIT LEVEL FLIGHT DECK',kind:'interior',x:4170,y:430,w:630,h:690},
 ];
 const addPlatform=(x:number,y:number,w:number,h:number,skin:PlatformSkin,options:Partial<Platform>={}):Platform=>{
  const platform:Platform={id:platformId++,x,y,w,h,skin,oneWay:false,material:'metal',active:true,...options};arena.platforms.push(platform);return platform;
 };
 const deck=(x:number,y:number,w:number,label:string,skin:PlatformSkin='deck',color?:string):Platform=>addPlatform(x,y,w,skin==='catwalk'?18:24,skin,{oneWay:true,label,color});
 const ladder=(x:number,upper:number,lower:number):void=>{arena.ladders.push({id:ladderId++,x:x-20,y:upper-58,w:40,h:lower-upper+63});};
 addPlatform(0,1120,4800,80,'deck',{color:'#536b7c',label:'LOWER PRESSURE DECK'});

 // The open tail is a boarding apron, not another repeated indoor storey.
 deck(220,900,480,'TAIL RAMP LANDING','deck','#688a99');
 deck(500,650,425,'RAMP ACTUATOR WALK','catwalk','#7296a5');
 ladder(390,900,1120); // Stable first climb used by the introduction/controller.
 ladder(620,650,900);

 // The outside follows the stepped airframe. Changes of level and exposed
 // cover break the long sightline; four hatches return behind indoor fights.
 deck(650,380,850,'AFT PRESSURE HULL','deck','#789cae');
 deck(1500,330,1280,'UPPER PRESSURE HULL','deck','#88aab7');
 deck(2780,370,850,'CREW ROOF','deck','#829da8');
 deck(3630,310,570,'RADAR SPINE','deck','#8aaebb');
 deck(4200,430,600,'COCKPIT CANOPY','deck','#9ab9c1');
 deck(4200,370,90,'CANOPY STEP','catwalk','#92b0bb');
 ladder(790,380,650);

 // A tall hold, one suspended crane bridge and real stacked freight. Its
 // empty centre is intentional: the roof and hoist offer very different
 // approaches to a squad fighting around the ground-level containers.
 deck(930,580,680,'CARGO HOIST BRIDGE','catwalk','#b19c78');
 ladder(1180,580,1120);
 ladder(1200,380,580);
 ladder(1380,380,1120);

 // Supply has a cabin above the wing and a low cargo passage underneath it.
 // The wing is a playable sky-exposed flank with doors at BOTH ends, not a
 // rear-wall window. None of these permanent routes needs surviving cargo.
 deck(1660,590,1030,'SUPPLY CABIN','deck','#699889');
 deck(1710,820,1210,'PORT WING / EXTERIOR','deck','#91b1b7').h=42;
 deck(2460,980,710,'LOWER SERVICE PASSAGE','catwalk','#718a99');
 ladder(1800,330,590);
 ladder(2540,330,590);
 ladder(1900,590,820);
 ladder(1840,820,1120);

 // A compact crew room is offset from both supply decks. The raised sickbay
 // and low service passage open around the wing door instead of forming a
 // third continuous stripe across the aircraft.
 deck(2740,640,690,'CREW MESS & WING DOOR','deck','#8d819f');
 deck(3020,940,410,'INFIRMARY LANDING','deck','#9b90ab');
 ladder(2820,640,820);
 ladder(2830,820,980);
 ladder(2910,980,1120);
 ladder(3160,370,640);
 ladder(3220,640,940);
 ladder(3320,940,1120);

 // Equipment galleries flank a clear cable underpass. The cockpit then
 // changes rhythm again, with a low instrument well and high flight deck.
 deck(3360,1000,310,'CABLE UNDERPASS STEP','catwalk','#7395a3');
 deck(3500,880,660,'POWER DISTRIBUTION GALLERY','deck','#608aa3');
 deck(3560,610,560,'RADAR CONTROL ROOM','deck','#709caf');
 ladder(3610,880,1120);
 ladder(4040,880,1120);
 ladder(3740,610,880);
 ladder(3950,610,880);
 ladder(3840,310,610);
 deck(4220,930,580,'COCKPIT INSTRUMENT WELL','deck','#8b9eac');
 deck(4210,650,530,'FLIGHT CONTROL DECK','deck','#9ab0ba');
 ladder(4440,650,930);
 ladder(4620,930,1120);
 ladder(4370,430,650);
 ladder(4650,430,650);

 arena.spawns=[
  {x:110,y:1120,team:0},{x:240,y:1120,team:0},
  {x:300,y:900,team:0},{x:530,y:900,team:0},
  {x:550,y:650,team:0},{x:870,y:650,team:0},
  {x:700,y:380,team:0},{x:950,y:380,team:0},
  {x:4680,y:1120,team:1},{x:4550,y:1120,team:1},
  {x:4660,y:930,team:1},{x:4490,y:930,team:1},
  {x:4550,y:650,team:1},{x:4700,y:650,team:1},
  {x:4450,y:430,team:1},{x:4600,y:430,team:1},
 ];
 arena.flagSpawns=[{x:1480,y:580},{x:2320,y:820},{x:4020,y:610}];
 arena.crateSpawns=[
  {x:565,y:1120},{x:4200,y:1120},{x:2030,y:590},{x:3210,y:940},
  {x:2270,y:330},{x:3480,y:370},{x:2540,y:820},{x:4540,y:430},
 ];
 const cargoColors=['#4e91ad','#df9659','#579f8d','#9a81b1','#b49b62'];
 const prop=(x:number,feet:number,w:number,h:number,skin:PlatformSkin,label:string,color?:string,hp?:number):Platform=>addPlatform(x,feet-h,w,h,skin,{label,color:color??cargoColors[random.int(cargoColors.length)],hp:hp??180+random.int(100),material:skin==='pallet'||skin==='supply-crate'?'wood':'metal'});
 prop(785,1120,290,110,'cargo-orange','CARGO 7A','#d99557',300);
 prop(905,1010,170,104,'cargo-blue','7A / UPPER','#579abb',230);
 deck(725,1010,75,'RAMP PALLET STEP','pallet','#ac8b61');
 prop(1980,1120,235,102,'cargo-green','SUPPLY 04','#589f8b',280);
 prop(2100,1018,115,96,'strapped-case','04 / FIELD KIT','#6987a4',200);
 // Keep these optional elevated pickups last: they exercise the two actual
 // jumpable freight stacks independently of the permanent circulation.
 arena.crateSpawns.push({x:990,y:906},{x:2157,y:922});

 const reserved=(x:number,y:number,w:number,h:number):boolean=>{
  return [...arena.spawns,...arena.crateSpawns,...arena.flagSpawns].some(point=>point.y>=y-5&&point.y<=y+h+65&&point.x>x-60&&point.x<x+w+60)
   ||arena.ladders.some(value=>y+h>=value.y&&y<=value.y+value.h&&value.x+value.w/2>x-50&&value.x+value.w/2<x+w+50);
 };
 // Every item is physical, low enough to jump, and clear of ladder mouths.
 // The exposed radome housings and wing stores also provide ambush cover.
 const props:[number,number,number,number,PlatformSkin,string,string][]=[
  [400,1120,85,64,'pallet','RAMP TIE-DOWNS','#b9986f'],
  [1260,1120,105,84,'fuel-barrels','AUX FUEL','#719ab2'],
  [1520,1120,112,78,'strapped-case','FLIGHT SUPPLY','#9294bd'],
  [1720,1120,90,76,'medical','RESCUE KIT','#72ab99'],
  [2250,1120,115,92,'engine','WING HYDRAULICS','#70899b'],
  [2670,1120,94,74,'service-cart','GALLEY CART','#9a86ae'],
  [3150,1120,94,76,'fuel-drum','COOLANT','#68a0b1'],
  [3780,1120,108,95,'avionics','POWER RELAY','#5486ab'],
  [4300,1120,106,84,'supply-crate','NAV STORES','#bb9e6c'],
  [1510,580,75,64,'supply-crate','HOIST TOOLS','#b49c74'],
  [2110,590,105,78,'cargo-orange','CABIN FREIGHT','#cf9662'],
  [2410,590,80,72,'medical','PARA RESCUE','#79ae96'],
  [2090,820,100,72,'strapped-case','WING STORES','#91a6ab'],
  [2600,820,90,76,'fuel-drum','PORT AUX','#82b3bd'],
  [2990,640,96,76,'service-cart','CREW LOCKER','#a798bb'],
  [3280,640,90,76,'bulkhead','GALLEY PARTITION','#9789a4'],
  [3070,940,90,70,'medical','INFIRMARY','#90bbaa'],
  [3550,880,88,74,'engine','INVERTER','#7097a2'],
  [3850,880,90,80,'avionics','RADAR POWER','#659bc3'],
  [3600,610,60,74,'bulkhead','RADAR CONSOLE','#7b94aa'],
  [4490,650,90,80,'avionics','FLIGHT CONTROL','#659fc0'],
  [4310,930,90,70,'supply-crate','SURVIVAL KIT','#b6a17a'],
  [1010,380,96,68,'strapped-case','AFT OXYGEN','#738ca7'],
  [1600,330,110,82,'engine','DORSAL VENT','#809da6'],
  [2030,330,100,76,'fuel-barrels','EXTERNAL AUX','#8ca8b6'],
  [2920,370,90,72,'service-cart','MAINTENANCE POD','#9787a7'],
  [3440,370,96,78,'avionics','COMMS ARRAY','#78a5b9'],
  [3970,310,110,88,'bulkhead','RADOME HOUSING','#9bb8c2'],
  [4740,430,60,64,'fuel-drum','CANOPY OXYGEN','#8aafb9'],
 ];
 for(const[x,feet,w,h,skin,label,color]of props){
  const jitter=Math.round((random.next()-.5)*12);
  const position=[0,35,-35,70,-70,110,-110].map(offset=>x+jitter+offset).find(candidate=>{
   if(reserved(candidate,feet-h,w,h))return false;
   if(!arena.platforms.some(platform=>platform.active&&Math.abs(platform.y-feet)<2&&candidate>=platform.x+16&&candidate+w<=platform.x+platform.w-16))return false;
   return !arena.platforms.some(platform=>platform.active&&platform.y<feet-2&&platform.y+platform.h>feet-h-58&&candidate+w+18>platform.x&&candidate-18<platform.x+platform.w);
  });
  if(position!==undefined)prop(position,feet,w,h,skin,label,color);
 }

 const sectionAt=(x:number):ArenaSection=>sections.find(section=>x>=section.x&&x<section.x+section.w)??sections[0]!;
 const decorate=(kind:ArenaDecoration['kind'],x:number,y:number,w:number,h:number,extra:Partial<ArenaDecoration>={}):void=>{
  const section=sectionAt(x);arena.decorations!.push({kind,x,y,w,h,section:section.id,color:section.color,accent:section.accent,...extra});
 };
 // Background panels belong to rooms rather than six full-height stripes.
 // Leave the exposed wing unpainted, even where it crosses the crew section.
 const rooms=[
  {x:670,y:406,w:960,h:682,name:'FREIGHT / 7A',motif:'freight-recess'},
  {x:1680,y:354,w:1050,h:202,name:'UPPER SUPPLY',motif:'supply-lockers'},
  {x:1680,y:850,w:1210,h:238,name:'LOWER CARGO',motif:'freight-recess'},
  {x:2950,y:398,w:470,h:500,name:'CREW / INFIRMARY',motif:'medical-bay'},
  {x:3480,y:402,w:650,h:686,name:'RADAR & CABLES',motif:'cable-wall'},
  {x:4230,y:462,w:530,h:624,name:'FLIGHT CONTROL',motif:'flight-glass'},
 ] as const;
 for(const room of rooms){
  decorate('panel',room.x,room.y,room.w,room.h);
  decorate(room.motif==='flight-glass'?'window':'hatch',room.x+24,room.y+52,room.w-48,Math.max(90,room.h-100),{motif:room.motif});
  decorate('sign',room.x+30,room.y+12,Math.min(340,room.w-60),30,{label:room.name});
  decorate('pipe',room.x+18,room.y+room.h-24,room.w-36,10,{color:'#71909e'});
  for(let x=room.x+18;x<room.x+room.w-28;x+=180){
   decorate('rib',x,room.y,12,room.h,{color:'#7696a9'});
   decorate('light',x+26,room.y+42,96,8);
   decorate('light',x+26,room.y+room.h-45,85,8);
   decorate('window',x+30,room.y+70,84,48,{color:'#9ec5d1'});
   decorate('pipe',x+24,room.y+room.h-60,82,5,{color:'#6f8d99'});
  }
 }
 decorate('panel',920,414,675,140,{motif:'cargo-crane',color:'#b28d61'});
 decorate('cargo-net',710,740,580,330,{color:'#97aab5'});
 decorate('cargo-net',2250,854,170,220,{color:'#92b1a5'});
 decorate('fan',3020,700,112,112);
 decorate('fan',3520,706,95,95);
 decorate('hatch',2960,490,125,130,{label:'WING / CREW'});
 decorate('pipe',1270,405,260,125,{motif:'loose-cable',accent:'#d7aa79'});
 decorate('pipe',3060,425,210,155,{motif:'loose-cable'});
 decorate('pipe',3760,970,220,110,{motif:'loose-cable',accent:'#b8d5b0'});
 // Sparse restraints and braces communicate the wing and tail silhouette
 // without filling their open sky with an indoor wall or a fake floor.
 decorate('sign',50,940,240,32,{label:'OPEN TAIL / CAUTION',accent:'#e9c17d'});
 decorate('sign',2180,750,270,30,{label:'PORT WING / EXTERIOR',accent:'#e1ce95'});
 for(const platform of arena.platforms.filter(platform=>platform.oneWay&&platform.w>=260&&platform.y>=580&&platform.y!==820)){
  const width=Math.min(85,platform.w*.16);
  for(const x of[platform.x+15,platform.x+platform.w-width-15])decorate('rib',x,platform.y+platform.h+7,width,80,{motif:'gallery-brace'});
 }
 return arena;
}
