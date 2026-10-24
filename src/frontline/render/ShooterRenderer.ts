import Phaser from 'phaser';
import type { MapId, MatchState, Platform, Rect, Soldier, Vec, WeaponId } from '../core/types';
import { clamp } from '../core/types';
import { WEAPONS } from '../core/config';
import { eye, lineOfSight } from '../ai/perception';
import { drawSoldierBody } from './SoldierArt';
import { drawAircraftDecoration, drawAircraftPlatform, drawAircraftShell } from './AircraftArt';
import { drawAircraftAtmosphere, drawAircraftCutaway, drawAircraftLife } from './AircraftCutaway';
import { ViewportCache } from './ViewportCache';
import { chooseGraphicsBackend,canvasCompatibleGraphics,type GraphicsBackend } from './GraphicsBackend';
import { visibilityShadow } from './VisibilityShadow';

export interface RenderOptions { quality:'low'|'medium'|'high';particles:boolean;shake:boolean;reducedMotion?:boolean }
interface Actor { root:Phaser.GameObjects.Container;body:Phaser.GameObjects.Graphics;gun:Phaser.GameObjects.Container;weapon:Phaser.GameObjects.Graphics;weaponId:WeaponId;label:Phaser.GameObjects.Text;lastAlive:boolean;lastGrounded:boolean;landAt:number }
interface Particle extends Vec { vx:number;vy:number;life:number;max:number;size:number;color:number;gravity:number }
const W=960,H=540;
const BLUE=0x7ad7ed,RED=0xf28c85,INK=0x14212a;
const hex=(v:string):number=>Number.parseInt(v.replace('#',''),16);
const OFFICERS:Record<MapId,string>={aircraft:'SKYWARD / CARGO DECK',factory:'FOUNDRY 09 / INDUSTRIAL SECTOR',forest:'BLACK PINE / RESTRICTED',city:'DISTRICT 06 / EVACUATED',harbor:'PORT MERIDIAN / FREIGHT',ship:'F.N.S. RESOLUTE / DECK 04'};

/** A pure view over the fixed-step simulation: feet positions, weapons and hits are never changed here. */
export class ShooterRenderer {
  private game:Phaser.Game;
  private scene?:Phaser.Scene;
  private state?:MatchState;
  private matchIdentity?:MatchState;
  private hostPreparesView=false;
  private preparedTick=-1;
  private lastCameraTarget?:{id:number;x:number;y:number;alive:boolean;round:number};
  private options:RenderOptions;
  private backend:GraphicsBackend;
  private renderScale=2;
  private cache?:ViewportCache;
  private camera:Rect={x:0,y:0,w:W,h:H};
  private followId=0;
  private cameraReady=false;
  private time=0;
  private eventTick=-1;
  private map?:MapId;
  private structure='';
  private sceneryCell='';
  private staticView:Rect={x:0,y:0,w:W,h:H};
  private actors=new Map<number,Actor>();
  private particles:Particle[]=[];
  private bursts:{x:number;y:number;life:number;max:number;radius:number}[]=[];
  private backdrop?:Phaser.GameObjects.Graphics;
  private far?:Phaser.GameObjects.Graphics;
  private near?:Phaser.GameObjects.Graphics;
  private aircraftAtmosphere?:Phaser.GameObjects.Graphics;
  private geometry?:Phaser.GameObjects.Graphics;
  private world?:Phaser.GameObjects.Graphics;
  private effects?:Phaser.GameObjects.Graphics;
  private shadow?:Phaser.GameObjects.Graphics;
  private shadowSignature='';
  private weather?:Phaser.GameObjects.Graphics;
  private signs:Phaser.GameObjects.Text[]=[];
  private flags=new Map<number,Phaser.GameObjects.Text>();
  private team:0|1=0;
  private spotted=new Set<number>();
  private visibleBodies=new Set<number>();
  private alliedObservers:Soldier[]=[];

