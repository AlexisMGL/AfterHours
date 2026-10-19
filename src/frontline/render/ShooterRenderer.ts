import Phaser from 'phaser';
import type { ClassId, MapId, MatchState, Platform, Rect, Soldier, Vec, WeaponId } from '../core/types';
import { clamp } from '../core/types';
import { CLASSES, WEAPONS } from '../core/config';

export interface RenderOptions { quality:'low'|'medium'|'high';particles:boolean;shake:boolean;reducedMotion?:boolean }
interface Actor { root:Phaser.GameObjects.Container;body:Phaser.GameObjects.Graphics;gun:Phaser.GameObjects.Image;label:Phaser.GameObjects.Text;lastAlive:boolean }
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
  private options:RenderOptions;
  private camera:Rect={x:0,y:0,w:W,h:H};
  private followId=0;
  private cameraReady=false;
  private time=0;
  private eventTick=-1;
  private map?:MapId;
  private structure='';
  private actors=new Map<number,Actor>();
  private particles:Particle[]=[];
  private bursts:{x:number;y:number;life:number;max:number;radius:number}[]=[];
  private backdrop?:Phaser.GameObjects.Graphics;
  private far?:Phaser.GameObjects.Graphics;
  private near?:Phaser.GameObjects.Graphics;
  private geometry?:Phaser.GameObjects.Graphics;
  private world?:Phaser.GameObjects.Graphics;
  private effects?:Phaser.GameObjects.Graphics;
  private weather?:Phaser.GameObjects.Graphics;
  private signs:Phaser.GameObjects.Text[]=[];
  private flags=new Map<number,Phaser.GameObjects.Text>();

  constructor(container:HTMLElement,options:RenderOptions={quality:'high',particles:true,shake:true}) {
    this.options={...options}; const owner=this;
    class ShooterScene extends Phaser.Scene {
      constructor(){super('frontline');}
      create():void{owner.initialize(this);}
      update(_time:number,delta:number):void{owner.paint(Math.min(.05,delta/1000));}
    }
    this.game=new Phaser.Game({type:Phaser.AUTO,parent:container,width:W,height:H,transparent:true,banner:false,
      antialias:true,pixelArt:false,roundPixels:false,audio:{noAudio:true},input:{keyboard:false},
      scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:W,height:H},scene:ShooterScene,
      render:{powerPreference:'high-performance'}});
  }
  render(state:MatchState,_dt?:number):void{this.state=state;}
  follow(id:number):void{if(this.followId!==id){this.followId=id;this.cameraReady=false;}}
  getCamera():Rect{return {...this.camera};}
  screenToWorld(clientX:number,clientY:number):Vec{
    const rect=this.game.canvas.getBoundingClientRect();
    return {x:this.camera.x+(clientX-rect.left)*W/Math.max(1,rect.width),y:this.camera.y+(clientY-rect.top)*H/Math.max(1,rect.height)};
  }
  setOptions(partial:Partial<RenderOptions>):void{this.options={...this.options,...partial};if(!this.options.particles)this.particles=[];}
  destroy():void{this.game.destroy(true);this.particles=[];this.bursts=[];this.actors.clear();}

  private initialize(scene:Phaser.Scene):void{
    this.scene=scene;
    this.backdrop=scene.add.graphics().setDepth(-50).setScrollFactor(0);
    this.far=scene.add.graphics().setDepth(-40).setScrollFactor(.16,.10);
    this.near=scene.add.graphics().setDepth(-30).setScrollFactor(.38,.24);
    this.geometry=scene.add.graphics().setDepth(0);
    this.world=scene.add.graphics().setDepth(4);
    this.effects=scene.add.graphics().setDepth(30);
    this.weather=scene.add.graphics().setDepth(40).setScrollFactor(0);
    const art=scene.make.graphics({x:0,y:0});
    for(const id of Object.keys(WEAPONS) as WeaponId[]){art.clear();this.weaponArt(art,id);art.generateTexture(`fh-gun-${id}`,64,32);}
    art.destroy();
  }

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
    if(this.map!==state.arena.id){this.map=state.arena.id;this.cameraReady=false;this.particles=[];this.bursts=[];this.background(state);this.structure='';}
    const signature=state.arena.platforms.map(p=>`${p.id}:${Number(p.active)}`).join(',');
    if(signature!==this.structure){this.structure=signature;this.drawGeometry(state);}
    this.updateCamera(state,dt);
    const g=this.world.clear(),fx=this.effects.clear();
    for(const platform of state.arena.platforms)if(platform.active&&platform.moving&&this.visible(platform,100))this.drawPlatform(g,platform,state.arena.id);
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
    this.drawParticles(fx,dt);this.drawWeather(state);
  }

  private updateCamera(state:MatchState,dt:number):void{
    const target=state.soldiers.find(s=>s.id===this.followId)??state.soldiers[0];if(!target)return;
    const lead=target.alive?Math.cos(target.aim)*105:0;
    const desiredX=clamp(target.x+lead-W*.5,0,Math.max(0,state.arena.width-W));
    const desiredY=clamp(target.y-145+Math.sin(target.aim)*35-H*.5,0,Math.max(0,state.arena.height-H));
    const blend=this.cameraReady?1-Math.exp(-dt*5.8):1;
    this.camera.x+=(desiredX-this.camera.x)*blend;this.camera.y+=(desiredY-this.camera.y)*blend;
    this.cameraReady=true;this.scene!.cameras.main.setScroll(this.camera.x,this.camera.y);
  }
  private visible(rect:Rect,pad=0):boolean{return rect.x+rect.w>=this.camera.x-pad&&rect.x<=this.camera.x+W+pad&&rect.y+rect.h>=this.camera.y-pad&&rect.y<=this.camera.y+H+pad;}

  private background(state:MatchState):void{
    const bg=this.backdrop!.clear(),far=this.far!.clear(),near=this.near!.clear();
    const map=state.arena.id,p=state.arena.palette;
    bg.fillGradientStyle(hex(p.sky),hex(p.sky),hex(p.far),hex(p.far)).fillRect(0,0,W,H);
    bg.fillStyle(0xf3d6a0,.06).fillCircle(740,90,110).fillCircle(740,90,165);
    far.fillStyle(hex(p.far));near.fillStyle(hex(p.near));
    if(map==='forest'){
      far.fillStyle(0x627b79,.4).fillTriangle(-120,450,350,130,820,450).fillTriangle(400,460,930,75,1400,460).fillTriangle(1100,460,1650,190,2200,460);
      for(let i=0;i<34;i++)this.tree(far,i*115,430,145+(i*73)%180,0x344e4e,.75);
      for(let i=0;i<45;i++)this.tree(near,i*119,660,170+(i*37)%220,i%2?0x223e39:0x2a4941,.92);
      near.fillStyle(0x233c35).fillRect(0,610,5000,600);
      for(let i=0;i<20;i++){near.fillStyle(0x5c7564,.25).fillEllipse(i*240+70,580,290,100);}
    }else if(map==='city'){
      for(let i=0;i<35;i++){
        const x=i*145,h=130+(i*67)%220;far.fillStyle(i%2?0x34434f:0x2b3d49).fillRect(x,440-h,130,h+400);
        for(let a=0;a<4;a++)for(let b=0;b<Math.floor(h/30);b++)far.fillStyle((a+b+i)%4===0?0xd5b985:0x5e727b,(a+b+i)%4===0?.35:.22).fillRect(x+16+a*27,455-h+b*29,10,16);
      }
      for(let i=0;i<17;i++){
        const x=i*290,h=200+(i*83)%190;near.fillStyle(0x26343e).fillRect(x,590-h,260,h+500);
        near.fillStyle(0x58686c,.3).fillRect(x,590-h,260,8);
        near.lineStyle(2,0x1c303b).lineBetween(x+35,590-h,x+35,590);
        near.fillStyle(0x86a4a4,.22).fillRect(x+55,620-h,45,55).fillRect(x+130,620-h,45,55);
        near.fillStyle(0x1e303c).fillTriangle(x+40,590-h,x+95,565-h,x+140,590-h);
      }
    }else if(map==='harbor'){
      far.fillStyle(0x294b5a).fillRect(0,390,5000,500);
      for(let i=0;i<12;i++){
        const x=i*390;far.fillStyle(0x344c56).fillTriangle(x,382,x+330,382,x+280,426).fillRect(x+80,350,165,35);
        far.fillStyle(0x7f8170,.5).fillRect(x+230,315,45,40);far.fillStyle(0x425e68).fillRect(x+250,275,5,40);
      }
      for(let i=0;i<11;i++){
        const x=i*470;near.lineStyle(9,0x344a53).lineBetween(x+90,540,x+90,145).lineBetween(x+90,150,x+340,150).lineBetween(x+90,150,x+215,70).lineBetween(x+215,70,x+340,150);
        near.lineStyle(2,0x6d827f,.45).lineBetween(x+290,150,x+290,360);near.fillStyle(0x5d675d).fillRect(x+265,360,50,37);
        near.fillStyle(0x233b46).fillRect(x,505,450,200);
      }
    }else if(map==='ship'){
      far.fillStyle(0x183e52).fillRect(0,365,5000,700);
      far.fillStyle(0x789ca4,.25).fillTriangle(180,385,280,370,450,385).fillTriangle(650,379,800,363,1000,379);
      for(let i=0;i<10;i++){
        const x=i*510;near.fillStyle(0x273f4a).fillRect(x+30,400,330,320).fillRect(x+100,290,230,110).fillRect(x+170,230,130,60);
        near.fillStyle(0x78999e,.4).fillRect(x+180,241,24,25).fillRect(x+211,241,24,25).fillRect(x+242,241,42,25);
        near.lineStyle(4,0x607a81,.55).lineBetween(x+239,230,x+239,120).lineBetween(x+192,166,x+286,166);
        near.lineStyle(2,0x879e9d,.45).strokeEllipse(x+238,148,70,17);
        near.fillStyle(0x526770,.55).fillRect(x+40,360,45,40);
      }
    }else if(map==='factory'){
      for(let i=0;i<19;i++){
        const x=i*270,h=120+(i*79)%180;far.fillStyle(0x293b43).fillRect(x,440-h,250,h+350);
        far.fillStyle(0x3b4c50).fillRoundedRect(x+30,190,34,250,9).fillRoundedRect(x+85,250,26,190,7);
        far.lineStyle(11,0x485858,.7).lineBetween(x+40,300,x+170,300).lineBetween(x+170,300,x+170,440);
      }
      for(let i=0;i<16;i++){
        const x=i*330;near.fillStyle(0x23323a).fillRect(x+20,430,240,250);
        near.fillStyle(0x695841,.55).fillRoundedRect(x+50,475,160,75,12);
        near.fillStyle(0xe2a36b,.25).fillRoundedRect(x+62,489,135,48,8);
        near.lineStyle(15,0x3c4c50).lineBetween(x,600,x,190).lineBetween(x,190,x+290,190);
      }
    }else{
      bg.fillStyle(0x8caaad,.2).fillEllipse(340,170,450,85).fillEllipse(800,70,330,90);
      far.fillStyle(0x283d4a,.8).fillRoundedRect(-200,-100,5200,900,170);
      for(let i=0;i<24;i++){
        const x=i*230;far.fillStyle(0x132a39).fillRoundedRect(x+35,145,110,160,48);
        far.fillStyle(0x9eb4b6,.55).fillRoundedRect(x+40,150,100,150,43);
        far.fillStyle(0xe7d8b1,.3).fillEllipse(x+90,175,88,30);far.fillStyle(0x668b9c,.4).fillTriangle(x+42,300,x+140,218,x+140,300);
      }
      for(let i=0;i<18;i++){
        const x=i*310;near.lineStyle(17,0x3d5159,.7).strokeRoundedRect(x,-160,275,880,115);
        near.lineStyle(3,0x8a9b9a,.3).strokeRoundedRect(x+10,-140,255,840,105);
        near.fillStyle(0x233944,.6).fillRect(x+20,620,220,400);
      }
    }
    bg.fillStyle(0xffffff,.025).fillEllipse(220,50,500,400);
  }

  private tree(g:Phaser.GameObjects.Graphics,x:number,y:number,h:number,c:number,alpha:number):void{
    g.fillStyle(c,alpha).fillRoundedRect(x-8,y-h,16,h,7);
    g.fillEllipse(x,y-h+10,h*.62,h*.7).fillEllipse(x-h*.2,y-h*.7,h*.49,h*.46).fillEllipse(x+h*.2,y-h*.7,h*.51,h*.51);
    g.fillStyle(0x8ea18b,.06*alpha).fillEllipse(x-h*.1,y-h*1.08,h*.43,h*.19);
  }

  private drawGeometry(state:MatchState):void{
    const g=this.geometry!.clear();for(const sign of this.signs)sign.destroy();this.signs=[];
    for(const ladder of state.arena.ladders){
      g.lineStyle(6,0x182a35).lineBetween(ladder.x+5,ladder.y,ladder.x+5,ladder.y+ladder.h).lineBetween(ladder.x+ladder.w-5,ladder.y,ladder.x+ladder.w-5,ladder.y+ladder.h);
      g.lineStyle(3,0x91a4a5).lineBetween(ladder.x+5,ladder.y,ladder.x+5,ladder.y+ladder.h).lineBetween(ladder.x+ladder.w-5,ladder.y,ladder.x+ladder.w-5,ladder.y+ladder.h);
      for(let y=ladder.y+7;y<ladder.y+ladder.h;y+=17)g.lineStyle(3,0x809696).lineBetween(ladder.x+5,y,ladder.x+ladder.w-5,y);
    }
    for(const platform of state.arena.platforms)if(platform.active&&!platform.moving)this.drawPlatform(g,platform,state.arena.id);
    const map=state.arena.id;
    for(let i=0;i<state.arena.width/700;i++){
      const x=i*700+170,y=170+(i%3)*300;
      if(map==='forest')continue;
      g.fillStyle(0x122732,.85).fillRoundedRect(x,y,210,28,3);g.lineStyle(1,0xa9b7b0,.25).strokeRoundedRect(x,y,210,28,3);
      const text=this.scene!.add.text(x+105,y+14,`${OFFICERS[map].split(' / ')[0]}  ${String(i+1).padStart(2,'0')}`,{fontFamily:'sans-serif',fontSize:'10px',fontStyle:'bold',color:'#a8bdb8'}).setOrigin(.5).setDepth(-1);
      this.signs.push(text);
    }
  }

  private drawPlatform(g:Phaser.GameObjects.Graphics,p:Platform,map:MapId):void{
    const{x,y,w,h}=p;const steel=p.material==='metal',wood=p.material==='wood',glass=p.material==='glass';
    const body=glass?0x739da7:wood?0x645749:map==='forest'?0x4e5e55:map==='city'?0x4f5657:hex(this.state!.arena.palette.ground);
    g.fillStyle(0x0d202b,.55).fillRoundedRect(x+3,y+5,w,Math.max(6,h),2);
    g.fillStyle(body,glass?.35:1).fillRoundedRect(x,y,w,Math.max(6,h),2);
    g.fillStyle(glass?0xb6ebed:hex(this.state!.arena.palette.edge),glass?.6:.9).fillRect(x,y,w,4);
    g.lineStyle(1,0x102631,.75).strokeRect(x,y,w,Math.max(6,h));
    if(glass){g.lineStyle(2,0xc0f0ee,.5).lineBetween(x+5,y+h-2,x+Math.min(w-3,35),y+3).lineBetween(x+w*.6,y+h-3,x+w*.8,y+3);return;}
    if(p.oneWay){
      g.lineStyle(2,0x263a41,.75);
      for(let a=x+14;a<x+w;a+=40)g.lineBetween(a,y+5,a+16,y+Math.min(17,h));
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
      const root=this.scene!.add.container(s.x,s.y).setDepth(12),body=this.scene!.add.graphics();
      const gun=this.scene!.add.image(0,-34,`fh-gun-${s.weapons[s.activeWeapon].id}`).setOrigin(20/64,.5);
      const label=this.scene!.add.text(0,-79,s.name,{fontFamily:'sans-serif',fontSize:'10px',fontStyle:'bold',color:s.team===0?'#b9e4ed':'#f6b3ad',stroke:'#13232d',strokeThickness:3}).setOrigin(.5);
      root.add([body,gun,label]);actor={root,body,gun,label,lastAlive:s.alive};this.actors.set(s.id,actor);
    }
    const deathAge=state.time-s.deathAt;
    const visible=this.visible({x:s.x-45,y:s.y-90,w:90,h:100},70)&&(s.alive||deathAge<.7);
    actor.root.setVisible(visible);actor.lastAlive=s.alive;if(!visible)return;
    actor.root.setPosition(s.x,s.y).setAlpha(s.alive?1:clamp(1-deathAge/.7,0,1));
    actor.root.setRotation(!s.alive&&!this.options.reducedMotion?Math.min(1,deathAge*4)*(Math.cos(s.aim)>=0?1:-1)*1.35:0);
    const g=actor.body.clear(),team=s.team===0?BLUE:RED,face=Math.cos(s.aim)>=0?1:-1;
    const active=s.abilityUntil>state.time,focus=state.soldiers.find(p=>p.id===this.followId)?.classId==='sniper'&&(state.soldiers.find(p=>p.id===this.followId)?.abilityUntil??0)>state.time;
    const uniform=s.team===0?0x405c68:0x70544c,light=s.team===0?0x66838a:0x927363;
    const run=s.grounded&&Math.abs(s.vx)>12&&!this.options.reducedMotion?Math.sin(this.time*13+ s.id)*Math.min(1,Math.abs(s.vx)/200):0;
    const bob=s.grounded?Math.abs(run)*1.4:0;
    const hurt=s.hurtUntil>state.time;
    const skin=hurt?0xffe1c7:0xc5aa87;
    if(s.grounded)g.fillStyle(0x06131d,.3).fillEllipse(0,1,34,9);
    if(s.protectedUntil>state.time){g.lineStyle(2,team,.5).strokeEllipse(0,-30,47,69);g.fillStyle(team,.055).fillEllipse(0,-30,47,69);}
    if(focus&&s.team===1){g.lineStyle(2,0xe4c7ff,.75).strokeRoundedRect(-18,-61,36,64,12);}
    const airborne=s.grounded?0:s.vy<0?1:-1;
    const footA={x:-7+run*10+(airborne?6:0),y:airborne?-7:0},footB={x:7-run*10-(airborne?4:0),y:airborne?-3:0};
    this.limb(g,{x:-6,y:-22-bob},{x:-8-run*6,y:-11+(airborne?-3:0)},8,uniform);
    this.limb(g,{x:-8-run*6,y:-11+(airborne?-3:0)},footA,7,light);
    this.limb(g,{x:6,y:-22-bob},{x:7+run*6,y:-10+(airborne?-2:0)},8,uniform);
    this.limb(g,{x:7+run*6,y:-10+(airborne?-2:0)},footB,7,light);
    g.fillStyle(0x1b2c34).fillRoundedRect(footA.x-5,footA.y-3,12,6,3).fillRoundedRect(footB.x-5,footB.y-3,12,6,3);
    // Chest plate, belt and class gear create four distinct silhouettes.
    g.lineStyle(2,INK).fillStyle(uniform).fillRoundedRect(-12,-39-bob,24,21,6).strokeRoundedRect(-12,-39-bob,24,21,6);
    g.fillStyle(light).fillRoundedRect(-8,-37-bob,17,14,4);g.fillStyle(0x20343d).fillRoundedRect(-10,-25-bob,21,6,2);
    g.fillStyle(0xa2a58b).fillRect(-7,-24-bob,4,4).fillRect(1,-24-bob,4,4);
    g.fillStyle(team).fillRoundedRect(-10,-38-bob,6,10,2);
    if(s.classId==='support'){
      g.fillStyle(0x304c43).fillRoundedRect(-face*17-5,-39,11,23,4);g.lineStyle(2,0x172d31).strokeRoundedRect(-face*17-5,-39,11,23,4);
      g.fillStyle(0xd5e5c7).fillRect(-face*17-3,-32,7,3).fillRect(-face*17-1,-34,3,7);
    }else if(s.classId==='defense'){
      g.fillStyle(0x6d8185).fillRoundedRect(-17,-40,34,13,5);g.lineStyle(2,INK).strokeRoundedRect(-17,-40,34,13,5);
      g.fillStyle(team).fillRect(-14,-38,7,4).fillRect(7,-38,7,4);
    }else if(s.classId==='sniper'){
      g.fillStyle(0x526557).fillTriangle(-13,-40,-20,-17,6,-22);g.lineStyle(1,0x839078,.6).lineBetween(-11,-35,-15,-21);
    }else{g.fillStyle(0xd4b67b).fillRoundedRect(-6,-35,5,8,1);}
    // Neck, face, sculpted helmet, chin and earpiece remain readable at gameplay scale.
    g.fillStyle(skin).fillRoundedRect(-4,-46-bob,8,9,2).fillEllipse(face*2,-47-bob,19,21);
    g.fillStyle(0x9f866d).fillEllipse(-face*8,-46-bob,5,8);
    g.fillStyle(s.classId==='sniper'?0x5b6d58:uniform).fillRoundedRect(-13,-59-bob,26,17,9);
    g.lineStyle(2,INK).strokeRoundedRect(-13,-59-bob,26,17,9);
    g.fillStyle(light).fillRoundedRect(-10,-57-bob,17,5,3);
    g.fillStyle(0x1c3039).fillRoundedRect(face>0?-2:-11,-50-bob,14,6,2);
    g.fillStyle(team).fillRoundedRect(face>0?1:-10,-49-bob,10,2,1);
    g.fillStyle(0x314852).fillEllipse(-face*9,-47-bob,7,10);g.fillStyle(0xaab5a5).fillCircle(-face*9,-47-bob,2);
    g.fillStyle(skin).fillTriangle(face*9,-46-bob,face*14,-44-bob,face*9,-42-bob);
    g.fillStyle(0x384b4c).fillRoundedRect(-3,-42-bob,11,4,2);
    const weapon=s.weapons[s.activeWeapon],reload=weapon.reloadUntil>state.time;
    const recoil=state.time-s.lastShotAt<.09?(1-clamp((state.time-s.lastShotAt)/.09,0,1))*3:0;
    const shoulder={x:face*2,y:-34-bob},hand={x:Math.cos(s.aim)*(18-recoil),y:-34+Math.sin(s.aim)*(18-recoil)-bob};
    const elbow={x:face*2+Math.cos(s.aim)*8,y:-23+Math.sin(s.aim)*7-bob};
    this.limb(g,shoulder,elbow,8,light);this.limb(g,elbow,hand,7,uniform);g.fillStyle(skin).fillCircle(hand.x,hand.y,4);
    const offHand=reload?{x:face*(7+Math.sin(this.time*16)*3),y:-22-bob}:{x:Math.cos(s.aim)*11,y:-34+Math.sin(s.aim)*11+5-bob};
    this.limb(g,{x:-face*7,y:-33-bob},{x:-face*4,y:-24-bob},7,uniform);this.limb(g,{x:-face*4,y:-24-bob},offHand,6,light);g.fillStyle(skin).fillCircle(offHand.x,offHand.y,3.5);
    const category=WEAPONS[weapon.id].category;
    const authoredTip=weapon.id==='hush'?48:category==='pistol'?37:['lmg','sniper','launcher'].includes(category)?55:category==='rocket'?57:49;
    const gunAdvance=32-(authoredTip-20)-recoil;
    actor.gun.setTexture(`fh-gun-${weapon.id}`).setPosition(Math.cos(s.aim)*gunAdvance,-34-bob+Math.sin(s.aim)*gunAdvance).setRotation(s.aim+(reload?face*.18:0)).setScale(1,face).setVisible(s.alive);
    actor.label.setText(s.human?'YOU  /  '+s.name:s.name).setPosition(0,-80).setAlpha(s.alive?1:0);
    g.fillStyle(0x0e222e,.85).fillRoundedRect(-21,-70,42,4,2);g.fillStyle(team).fillRoundedRect(-21,-70,42*clamp(s.health/s.maxHealth,0,1),4,2);
    if(s.team===0){g.fillStyle(team).fillPoints([{x:-3,y:-88},{x:0,y:-91},{x:3,y:-88},{x:0,y:-85}],true);}
    else g.fillStyle(team).fillTriangle(-3,-90,3,-90,0,-84);
    if(s.human)g.lineStyle(1,0xffffff,.8).strokeCircle(0,-88,5);
    if(active){
      const c=hex(CLASSES[s.classId].color);
      if(s.classId==='defense'&&s.shieldHealth>0){const sx=face*26;g.fillStyle(0x7bbbd9,.22).fillRoundedRect(sx-4,-54,8,49,3);g.lineStyle(2,0xade1ef,.9).strokeRoundedRect(sx-4,-54,8,49,3);g.lineStyle(2,0x7ca9ba,.6).lineBetween(sx-3,-38,sx+3,-38);}
      else{g.lineStyle(1.5,c,.55).strokeEllipse(0,-30,40,64);g.fillStyle(c,.06).fillEllipse(0,-30,40,64);}
    }
    if(hurt){g.lineStyle(2,0xffc3a7,.8).strokeEllipse(0,-31,37,61);}
  }

  private limb(g:Phaser.GameObjects.Graphics,a:Vec,b:Vec,width:number,c:number):void{
    g.lineStyle(width+3,INK).lineBetween(a.x,a.y,b.x,b.y);g.fillStyle(INK).fillCircle(a.x,a.y,(width+3)/2).fillCircle(b.x,b.y,(width+3)/2);
    g.lineStyle(width,c).lineBetween(a.x,a.y,b.x,b.y);g.fillStyle(c).fillCircle(a.x,a.y,width/2).fillCircle(b.x,b.y,width/2);
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
      const life=clamp((tracer.until-state.time)/.085,0,1);g.lineStyle(3,0xf1c987,life*.15).lineBetween(tracer.from.x,tracer.from.y,tracer.to.x,tracer.to.y);
      g.lineStyle(1.2,0xffe0a0,life*.8).lineBetween(tracer.from.x,tracer.from.y,tracer.to.x,tracer.to.y);
    }
    for(const s of state.soldiers){
      if(!s.alive||state.time-s.lastShotAt>.055)continue;
      const x=s.x+Math.cos(s.aim)*33,y=s.y-34+Math.sin(s.aim)*33;
      const a=s.aim;const point=(along:number,side:number):Vec=>({x:x+Math.cos(a)*along-Math.sin(a)*side,y:y+Math.sin(a)*along+Math.cos(a)*side});
      g.fillStyle(0xffc67a,.9).fillPoints([point(0,-3),point(6,-8),point(7,-3),point(20,0),point(7,3),point(6,8),point(0,3)],true);
      g.fillStyle(0xfff1cb).fillCircle(x+Math.cos(a)*5,y+Math.sin(a)*5,4);
    }
    for(const projectile of state.projectiles){
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