  constructor(container:HTMLElement,options:RenderOptions={quality:'high',particles:true,shake:true}) {
    this.options={...options};this.backend=chooseGraphicsBackend();this.renderScale=this.resolutionFor(options.quality);const owner=this;
    class ShooterScene extends Phaser.Scene {
      constructor(){super('frontline');}
      create():void{owner.initialize(this);}
      update(_time:number,delta:number):void{owner.paint(Math.min(.05,delta/1000));}
    }
    this.game=new Phaser.Game({type:this.backend.canvas?Phaser.CANVAS:Phaser.AUTO,parent:container,width:W*this.renderScale,height:H*this.renderScale,transparent:false,backgroundColor:'#172c38',banner:false,
      antialias:true,pixelArt:false,roundPixels:false,audio:{noAudio:true},input:{keyboard:false},
      scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:W*this.renderScale,height:H*this.renderScale},scene:ShooterScene,
      render:{powerPreference:'high-performance'}});
  }
  render(state:MatchState,_dt?:number):void{this.acceptState(state);}
  /** The host calls this before its fixed substeps; painting never advances it a second time. */
  prepareView(state:MatchState,dt:number):Rect{
    this.acceptState(state);this.hostPreparesView=true;
    if(this.preparedTick!==state.tick||!this.cameraReady||this.cameraDiscontinuity(state)){this.updateCamera(state,Math.max(0,Math.min(.15,dt)));this.preparedTick=state.tick;}
    return this.getCamera();
  }
  private acceptState(state:MatchState):void{
    if(this.matchIdentity!==state){
      this.matchIdentity=state;this.state=state;this.cameraReady=false;this.hostPreparesView=false;this.preparedTick=-1;this.lastCameraTarget=undefined;
      this.map=undefined;this.structure='';this.sceneryCell='';this.eventTick=-1;this.particles=[];this.bursts=[];
      this.spotted.clear();this.visibleBodies.clear();this.alliedObservers=[];
      for(const actor of this.actors.values())actor.root.destroy(true);this.actors.clear();
      for(const sign of this.signs)sign.destroy();this.signs=[];for(const flag of this.flags.values())flag.destroy();this.flags.clear();
      this.cache?.destroy();this.geometry?.clear();this.world?.clear();this.effects?.clear();this.weather?.clear();this.shadow?.clear();this.aircraftAtmosphere?.clear();this.shadowSignature='';
    }
    this.state=state;
  }
  follow(id:number):void{if(this.followId!==id){this.followId=id;this.cameraReady=false;}}
  getCamera():Rect{return {...this.camera};}
  screenToWorld(clientX:number,clientY:number):Vec{
    const rect=this.game.canvas.getBoundingClientRect();
    return {x:this.camera.x+(clientX-rect.left)*W/Math.max(1,rect.width),y:this.camera.y+(clientY-rect.top)*H/Math.max(1,rect.height)};
  }
  setOptions(partial:Partial<RenderOptions>):void{
    this.options={...this.options,...partial};if(!this.options.particles)this.particles=[];
    const resolution=this.resolutionFor(this.options.quality);
    if(resolution!==this.renderScale){this.renderScale=resolution;this.game.scale.setGameSize(W*resolution,H*resolution);this.scene?.cameras.main.setOrigin(0,0).setZoom(resolution);this.structure='';this.sceneryCell='';}
  }
  private resolutionFor(quality:RenderOptions['quality']):number{return this.backend.canvas?1:quality==='high'?2:quality==='medium'?1.5:1;}
  destroy():void{this.cache?.destroy();this.game.destroy(true);this.particles=[];this.bursts=[];this.actors.clear();}

  private initialize(scene:Phaser.Scene):void{
    this.scene=scene;
    this.cache=new ViewportCache(scene);
    // A larger backing canvas with a matching camera zoom keeps gameplay at
    // 960×540 world units while rendering vector contours sharply on large displays.
    scene.cameras.main.setOrigin(0,0).setZoom(this.renderScale).setScroll(this.camera.x,this.camera.y);
    this.backdrop=this.graphics().setDepth(-50).setScrollFactor(0);
    this.far=this.graphics().setDepth(-40).setScrollFactor(.16,.10);
    this.near=this.graphics().setDepth(-30).setScrollFactor(.38,.24);
    this.aircraftAtmosphere=this.graphics().setDepth(-25).setScrollFactor(0);
    this.geometry=this.graphics().setDepth(0);
    this.world=this.graphics().setDepth(4);
    this.effects=this.graphics().setDepth(30);
    this.shadow=this.graphics().setDepth(35);
    this.weather=this.graphics().setDepth(40).setScrollFactor(0);
  }
  private graphics():Phaser.GameObjects.Graphics{const graphics=this.scene!.add.graphics();return this.backend.canvas?canvasCompatibleGraphics(graphics):graphics;}

  private weaponArt(g:Phaser.GameObjects.Graphics,id:WeaponId):void{
    const category=WEAPONS[id].category;
    const large=['lmg','sniper','launcher','rocket'].includes(category);
    const body=category==='rocket'?0x6a806b:category==='sniper'?0x75828a:0x63717c;
    const end=category==='pistol'?37:large?55:49;
    g.lineStyle(2,0x12202b);
    if(category==='rocket'){
      g.fillStyle(0x344637).fillRoundedRect(7,9,47,12,5);g.strokeRoundedRect(7,9,47,12,5);
      g.fillStyle(0x98a485).fillRoundedRect(11,10,35,4,2);g.fillStyle(0xb6ba9f).fillEllipse(53,15,8,12);
      g.fillStyle(0x263a33).fillRect(27,20,6,7).fillRect(32,5,8,5);return;
    }
    g.fillStyle(0x243741).fillRoundedRect(10,13,13,8,2);g.strokeRoundedRect(10,13,13,8,2);
    g.fillStyle(body).fillRoundedRect(21,10,category==='pistol'?11:large?24:21,10,3);g.strokeRoundedRect(21,10,category==='pistol'?11:large?24:21,10,3);
    g.fillStyle(0x92a0a6).fillRoundedRect(22,11,large?22:16,3,1);
    g.fillStyle(0x253944).fillRoundedRect(29,19,7,9,2);g.fillStyle(0x3d5059).fillRect(31,20,3,6);
    g.fillStyle(0x1c2e37).fillRect(category==='pistol'?31:40,13,end-(category==='pistol'?31:40),4);
    g.fillStyle(0xb0b9b4).fillRect(end-3,12,3,6);
    if(category==='sniper'||category==='dmr'){g.fillStyle(0x1d303b).fillRoundedRect(28,4,17,6,2);g.fillStyle(0x79b7c2).fillEllipse(44,7,4,6);}
    if(category==='shotgun'){g.fillStyle(0xb39269).fillRoundedRect(35,16,12,5,1);g.fillStyle(0xc4a37c).fillRect(12,14,9,4);}
    if(category==='lmg'){g.fillStyle(0x374d4e).fillRoundedRect(34,19,10,10,2);g.fillStyle(0xa9b086).fillRect(35,20,8,2);}
    if(category==='launcher'){g.fillStyle(0x526450).fillRoundedRect(27,11,24,12,4);g.lineStyle(1,0xa1ab8d).strokeCircle(39,17,5);}
    if(id==='hush')g.fillStyle(0x334d55).fillRoundedRect(36,12,12,6,2);
    g.fillStyle(0xd4be85).fillRect(24,12,3,2);
  }

  private paint(dt:number):void{
    const state=this.state,scene=this.scene;
    if(!state||!scene||!this.world||!this.effects||!this.weather)return;
    this.time+=dt;
    if(this.map!==state.arena.id){this.map=state.arena.id;if(!this.hostPreparesView)this.cameraReady=false;this.particles=[];this.bursts=[];this.structure='';this.sceneryCell='';}
    if(!this.hostPreparesView)this.updateCamera(state,dt);
    const cell=`${Math.floor(this.camera.x/240)}:${Math.floor(this.camera.y/160)}`;
    if(cell!==this.sceneryCell){this.sceneryCell=cell;this.background(state);}
    const signature=cell+':'+state.arena.platforms.filter(p=>!p.moving).map(p=>`${p.id}:${Number(p.active)}:${p.x}:${p.y}:${p.w}:${p.h}`).join(',');
    if(signature!==this.structure){
      this.structure=signature;
      this.staticView={x:Math.floor(this.camera.x/240)*240-240,y:Math.floor(this.camera.y/160)*160-160,w:W+480,h:H+320};
      this.drawGeometry(state);
      this.cache!.capture('geometry',this.geometry!,this.staticView,this.renderScale);
    }
    this.updateVisibility(state);
    const atmosphere=this.aircraftAtmosphere!.clear(),ambientTime=this.options.reducedMotion?0:this.time;
    if(state.arena.id==='aircraft')drawAircraftAtmosphere(atmosphere,this.camera,ambientTime,this.options.quality);
    const g=this.world.clear(),fx=this.effects.clear();
    for(const platform of state.arena.platforms)if(platform.active&&platform.moving&&this.visible(platform,100))this.drawPlatform(g,platform,state.arena.id);
    if(state.arena.id==='aircraft')drawAircraftLife(g,state.arena,this.camera,ambientTime);
    this.drawHazards(g,state);
    this.drawObjects(g,state);
    const present=new Set<number>();
    for(const soldier of state.soldiers){present.add(soldier.id);this.drawSoldier(soldier,state);}
    for(const[id,actor]of this.actors)if(!present.has(id)){actor.root.destroy(true);this.actors.delete(id);}
    this.drawCombat(fx,state);
    if(this.eventTick!==state.tick){
      if(state.tick<this.eventTick){this.particles=[];this.bursts=[];this.cameraReady=false;}
      this.eventTick=state.tick;
      for(const event of state.events){
        const source=state.soldiers.find(s=>s.id===(event.type==='death'?event.targetId:event.soldierId));
        if(source&&!this.soldierVisible(source)&&event.type!=='impact'&&event.type!=='explosion')continue;
        if((event.type==='explosion'||event.type==='impact')&&!this.pointVisible(state,{x:event.x,y:event.y}))continue;
        if(event.type==='impact')this.emit(event.x,event.y,event.material==='wood'?0xb99567:event.material==='glass'?0xa6e9f3:0xffcc83,6,100,180);
        if(event.type==='land')this.emit(event.x,event.y-2,0xacb4ad,5,55,40);
        if(event.type==='shot'){
          const shooter=state.soldiers.find(s=>s.id===event.soldierId);
          if(shooter&&WEAPONS[event.weapon??'vanguard'].category!=='rocket')this.emit(shooter.x-Math.cos(shooter.aim)*4,shooter.y-32,0xd4bc85,1,55,190);
        }
        if(event.type==='death')this.emit(event.x,event.y-25,0xb4b4a2,10,100,220);
        if(event.type==='heal')this.emit(event.x,event.y-25,0x94e2af,3,25,-30);
        if(event.type==='explosion'){
          this.emit(event.x,event.y,0xffc16d,35,220,130);
          if(this.bursts.length>=24)this.bursts.shift();this.bursts.push({x:event.x,y:event.y,life:.45,max:.45,radius:event.value??125});
          if(this.options.shake&&!this.options.reducedMotion&&this.visible({x:event.x,y:event.y,w:1,h:1},150))scene.cameras.main.shake(120,.003);
        }
      }
    }
    this.drawParticles(fx,dt);this.drawVisibilityShadow(state);this.drawWeather(state);
  }

  private updateCamera(state:MatchState,dt:number):void{
    const target=state.soldiers.find(s=>s.id===this.followId)??state.soldiers[0];if(!target)return;
    if(this.cameraDiscontinuity(state))this.cameraReady=false;
    const lead=target.alive?Math.cos(target.aim)*105:0;
    const desiredX=clamp(target.x+lead-W*.5,0,Math.max(0,state.arena.width-W));
    const desiredY=clamp(target.y-145+Math.sin(target.aim)*35-H*.5,0,Math.max(0,state.arena.height-H));
    const blend=this.cameraReady?1-Math.exp(-dt*5.8):1;
    this.camera.x+=(desiredX-this.camera.x)*blend;this.camera.y+=(desiredY-this.camera.y)*blend;
    this.lastCameraTarget={id:target.id,x:target.x,y:target.y,alive:target.alive,round:state.round};
    this.cameraReady=true;this.scene?.cameras.main.setScroll(this.camera.x,this.camera.y);
  }
  private cameraDiscontinuity(state:MatchState):boolean{
    const target=state.soldiers.find(s=>s.id===this.followId)??state.soldiers[0],previous=this.lastCameraTarget;
    return !!target&&(!previous||previous.id!==target.id||previous.round!==state.round||(!previous.alive&&target.alive)||Math.abs(previous.x-target.x)>W*.5||Math.abs(previous.y-target.y)>H*.5);
  }
  private visible(rect:Rect,pad=0):boolean{return rect.x+rect.w>=this.camera.x-pad&&rect.x<=this.camera.x+W+pad&&rect.y+rect.h>=this.camera.y-pad&&rect.y<=this.camera.y+H+pad;}
  private staticVisible(rect:Rect):boolean{const area=this.staticView;return rect.x+rect.w>=area.x&&rect.x<=area.x+area.w&&rect.y+rect.h>=area.y&&rect.y<=area.y+area.h;}
  private layerVisible(rect:Rect,factor:number):boolean{return rect.x+rect.w>=this.camera.x*factor-220&&rect.x<=this.camera.x*factor+W+220&&rect.y+rect.h>=this.camera.y*factor-160&&rect.y<=this.camera.y*factor+H+160;}

  private updateVisibility(state:MatchState):void{
    const team=(state.soldiers.find(s=>s.id===this.followId)??state.soldiers.find(s=>s.human)??state.soldiers[0])?.team??0;
    // One observer and at most fifteen targets: current-frame LOS prevents even
    // a brief stale body/nameplate reveal after moving behind solid geometry.
    this.team=team;this.spotted.clear();this.visibleBodies.clear();
    const observer=state.soldiers.find(s=>s.id===this.followId);
    this.alliedObservers=observer?.alive?[observer]:[];
    if(observer)this.visibleBodies.add(observer.id);
    if(observer?.alive){
      const origin=eye(observer),fogRange=Math.hypot(W,H)*(1-clamp(state.weather.fog,0,1)*.4);
      for(const soldier of state.soldiers){
        const point={x:soldier.x,y:soldier.y-29};
        if(!this.visible({x:soldier.x-14,y:soldier.y-63,w:28,h:66}))continue;
        if(soldier.team!==team&&(!soldier.alive||Math.hypot(point.x-origin.x,point.y-origin.y)>fogRange))continue;
        if(lineOfSight(state,origin,point)){this.visibleBodies.add(soldier.id);if(soldier.team!==team)this.spotted.add(soldier.id);}
      }
    }
  }
  private soldierVisible(soldier:Soldier):boolean{return this.visibleBodies.has(soldier.id);}
  private drawVisibilityShadow(state:MatchState):void{
    const observer=state.soldiers.find(s=>s.id===this.followId),origin=observer?.alive?eye(observer):undefined;
    const range=Math.hypot(W,H)*(1-clamp(state.weather.fog,0,1)*.4);
    const moving=state.arena.platforms.filter(p=>p.moving).map(p=>`${p.id}:${Number(p.active)}:${p.x}:${p.y}:${p.w}:${p.h}`).join(',');
    const signature=`${origin?.x}:${origin?.y}:${this.camera.x}:${this.camera.y}:${range}:${this.structure}:${moving}`;
    if(signature===this.shadowSignature)return;this.shadowSignature=signature;
    const g=this.shadow!.clear().fillStyle(0x081420,.62).beginPath();
    // Fill one compound path so Canvas antialiasing cannot leave bright seams
    // between adjacent visibility wedges. WebGL batches the same subpaths.
    for(const[a,b,c]of visibilityShadow(this.camera,origin,state.arena.platforms,range))g.moveTo(a.x,a.y).lineTo(b.x,b.y).lineTo(c.x,c.y).closePath();
    g.fillPath();
  }
  private pointVisible(state:MatchState,point:Vec):boolean{
    if(!this.visible({x:point.x,y:point.y,w:1,h:1}))return false;
    return this.alliedObservers.some(ally=>{
      const origin=eye(ally),dx=point.x-origin.x,dy=point.y-origin.y,d=Math.hypot(dx,dy);
      return d<=Math.hypot(W,H)*(1-clamp(state.weather.fog,0,1)*.4)&&lineOfSight(state,origin,{x:point.x-dx/Math.max(1,d)*2,y:point.y-dy/Math.max(1,d)*2});
    });
  }

  private background(state:MatchState):void{
    const bg=this.backdrop!.clear(),far=this.far!.clear(),near=this.near!.clear();
    const map=state.arena.id,p=state.arena.palette;
    bg.fillGradientStyle(hex(p.sky),hex(p.sky),hex(p.far),hex(p.far)).fillRect(0,0,W,H);
    bg.fillStyle(0xf3d6a0,.06).fillCircle(740,90,110).fillCircle(740,90,165);
    far.fillStyle(hex(p.far));near.fillStyle(hex(p.near));
    if(map==='forest'){
      far.fillStyle(0x627b79,.4).fillTriangle(-120,450,350,130,820,450).fillTriangle(400,460,930,75,1400,460).fillTriangle(1100,460,1650,190,2200,460);
      for(let i=0;i<34;i++)if(this.layerVisible({x:i*115-150,y:30,w:300,h:450},.16))this.tree(far,i*115,430,145+(i*73)%180,0x344e4e,.75);
      for(let i=0;i<45;i++)if(this.layerVisible({x:i*119-150,y:80,w:300,h:590},.38))this.tree(near,i*119,660,170+(i*37)%220,i%2?0x223e39:0x2a4941,.92);
      near.fillStyle(0x233c35).fillRect(0,610,5000,600);
      for(let i=0;i<20;i++)if(this.layerVisible({x:i*240-80,y:530,w:290,h:100},.38)){near.fillStyle(0x5c7564,.25).fillEllipse(i*240+70,580,290,100);}
    }else if(map==='city'){
      for(let i=0;i<35;i++){
        const x=i*145,h=130+(i*67)%220;if(!this.layerVisible({x,y:440-h,w:130,h:h+400},.16))continue;far.fillStyle(i%2?0x34434f:0x2b3d49).fillRect(x,440-h,130,h+400);
        for(let a=0;a<4;a++)for(let b=0;b<Math.floor(h/30);b++)far.fillStyle((a+b+i)%4===0?0xd5b985:0x5e727b,(a+b+i)%4===0?.35:.22).fillRect(x+16+a*27,455-h+b*29,10,16);
      }
      for(let i=0;i<17;i++){
        const x=i*290,h=200+(i*83)%190;if(!this.layerVisible({x,y:590-h,w:260,h:h+500},.38))continue;near.fillStyle(0x26343e).fillRect(x,590-h,260,h+500);
        near.fillStyle(0x58686c,.3).fillRect(x,590-h,260,8);
        near.lineStyle(2,0x1c303b).lineBetween(x+35,590-h,x+35,590);
        near.fillStyle(0x86a4a4,.22).fillRect(x+55,620-h,45,55).fillRect(x+130,620-h,45,55);
        near.fillStyle(0x1e303c).fillTriangle(x+40,590-h,x+95,565-h,x+140,590-h);
      }
    }else if(map==='harbor'){
      far.fillStyle(0x294b5a).fillRect(0,390,5000,500);
      for(let i=0;i<12;i++){
        const x=i*390;if(!this.layerVisible({x,y:275,w:330,h:160},.16))continue;far.fillStyle(0x344c56).fillTriangle(x,382,x+330,382,x+280,426).fillRect(x+80,350,165,35);
        far.fillStyle(0x7f8170,.5).fillRect(x+230,315,45,40);far.fillStyle(0x425e68).fillRect(x+250,275,5,40);
      }
      for(let i=0;i<11;i++){
        const x=i*470;if(!this.layerVisible({x,y:70,w:450,h:640},.38))continue;near.lineStyle(9,0x344a53).lineBetween(x+90,540,x+90,145).lineBetween(x+90,150,x+340,150).lineBetween(x+90,150,x+215,70).lineBetween(x+215,70,x+340,150);
        near.lineStyle(2,0x6d827f,.45).lineBetween(x+290,150,x+290,360);near.fillStyle(0x5d675d).fillRect(x+265,360,50,37);
        near.fillStyle(0x233b46).fillRect(x,505,450,200);
      }
    }else if(map==='ship'){
      far.fillStyle(0x183e52).fillRect(0,365,5000,700);
      far.fillStyle(0x789ca4,.25).fillTriangle(180,385,280,370,450,385).fillTriangle(650,379,800,363,1000,379);
      for(let i=0;i<10;i++){
        const x=i*510;if(!this.layerVisible({x,y:120,w:360,h:600},.38))continue;near.fillStyle(0x273f4a).fillRect(x+30,400,330,320).fillRect(x+100,290,230,110).fillRect(x+170,230,130,60);
        near.fillStyle(0x78999e,.4).fillRect(x+180,241,24,25).fillRect(x+211,241,24,25).fillRect(x+242,241,42,25);
        near.lineStyle(4,0x607a81,.55).lineBetween(x+239,230,x+239,120).lineBetween(x+192,166,x+286,166);
        near.lineStyle(2,0x879e9d,.45).strokeEllipse(x+238,148,70,17);
        near.fillStyle(0x526770,.55).fillRect(x+40,360,45,40);
      }
    }else if(map==='factory'){
      for(let i=0;i<19;i++){
        const x=i*270,h=120+(i*79)%180;if(!this.layerVisible({x,y:140,w:250,h:650},.16))continue;far.fillStyle(0x293b43).fillRect(x,440-h,250,h+350);
        far.fillStyle(0x3b4c50).fillRoundedRect(x+30,190,34,250,9).fillRoundedRect(x+85,250,26,190,7);
        far.lineStyle(11,0x485858,.7).lineBetween(x+40,300,x+170,300).lineBetween(x+170,300,x+170,440);
      }
      for(let i=0;i<16;i++){
        const x=i*330;if(!this.layerVisible({x,y:190,w:290,h:490},.38))continue;near.fillStyle(0x23323a).fillRect(x+20,430,240,250);
        near.fillStyle(0x695841,.55).fillRoundedRect(x+50,475,160,75,12);
        near.fillStyle(0xe2a36b,.25).fillRoundedRect(x+62,489,135,48,8);
        near.lineStyle(15,0x3c4c50).lineBetween(x,600,x,190).lineBetween(x,190,x+290,190);
      }
    }else drawAircraftShell(bg,far,near,state.arena.width,this.camera);
    bg.fillStyle(0xffffff,.025).fillEllipse(220,50,500,400);
    this.cache!.capture('sky',bg,{x:0,y:0,w:W,h:H},this.renderScale,0,0);
    this.cache!.capture('far',far,{x:this.camera.x*.16-160,y:this.camera.y*.1-120,w:W+320,h:H+240},this.renderScale,.16,.1);
    this.cache!.capture('near',near,{x:this.camera.x*.38-160,y:this.camera.y*.24-120,w:W+320,h:H+240},this.renderScale,.38,.24);
  }

  private tree(g:Phaser.GameObjects.Graphics,x:number,y:number,h:number,c:number,alpha:number):void{
    g.fillStyle(c,alpha).fillRoundedRect(x-8,y-h,16,h,7);
    g.fillEllipse(x,y-h+10,h*.62,h*.7).fillEllipse(x-h*.2,y-h*.7,h*.49,h*.46).fillEllipse(x+h*.2,y-h*.7,h*.51,h*.51);
    g.fillStyle(0x8ea18b,.06*alpha).fillEllipse(x-h*.1,y-h*1.08,h*.43,h*.19);
  }

  private drawGeometry(state:MatchState):void{
    const g=this.geometry!.clear();for(const sign of this.signs)sign.destroy();this.signs=[];
    if(state.arena.id==='aircraft'){
      drawAircraftCutaway(g,state.arena,this.staticView);
      for(const decoration of state.arena.decorations??[]){
        if(!this.staticVisible(decoration))continue;
        drawAircraftDecoration(g,decoration);
        if(decoration.label&&(decoration.kind==='sign'||decoration.kind==='panel')){
          const label=this.scene!.add.text(decoration.x+decoration.w*.5,decoration.y+decoration.h*.48,decoration.label,{fontFamily:'sans-serif',fontSize:decoration.kind==='sign'?'11px':'8px',fontStyle:'bold',color:decoration.accent??'#a9c1c0',resolution:2}).setOrigin(.5).setAlpha(.7).setDepth(1);
          this.signs.push(label);
        }
      }
    }
    for(const ladder of state.arena.ladders){
      if(!this.staticVisible(ladder))continue;
      g.lineStyle(6,0x182a35).lineBetween(ladder.x+5,ladder.y,ladder.x+5,ladder.y+ladder.h).lineBetween(ladder.x+ladder.w-5,ladder.y,ladder.x+ladder.w-5,ladder.y+ladder.h);
      g.lineStyle(3,0x91a4a5).lineBetween(ladder.x+5,ladder.y,ladder.x+5,ladder.y+ladder.h).lineBetween(ladder.x+ladder.w-5,ladder.y,ladder.x+ladder.w-5,ladder.y+ladder.h);
      for(let y=ladder.y+7;y<ladder.y+ladder.h;y+=17)g.lineStyle(3,0x809696).lineBetween(ladder.x+5,y,ladder.x+ladder.w-5,y);
    }
    for(const platform of state.arena.platforms)if(platform.active&&!platform.moving&&this.staticVisible(platform)){
      this.drawPlatform(g,platform,state.arena.id);
    }
    const map=state.arena.id;
    for(let i=0;i<state.arena.width/700;i++){
      const x=i*700+170,y=170+(i%3)*300;
      if(map==='forest'||map==='aircraft')continue;
      if(!this.staticVisible({x,y,w:210,h:28}))continue;
      g.fillStyle(0x122732,.85).fillRoundedRect(x,y,210,28,3);g.lineStyle(1,0xa9b7b0,.25).strokeRoundedRect(x,y,210,28,3);
      const text=this.scene!.add.text(x+105,y+14,`${OFFICERS[map].split(' / ')[0]}  ${String(i+1).padStart(2,'0')}`,{fontFamily:'sans-serif',fontSize:'10px',fontStyle:'bold',color:'#a8bdb8'}).setOrigin(.5).setDepth(-1);
      this.signs.push(text);
    }
  }

  private drawPlatform(g:Phaser.GameObjects.Graphics,p:Platform,map:MapId):void{
    if(map==='aircraft'&&drawAircraftPlatform(g,p,this.staticView))return;
    const{x,y,w,h}=p;const steel=p.material==='metal',wood=p.material==='wood',glass=p.material==='glass';
    const body=glass?0x739da7:wood?0x645749:map==='forest'?0x4e5e55:map==='city'?0x4f5657:hex(this.state!.arena.palette.ground);
    g.fillStyle(0x0d202b,.55).fillRoundedRect(x+3,y+5,w,Math.max(6,h),2);
    g.fillStyle(body,glass?.35:1).fillRoundedRect(x,y,w,Math.max(6,h),2);
    g.fillStyle(glass?0xb6ebed:hex(this.state!.arena.palette.edge),glass?.6:.9).fillRect(x,y,w,4);
    g.lineStyle(1,0x102631,.75).strokeRect(x,y,w,Math.max(6,h));
    if(glass){g.lineStyle(2,0xc0f0ee,.5).lineBetween(x+5,y+h-2,x+Math.min(w-3,35),y+3).lineBetween(x+w*.6,y+h-3,x+w*.8,y+3);return;}
    if(p.oneWay){
      g.lineStyle(2,0x263a41,.75);
      for(let a=x+14;a<x+w;a+=40)g.lineBetween(a,y+5,Math.min(a+16,x+w),y+Math.min(17,h));
      if(map==='forest'){g.fillStyle(0xb39b6a,.5);for(let a=x+5;a<x+w;a+=27)g.fillRect(a,y,2,Math.min(12,h));}
    }else{
      for(let a=x+12;a<x+w;a+=steel?90:75){
        if(steel){g.fillStyle(0x1a313c,.4).fillRect(a,y+9,3,Math.max(0,h-15));g.fillStyle(0xa3b4af,.5).fillCircle(a+8,y+11,2);}
        else if(wood){g.lineStyle(2,0x352f2b,.5).lineBetween(a,y+7,a,y+h-2);}
        else{g.lineStyle(1,0x1b3037,.38).lineBetween(a,y+7,a+18,y+18).lineBetween(a+18,y+18,a+16,y+Math.min(34,h));}
      }
      if(h>65){g.fillStyle(0x152b34,.25).fillRect(x,y+Math.min(25,h*.4),w,h-Math.min(25,h*.4));}
    }
    if(p.conveyor){
      g.fillStyle(0x26353a).fillRect(x+2,y+3,w-4,5);
      for(let a=x+6;a<x+w-8;a+=28){g.lineStyle(2,0xe0b877,.8).lineBetween(a,y+3,a+(p.conveyor>0?7:-7),y+6).lineBetween(a+(p.conveyor>0?7:-7),y+6,a,y+9);}
    }
    if(p.hp!==undefined){
      g.fillStyle(0xd9b477,.75).fillRect(x+3,y+3,Math.min(18,w-6),4).fillRect(x+w-21,y+3,18,4);
      g.lineStyle(2,0x1d3036,.75).lineBetween(x+w*.5,y+3,x+w*.43,y+Math.min(h*.5,24)).lineBetween(x+w*.43,y+Math.min(h*.5,24),x+w*.57,y+Math.min(h,45));
    }
    if(p.moving){
      g.lineStyle(2,0xb4beb1,.4).lineBetween(x+8,y,x+8,Math.max(0,y-300)).lineBetween(x+w-8,y,x+w-8,Math.max(0,y-300));
      g.fillStyle(0xe5bc76).fillRect(x+3,y+5,8,4).fillRect(x+w-11,y+5,8,4);
    }
  }

  private drawSoldier(s:Soldier,state:MatchState):void{
    let actor=this.actors.get(s.id);
    if(!actor){
      const root=this.scene!.add.container(s.x,s.y).setDepth(12),body=this.graphics();
      const weapon=this.graphics().setPosition(-20,-16),gun=this.scene!.add.container(0,-34,[weapon]);
      this.weaponArt(weapon,s.weapons[s.activeWeapon].id);
      const label=this.scene!.add.text(0,-83,s.name,{fontFamily:'sans-serif',fontSize:'10px',fontStyle:'bold',color:s.team===0?'#b9e4ed':'#f6b3ad',stroke:'#13232d',strokeThickness:3,resolution:2}).setOrigin(.5);
      root.add([body,gun,label]);actor={root,body,gun,weapon,weaponId:s.weapons[s.activeWeapon].id,label,lastAlive:s.alive,lastGrounded:s.grounded,landAt:-10};this.actors.set(s.id,actor);
    }
    const deathAge=state.time-s.deathAt;
    const visible=this.soldierVisible(s)&&this.visible({x:s.x-45,y:s.y-94,w:90,h:104},70)&&(s.alive||deathAge<.7);
    actor.root.setVisible(visible);actor.label.setVisible(visible&&s.alive);actor.gun.setVisible(visible&&s.alive);actor.lastAlive=s.alive;if(!visible)return;
    actor.root.setPosition(s.x,s.y).setAlpha(s.alive?1:clamp(1-deathAge/.7,0,1));
    actor.root.setRotation(!s.alive&&!this.options.reducedMotion?Math.min(1,deathAge*4)*(Math.cos(s.aim)>=0?1:-1)*1.35:0);
    const g=actor.body.clear(),team=s.team===0?BLUE:RED,face=Math.cos(s.aim)>=0?1:-1;
    const viewer=state.soldiers.find(p=>p.id===this.followId);
    const focus=viewer?.classId==='sniper'&&(viewer.abilityUntil??0)>state.time;
    if(s.grounded&&!actor.lastGrounded)actor.landAt=this.time;
    actor.lastGrounded=s.grounded;
    const landing=this.options.reducedMotion?0:Math.max(0,1-(this.time-actor.landAt)/.13)*2;
    drawSoldierBody(g,s,this.time,state.time,!!this.options.reducedMotion,focus&&s.team!==this.team,landing);
    const slot=s.weapons[s.activeWeapon],reload=slot.reloadUntil>state.time;
    const recoil=state.time-s.lastShotAt<.09?(1-clamp((state.time-s.lastShotAt)/.09,0,1))*3:0;
    if(actor.weaponId!==slot.id){actor.weapon.clear();this.weaponArt(actor.weapon,slot.id);actor.weaponId=slot.id;}
    const category=WEAPONS[slot.id].category;
    const authoredTip=slot.id==='hush'?48:category==='pistol'?37:['lmg','sniper','launcher'].includes(category)?55:category==='rocket'?57:49;
    const gunAdvance=32-(authoredTip-20)-recoil;
    actor.gun.setPosition(Math.cos(s.aim)*gunAdvance,-34+Math.sin(s.aim)*gunAdvance).setRotation(s.aim+(reload?face*.18:0)).setScale(1,face).setVisible(s.alive);
    actor.label.setText(s.human?'YOU  /  '+s.name:s.name).setPosition(0,-83).setAlpha(s.alive?1:0);
    g.fillStyle(0x0e222e,.85).fillRoundedRect(-21,-73,42,4,2);g.fillStyle(team).fillRoundedRect(-21,-73,42*clamp(s.health/s.maxHealth,0,1),4,2);
    if(s.team===0)g.fillStyle(team).fillPoints([{x:-3,y:-91},{x:0,y:-94},{x:3,y:-91},{x:0,y:-88}],true);
    else g.fillStyle(team).fillTriangle(-3,-93,3,-93,0,-87);
    if(s.human)g.lineStyle(1,0xffffff,.8).strokeCircle(0,-91,5);
  }

  private drawObjects(g:Phaser.GameObjects.Graphics,state:MatchState):void{
    for(const crate of state.crates){
      if(!this.visible({x:crate.x-25,y:crate.y-40,w:50,h:45}))continue;
      const ready=crate.readyAt<=state.time,c=WEAPONS[crate.weapon].rarity==='epic'?0xcc9af0:WEAPONS[crate.weapon].rarity==='rare'?0x85bddf:0xd9c08d;
      g.fillStyle(0x101f28,.35).fillEllipse(crate.x,crate.y+2,45,10);
      g.fillStyle(ready?0x52665e:0x34464a).fillRoundedRect(crate.x-22,crate.y-23,44,22,3);g.lineStyle(2,0x152831).strokeRoundedRect(crate.x-22,crate.y-23,44,22,3);
      g.fillStyle(ready?c:0x718179).fillRect(crate.x-20,crate.y-22,40,3).fillRect(crate.x-14,crate.y-21,4,20).fillRect(crate.x+10,crate.y-21,4,20);
      g.fillStyle(0xc2b594).fillRect(crate.x-3,crate.y-15,6,5);
      if(ready){g.lineStyle(2,c,.3).strokeEllipse(crate.x,crate.y-15,58,36);g.fillStyle(c).fillTriangle(crate.x-3,crate.y-33,crate.x+3,crate.y-33,crate.x,crate.y-28);}
    }
    for(const loot of state.loot){
      if(!this.visible({x:loot.x-20,y:loot.y-15,w:40,h:20}))continue;
      g.fillStyle(0xc6cbb0,.2).fillEllipse(loot.x,loot.y,31,12);
      g.fillStyle(0x668472).fillRoundedRect(loot.x-10,loot.y-13,20,12,2);g.lineStyle(1,0xd3cfaa).strokeRoundedRect(loot.x-10,loot.y-13,20,12,2);
      g.fillStyle(0xe3d6aa).fillRect(loot.x-6,loot.y-10,3,7).fillRect(loot.x-1,loot.y-10,3,7).fillRect(loot.x+4,loot.y-10,3,7);
      if(loot.weapon)g.lineStyle(2,0xc3adf0).lineBetween(loot.x-13,loot.y-17,loot.x+13,loot.y-17);
    }
    for(const station of state.stations){
      if(station.team!==this.team&&!this.pointVisible(state,{x:station.x,y:station.y-10}))continue;
      const c=station.team===0?0x83d6a6:0xf1b291;
      g.fillStyle(c,.055).fillEllipse(station.x,station.y-5,250,95);g.lineStyle(1,c,.18).strokeEllipse(station.x,station.y-5,250,95);
      g.fillStyle(0x203d36).fillRoundedRect(station.x-15,station.y-20,30,20,4);g.lineStyle(2,c,.8).strokeRoundedRect(station.x-15,station.y-20,30,20,4);
      g.fillStyle(0xd5e8ce).fillRect(station.x-8,station.y-14,16,5).fillRect(station.x-2.5,station.y-19,5,15);
      for(let i=0;i<3;i++){const rise=this.options.reducedMotion?15:(this.time*25+i*17)%55;g.fillStyle(c,(1-rise/60)*.55).fillRect(station.x-42+i*39-3,station.y-rise-2,6,2).fillRect(station.x-42+i*39-1,station.y-rise-4,2,6);}
    }
    const seen=new Set<number>();
    for(const flag of state.flags){
      seen.add(flag.id);const c=flag.owner===null?0xc4c8ae:flag.owner===0?BLUE:RED;
      g.lineStyle(4,0x17303c).lineBetween(flag.x,flag.y,flag.x,flag.y-93);g.lineStyle(2,0xa4b5b3).lineBetween(flag.x,flag.y,flag.x,flag.y-93);
      const wave=this.options.reducedMotion?0:Math.sin(this.time*3+flag.id)*3;
      g.fillStyle(c,.9).fillPoints([{x:flag.x+2,y:flag.y-91},{x:flag.x+46,y:flag.y-87+wave},{x:flag.x+39,y:flag.y-61+wave},{x:flag.x+2,y:flag.y-67}],true);
      g.fillStyle(0x243a43).fillEllipse(flag.x,flag.y,30,9);
      if(flag.capturing!==null){g.lineStyle(3,flag.capturing===0?BLUE:RED,.7).strokeCircle(flag.x,flag.y-109,15);g.fillStyle(flag.capturing===0?BLUE:RED).fillRoundedRect(flag.x-18,flag.y-133,36*flag.progress,3,1);}
      let label=this.flags.get(flag.id);if(!label){label=this.scene!.add.text(0,0,flag.label,{fontFamily:'sans-serif',fontSize:'15px',fontStyle:'bold',color:'#102934'}).setDepth(5).setOrigin(.5);this.flags.set(flag.id,label);}
      label.setPosition(flag.x+23,flag.y-78+wave*.5);
    }
    for(const[id,label]of this.flags)if(!seen.has(id)){label.destroy();this.flags.delete(id);}
  }

  private drawHazards(g:Phaser.GameObjects.Graphics,state:MatchState):void{
    for(const hazard of state.arena.hazards){
      if(!this.visible(hazard))continue;
      const active=state.time>=hazard.starts&&state.time<hazard.ends,warning=state.time<hazard.starts&&hazard.starts-state.time<3;
      if(!active&&!warning)continue;
      const c=hazard.kind==='flood'?0x79bfce:hazard.kind==='steam'?0xdbd9b9:0xf3a666;
      g.fillStyle(c,active?.12:.06).fillRect(hazard.x,hazard.y,hazard.w,hazard.h);g.lineStyle(2,c,.55).strokeRect(hazard.x,hazard.y,hazard.w,hazard.h);
      if(warning){for(let x=hazard.x;x<hazard.x+hazard.w;x+=35)g.fillStyle(c,.35).fillTriangle(x,hazard.y+hazard.h-3,x+12,hazard.y+hazard.h-23,x+24,hazard.y+hazard.h-3);}
      else if(hazard.kind==='steam'){
        for(let i=0;i<8;i++){const rise=this.options.reducedMotion?i*7:(this.time*70+i*13)%Math.max(30,hazard.h);g.fillStyle(0xe0e9e4,.22).fillEllipse(hazard.x+hazard.w*(i+.5)/8,hazard.y+hazard.h-rise,18+rise*.15,30);}
      }else if(hazard.kind==='fire'){
        for(let x=hazard.x+10;x<hazard.x+hazard.w;x+=23){const height=26+(this.options.reducedMotion?0:Math.sin(this.time*9+x)*8);g.fillStyle(0xe69c5d,.75).fillTriangle(x-9,hazard.y+hazard.h,x,hazard.y+hazard.h-height,x+9,hazard.y+hazard.h);g.fillStyle(0xffd39a,.8).fillTriangle(x-4,hazard.y+hazard.h,x+1,hazard.y+hazard.h-height*.65,x+5,hazard.y+hazard.h);}
      }
    }
    if(state.weather.floodY<state.arena.height){
      const y=state.weather.floodY;g.fillStyle(0x3b8197,.38).fillRect(this.camera.x,y,W,state.arena.height-y);
      g.lineStyle(2,0x9bd5d5,.65);for(let x=this.camera.x-20;x<this.camera.x+W;x+=35){const ripple=this.options.reducedMotion?0:Math.sin(this.time*2+x*.02)*3;g.lineBetween(x,y+ripple,x+30,y+ripple);}
    }
  }

  private drawCombat(g:Phaser.GameObjects.Graphics,state:MatchState):void{
    for(const tracer of state.tracers){
      const owner=state.soldiers.find(s=>s.id===tracer.owner);
      if(owner&&!this.soldierVisible(owner))continue;
      const life=clamp((tracer.until-state.time)/.085,0,1);g.lineStyle(3,0xf1c987,life*.15).lineBetween(tracer.from.x,tracer.from.y,tracer.to.x,tracer.to.y);
      g.lineStyle(1.2,0xffe0a0,life*.8).lineBetween(tracer.from.x,tracer.from.y,tracer.to.x,tracer.to.y);
    }
    for(const s of state.soldiers){
      if(!s.alive||!this.soldierVisible(s)||state.time-s.lastShotAt>.055)continue;
      const x=s.x+Math.cos(s.aim)*33,y=s.y-34+Math.sin(s.aim)*33;
      const a=s.aim;const point=(along:number,side:number):Vec=>({x:x+Math.cos(a)*along-Math.sin(a)*side,y:y+Math.sin(a)*along+Math.cos(a)*side});
      g.fillStyle(0xffc67a,.9).fillPoints([point(0,-3),point(6,-8),point(7,-3),point(20,0),point(7,3),point(6,8),point(0,3)],true);
      g.fillStyle(0xfff1cb).fillCircle(x+Math.cos(a)*5,y+Math.sin(a)*5,4);
    }
    for(const projectile of state.projectiles){
      const owner=state.soldiers.find(s=>s.id===projectile.owner);
      if(owner?.team!==this.team&&!this.pointVisible(state,projectile))continue;
      if(projectile.kind==='bullet'){g.lineStyle(2,0xffd797).lineBetween(projectile.x,projectile.y,projectile.x-projectile.vx*.015,projectile.y-projectile.vy*.015);continue;}
      const angle=Math.atan2(projectile.vy,projectile.vx);
      if(projectile.kind==='rocket'){g.lineStyle(5,0xa5a98a).lineBetween(projectile.x-Math.cos(angle)*8,projectile.y-Math.sin(angle)*8,projectile.x+Math.cos(angle)*8,projectile.y+Math.sin(angle)*8);g.fillStyle(0xffb66e).fillCircle(projectile.x-Math.cos(angle)*11,projectile.y-Math.sin(angle)*11,4);}
      else{g.fillStyle(0x86936e).fillCircle(projectile.x,projectile.y,5);g.lineStyle(1.5,0x243a37).strokeCircle(projectile.x,projectile.y,5);g.fillStyle(0xe6ca89).fillCircle(projectile.x,projectile.y-5,2);}
    }
  }

  private emit(x:number,y:number,color:number,count:number,speed:number,gravity:number):void{
    if(!this.options.particles)return;const cap=this.options.quality==='low'?100:this.options.quality==='medium'?240:420;
    if(this.options.reducedMotion)count=Math.min(count,3);
    for(let i=0;i<count&&this.particles.length<cap;i++){const a=i*2.399+this.time,v=speed*(.35+(i*17%67)/100),life=.2+(i%7)*.07;this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-speed*.15,life,max:life,size:2+i%3,color,gravity});}
  }
  private drawParticles(g:Phaser.GameObjects.Graphics,dt:number):void{
    for(let i=this.bursts.length-1;i>=0;i--){
      const burst=this.bursts[i]!;burst.life-=dt;if(burst.life<=0){this.bursts.splice(i,1);continue;}
      const life=burst.life/burst.max,radius=burst.radius*(this.options.reducedMotion?.55:1-life*.8);
      g.fillStyle(0xf7bd7a,life*.18).fillCircle(burst.x,burst.y,radius*.8);
      g.lineStyle(2+life*2,0xffdda4,life*.6).strokeCircle(burst.x,burst.y,radius);
      g.fillStyle(0xffdfa1,life*.5).fillCircle(burst.x,burst.y,16*life);
    }
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i]!;p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.gravity*dt;g.fillStyle(p.color,p.life/p.max).fillCircle(p.x,p.y,p.size*(.5+p.life/p.max*.5));}
  }
  private drawWeather(state:MatchState):void{
    const g=this.weather!.clear(),weather=state.weather,t=this.options.reducedMotion?0:this.time;
    if(weather.lighting<1)g.fillStyle(0x071724,clamp((1-weather.lighting)*.65,0,.6)).fillRect(0,0,W,H);
    if(weather.fog>0){const alpha=clamp(weather.fog,0,1)*.11;for(let i=0;i<4;i++)g.fillStyle(0xb9ceca,alpha).fillEllipse((i*331+t*7)%1300-140,220+i*75,700,170);}
    if(weather.rain>0&&!this.options.reducedMotion){
      const count=this.options.quality==='low'?25:this.options.quality==='medium'?55:90;
      g.lineStyle(1,0xc7e4e7,clamp(weather.rain,0,1)*.3);
      for(let i=0;i<count;i++){const x=(i*137+t*(weather.wind*20-80)+W*100)%W,y=(i*93+t*550)%H;g.lineBetween(x,y,x+weather.wind*3-4,y+14);}
    }
    if((state.arena.id==='ship'||state.arena.id==='harbor')&&!this.options.reducedMotion){
      const flash=Math.sin(state.time*1.7)> .998&&state.environment.activeUntil>state.time?.12:0;
      if(flash)g.fillStyle(0xd7edf1,flash).fillRect(0,0,W,H);
    }
    // Soft vignette keeps the sightline readable without hiding any geometry.
    g.fillGradientStyle(0x071522,0x071522,0x071522,0x071522,.2,.2,0,0).fillRect(0,0,W,60);
    g.fillGradientStyle(0x071522,0x071522,0x071522,0x071522,0,0,.2,.2).fillRect(0,H-60,W,60);
  }
}
