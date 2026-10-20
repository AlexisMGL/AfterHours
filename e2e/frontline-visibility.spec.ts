import { test, expect } from '@playwright/test';
import type { Action, MatchConfig, MatchState, Rect, Vec } from '../src/frontline/core/types';

interface ActorView { root:{visible:boolean};label:{visible:boolean};gun:{visible:boolean} }
interface Pixel {r:number;g:number;b:number;a:number}
interface FixtureRenderer {
  actors:Map<number,ActorView>;
  effects:{commandBuffer:unknown[]};
  scene:unknown;
  game:{canvas:HTMLCanvasElement;events:{once(event:string,callback:()=>void):void};renderer:{snapshotPixel(x:number,y:number,callback:(pixel:Pixel)=>void):void}};
  structure:string;
  cache:{textureCount:number;layers:Map<string,{x:number;y:number;width:number;height:number;displayWidth:number;displayHeight:number;scrollFactorX:number;scrollFactorY:number}>};
  render(state:MatchState):void;
  prepareView(state:MatchState,dt:number):Rect;
  paint(dt:number):void;
  follow(id:number):void;
  getCamera():Rect;
  screenToWorld(x:number,y:number):Vec;
  setOptions(options:{quality:'low'|'medium'|'high'}):void;
  destroy():void;
}

test('solid decks block jumping and downward input, while a real ladder shaft remains traversable',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/frontline-heroes');
  const result=await page.evaluate(async()=>{
    const rendererPath='/src/frontline/render/ShooterRenderer.ts',enginePath='/src/frontline/core/engine.ts';
    const [art,engine]=await Promise.all([import(rendererPath),import(enginePath)]);
    const Renderer=art.ShooterRenderer as new(container:HTMLElement,options:object)=>FixtureRenderer;
    const Match=engine.ShooterMatch as new(config:MatchConfig)=>{state:MatchState;step(actions:Record<number,Action>,dt?:number):void};
    const match=new Match({mapId:'aircraft',mode:'deathmatch',botCount:3,difficulty:'regular',humanClass:'assault',seed:2026,scoreLimit:30,rounds:3,timeLimit:0,eventFrequency:'reduced'}),state=match.state;
    state.soldiers=state.soldiers.slice(0,1);const soldier=state.soldiers[0];
    const floor={id:1,x:0,y:1120,w:4800,h:80,oneWay:false,material:'metal' as const,active:true,skin:'deck' as const};
    const deck={id:2,x:200,y:940,w:700,h:20,oneWay:true,material:'metal' as const,active:true,skin:'catwalk' as const};
    state.arena.platforms=[floor,deck];state.arena.ladders=[];state.arena.decorations=[];state.arena.sections=[];state.arena.hazards=[];
    state.crates=[];state.stations=[];state.loot=[];state.flags=[];state.events=[];
    let intersections=0;const samples:{phase:string;x:number;y:number;grounded:boolean}[]=[];
    const reset=(x:number,y:number,platformId:number)=>Object.assign(soldier,{x,y,vx:0,vy:0,aim:0,alive:true,grounded:true,platformId,climbing:false,coyoteUntil:state.time+.11,jumpBufferUntil:-1});
    const step=(action:Action)=>{
      match.step({[soldier.id]:action});
      for(const p of state.arena.platforms)if(p.active&&soldier.x-14<p.x+p.w-1e-5&&soldier.x+14>p.x+1e-5&&soldier.y-54<p.y+p.h-1e-5&&soldier.y>p.y+1e-5)intersections++;
    };
    const sample=(phase:string)=>samples.push({phase,x:soldier.x,y:soldier.y,grounded:soldier.grounded});
    reset(500,1120,1);let jumpMinimum=1120;step({jump:true});
    for(let i=0;i<90;i++){step({});jumpMinimum=Math.min(jumpMinimum,soldier.y);}sample('jump returned to floor');
    // The old oneWay metadata and legacy drop request cannot disable a deck.
    state.arena.ladders=[{id:1,x:480,y:860,w:40,h:265}];reset(500,940,2);
    for(let i=0;i<90;i++)step({drop:true,climb:1});const downwardBlocked={x:soldier.x,y:soldier.y,grounded:soldier.grounded};
    reset(500,1120,1);let climbMinimum=1120;
    for(let i=0;i<90;i++){step({climb:-1});climbMinimum=Math.min(climbMinimum,soldier.y);}sample('climb blocked by solid underside');
    const box=document.createElement('div');box.style.cssText='position:fixed;left:0;top:0;width:960px;height:540px;background:#172a35;z-index:9999';document.body.append(box);
    const renderer=new Renderer(box,{quality:'high',particles:false,shake:false});
    try{
      renderer.prepareView(state,0);renderer.render(state);
      for(let i=0;i<100&&!renderer.scene;i++)await new Promise(resolve=>setTimeout(resolve,20));
      if(!renderer.scene)throw new Error('Movement fixture Phaser scene did not initialize');
      const pixel=(point:Vec)=>new Promise<Pixel>(resolve=>{
        const camera=renderer.getCamera(),scale=renderer.game.canvas.width/960;
        renderer.game.events.once('postrender',()=>renderer.game.renderer.snapshotPixel(Math.floor((point.x-camera.x)*scale),Math.floor((point.y-camera.y)*scale),resolve));
      });
      renderer.paint(0);const solidPixel=await pixel({x:476,y:941.5});
      // A 64 px physical opening matches the generated-map shafts. No invisible
      // one-way exceptions, body teleport or foreground art spans the opening.
      state.arena.platforms=[floor,{...deck,w:268},{...deck,id:3,x:532,w:368}];
      reset(500,1120,1);
      for(let i=0;i<66;i++)step({climb:-1});const aboveOpening={x:soldier.x,y:soldier.y};sample('above opening');
      for(let i=0;i<35;i++)step({climb:-1,move:1});
      for(let i=0;i<60;i++)step({});const upperLanding={x:soldier.x,y:soldier.y,grounded:soldier.grounded};sample('upper landing');
      let approachSteps=0;while(soldier.x>502&&approachSteps++<90)step({move:-1});
      for(let i=0;i<90;i++)step({climb:1});
      for(let i=0;i<20;i++)step({});const lowerLanding={x:soldier.x,y:soldier.y,grounded:soldier.grounded};sample('lower landing');
      renderer.prepareView(state,0);renderer.render(state);renderer.paint(0);
      const holePixel=await pixel({x:476,y:941.5}),lipPixel=await pixel({x:400,y:941.5});
      return{jumpMinimum,climbMinimum,downwardBlocked,aboveOpening,upperLanding,lowerLanding,intersections,samples,solidPixel,holePixel,lipPixel,camera:renderer.getCamera()};
    }finally{renderer.destroy();box.remove();}
  });
  expect(result.jumpMinimum).toBeCloseTo(1014,4);expect(result.climbMinimum).toBeCloseTo(1014,4);
  expect(result.downwardBlocked).toEqual({x:500,y:940,grounded:true});
  expect(result.aboveOpening.y).toBeLessThan(940);expect(result.aboveOpening.y).toBeGreaterThan(860);
  expect(result.upperLanding.x).toBeGreaterThan(546);expect(result.upperLanding.y).toBeCloseTo(940,4);expect(result.upperLanding.grounded).toBe(true);
  expect(result.lowerLanding.y).toBeCloseTo(1120,4);expect(result.lowerLanding.grounded).toBe(true);
  expect(result.intersections,JSON.stringify(result.samples)).toBe(0);
  // The lip's top is physically hidden behind its underside from this eye.
  expect(result.lipPixel.r).toBeCloseTo(84,0);expect(result.lipPixel.g).toBeCloseTo(94,0);expect(result.lipPixel.b).toBeCloseTo(96,0);
  expect(Math.abs(result.holePixel.r-result.solidPixel.r)+Math.abs(result.holePixel.g-result.solidPixel.g)+Math.abs(result.holePixel.b-result.solidPixel.b),JSON.stringify({hole:result.holePixel,solid:result.solidPixel})).toBeGreaterThan(20);
  expect(result.camera.w).toBe(960);expect(result.camera.h).toBe(540);expect(errors).toEqual([]);
});

test('current observer cannot see bodies, nameplates, guns or tracers through decks and cover, including Focus',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/frontline-heroes');
  const result=await page.evaluate(async()=>{
    const rendererPath='/src/frontline/render/ShooterRenderer.ts',enginePath='/src/frontline/core/engine.ts',mapsPath='/src/frontline/maps/maps.ts';
    const [art,engine,maps]=await Promise.all([import(rendererPath),import(enginePath),import(mapsPath)]);
    const Renderer=art.ShooterRenderer as new(container:HTMLElement,options:object)=>FixtureRenderer;
    const Match=engine.ShooterMatch as new(config:MatchConfig)=>{state:MatchState};
    const config:MatchConfig={mapId:'aircraft',mode:'deathmatch',botCount:3,difficulty:'regular',humanClass:'sniper',seed:2026,scoreLimit:30,rounds:3,timeLimit:480,eventFrequency:'normal'};
    const state=new Match(config).state;
    state.soldiers=state.soldiers.slice(0,3);
    const [observer,enemy,ally]=state.soldiers;
    Object.assign(observer,{x:500,y:600,team:0,alive:true,classId:'sniper',abilityUntil:100,lastShotAt:-100,aim:0});
    Object.assign(enemy,{x:500,y:380,team:1,alive:true,lastShotAt:state.time,aim:0});
    Object.assign(ally,{x:650,y:380,team:0,alive:true,lastShotAt:-100,aim:0});
    const deck={id:100,x:200,y:480,w:700,h:20,oneWay:true,material:'metal' as const,active:true};
    state.arena.platforms=[deck];state.arena.ladders=[];state.arena.decorations=[];state.arena.sections=[];
    state.arena.decorations=[{kind:'sign',x:210,y:350,w:180,h:32,label:'FLIGHT DECK'}];
    state.arena.hazards=[];state.crates=[];state.stations=[];state.loot=[];state.flags=[];state.events=[];
    state.tracers=[{id:1,owner:enemy.id,from:{x:500,y:346},to:{x:600,y:575},until:state.time+.08,weapon:'vanguard',hit:false}];
    const container=document.createElement('div');container.style.cssText='position:fixed;left:0;top:0;width:960px;height:540px;z-index:9999';document.body.append(container);
    const renderer=new Renderer(container,{quality:'high',particles:false,shake:false});
    try{
      renderer.render(state);
      for(let i=0;i<100&&!renderer.scene;i++)await new Promise(resolve=>setTimeout(resolve,20));
      if(!renderer.scene)throw new Error('Fixture Phaser scene did not initialize');
      const frame=()=>{renderer.render(state);renderer.paint(0);};
      const view=(id:number)=>{const actor=renderer.actors.get(id)!;return{body:actor.root.visible,name:actor.label.visible,gun:actor.gun.visible};};
      frame();const blocked={enemy:view(enemy.id),ally:view(ally.id),observer:view(observer.id),effects:renderer.effects.commandBuffer.length};
      const firstCamera=renderer.getCamera(),pixelScale=renderer.game.canvas.width/960;
      const samplePixel=(x:number,y:number)=>new Promise<Pixel>(resolve=>renderer.game.events.once('postrender',()=>renderer.game.renderer.snapshotPixel(Math.floor((x-firstCamera.x)*pixelScale),Math.floor((y-firstCamera.y)*pixelScale),resolve)));
      const deckPixel=await samplePixel(400,481.5);
      deck.active=false;frame();const open={enemy:view(enemy.id),ally:view(ally.id),effects:renderer.effects.commandBuffer.length};
      // No time or tick advance: a previously visible soldier must disappear immediately.
      deck.active=true;frame();const closedImmediately={enemy:view(enemy.id),ally:view(ally.id),effects:renderer.effects.commandBuffer.length};
      enemy.x=650;enemy.y=600;ally.x=720;ally.y=600;frame();const sameSide=view(enemy.id);
      enemy.x=500;enemy.y=380;frame();const movedBehindDeckImmediately=view(enemy.id);
      enemy.x=700;enemy.y=600;ally.x=750;ally.y=600;
      const wall={id:101,x:600,y:500,w:80,h:130,oneWay:false,material:'metal' as const,active:true,label:'ITEM NAME SHOULD NOT APPEAR'};
      state.arena.platforms.push(wall);frame();const wallBlocked={enemy:view(enemy.id),ally:view(ally.id)};
      const worldLabels=(renderer.scene as {children:{list:{text?:string}[]}}).children.list.map(child=>child.text).filter(Boolean);
      const hiddenPixel=await samplePixel(700,540),clearPixel=await samplePixel(550,620);
      wall.active=false;frame();const wallOpen=view(enemy.id);
      const revealedPixel=await samplePixel(700,540),stillClearPixel=await samplePixel(550,620);
      const shadowPixels={hiddenPixel,clearPixel,revealedPixel,stillClearPixel};
      wall.active=true;frame();const wallClosedImmediately=view(enemy.id);
      renderer.follow(ally.id);frame();const allyObserver={enemy:view(enemy.id),previousObserver:view(observer.id),observer:view(ally.id)};
      renderer.follow(observer.id);frame();const observerSwitchedBack=view(enemy.id);
      observer.alive=false;observer.deathAt=state.time;frame();const observerDead={enemy:view(enemy.id),observer:view(observer.id)};
      const sizes=[];
      for(const quality of ['low','medium','high'] as const){renderer.setOptions({quality});frame();const canvas=renderer.game.canvas,box=canvas.getBoundingClientRect(),camera=renderer.getCamera();const world=renderer.screenToWorld(box.left+box.width/2,box.top+box.height/2);sizes.push({quality,width:canvas.width,height:canvas.height,cameraWidth:camera.w,cameraHeight:camera.h,mappingError:Math.hypot(world.x-camera.x-480,world.y-camera.y-270)});}
      observer.alive=true;
      const cacheViews=[];
      for(const mapId of ['aircraft','forest','city','ship','harbor','factory'] as const){
        state.arena=maps.createArena(mapId,2026);state.config.mapId=mapId;
        for(const [x,y]of [[0,0],[241,161],[479,319],[3840,660]]){
          observer.x=x+375;observer.y=y+415;observer.aim=0;renderer.follow(ally.id);renderer.follow(observer.id);frame();
          const camera=renderer.getCamera();
          const layers=[...renderer.cache.layers.values()].map(layer=>({width:layer.width,height:layer.height,left:layer.x-camera.x*layer.scrollFactorX,top:layer.y-camera.y*layer.scrollFactorY,right:layer.x+layer.displayWidth-camera.x*layer.scrollFactorX,bottom:layer.y+layer.displayHeight-camera.y*layer.scrollFactorY}));
          cacheViews.push({mapId,count:renderer.cache.textureCount,layers});
        }
      }
      const prepared=renderer.prepareView(state,.016);renderer.paint(.1);const paintedPrepared=renderer.getCamera(),preparedTwice=renderer.prepareView(state,.016);
      observer.alive=false;state.tick++;renderer.prepareView(state,.016);
      observer.alive=true;observer.x=110;observer.y=1120;state.tick++;const respawnView=renderer.prepareView(state,.016);
      state.round++;observer.x=2600;observer.y=900;state.tick++;const newRoundView=renderer.prepareView(state,.016);
      observer.x+=10;state.tick++;const ordinaryMotionView=renderer.prepareView(state,.016);
      const nextState=new Match({...config,mapId:state.arena.id,seed:2027}).state;
      const restartView=renderer.prepareView(nextState,0),restartCacheCount=renderer.cache.textureCount,restartActorCount=renderer.actors.size;
      renderer.render(nextState);renderer.paint(0);const afterRestart=renderer.getCamera();
      const oldStructure=renderer.structure;nextState.arena.platforms[0].x+=25;renderer.paint(0);const coordinatesInvalidate=oldStructure!==renderer.structure;
      return{blocked,open,closedImmediately,sameSide,movedBehindDeckImmediately,wallBlocked,wallOpen,wallClosedImmediately,allyObserver,observerSwitchedBack,observerDead,sizes,cacheViews,deckPixel,shadowPixels,worldLabels,prepared,paintedPrepared,preparedTwice,respawnView,newRoundView,ordinaryMotionView,restartView,restartCacheCount,restartActorCount,afterRestart,coordinatesInvalidate};
    }finally{renderer.destroy();container.remove();}
  });
  const hidden={body:false,name:false,gun:false},visible={body:true,name:true,gun:true};
  expect(result.blocked.enemy).toEqual(hidden);expect(result.blocked.ally).toEqual(hidden);expect(result.blocked.observer).toEqual(visible);expect(result.blocked.effects).toBe(0);
  expect(result.open.enemy).toEqual(visible);expect(result.open.ally).toEqual(visible);expect(result.open.effects).toBeGreaterThan(0);
  expect(result.closedImmediately.enemy).toEqual(hidden);expect(result.closedImmediately.ally).toEqual(hidden);expect(result.closedImmediately.effects).toBe(0);
  expect(result.sameSide).toEqual(visible);expect(result.movedBehindDeckImmediately).toEqual(hidden);
  expect(result.wallBlocked.enemy).toEqual(hidden);expect(result.wallBlocked.ally).toEqual(hidden);expect(result.wallOpen).toEqual(visible);expect(result.wallClosedImmediately).toEqual(hidden);
  expect(result.allyObserver.enemy).toEqual(visible);expect(result.allyObserver.previousObserver).toEqual(hidden);expect(result.allyObserver.observer).toEqual(visible);expect(result.observerSwitchedBack).toEqual(hidden);
  expect(result.observerDead.enemy).toEqual(hidden);expect(result.observerDead.observer.body).toBe(true);
  expect(result.sizes[0].width).toBe(960);expect(result.sizes[1].width).toBeGreaterThanOrEqual(960);expect(result.sizes[1].width).toBeLessThanOrEqual(1440);expect(result.sizes[2].width).toBeGreaterThanOrEqual(result.sizes[1].width);expect(result.sizes[2].width).toBeLessThanOrEqual(1920);
  for(const size of result.sizes)expect(size.width/size.height).toBeCloseTo(16/9);
  for(const size of result.sizes){expect(size.cameraWidth).toBe(960);expect(size.cameraHeight).toBe(540);expect(size.mappingError).toBeLessThan(.001);}
  for(const view of result.cacheViews){
    expect(view.count,view.mapId+' cache count remains bounded').toBe(4);
    for(const layer of view.layers){expect(layer.width).toBeLessThanOrEqual(4096);expect(layer.height).toBeLessThanOrEqual(4096);expect(layer.left).toBeLessThanOrEqual(.001);expect(layer.top).toBeLessThanOrEqual(.001);expect(layer.right).toBeGreaterThanOrEqual(959.999);expect(layer.bottom).toBeGreaterThanOrEqual(539.999);}
  }
  expect(result.deckPixel.r).toBeCloseTo(84,0);expect(result.deckPixel.g).toBeCloseTo(94,0);expect(result.deckPixel.b).toBeCloseTo(96,0);
  const {hiddenPixel,revealedPixel,clearPixel,stillClearPixel}=result.shadowPixels;
  expect(hiddenPixel.r+hiddenPixel.g+hiddenPixel.b).toBeLessThan((revealedPixel.r+revealedPixel.g+revealedPixel.b)*.8);
  expect(clearPixel).toEqual(stillClearPixel);
  expect(result.worldLabels).toContain('FLIGHT DECK');expect(result.worldLabels).not.toContain('ITEM NAME SHOULD NOT APPEAR');
  expect(result.paintedPrepared).toEqual(result.prepared);expect(result.preparedTwice).toEqual(result.prepared);
  expect(result.respawnView.x).toBe(0);expect(result.respawnView.y).toBe(660);expect(result.newRoundView.x).toBe(2225);expect(result.newRoundView.y).toBe(485);expect(result.ordinaryMotionView.x).toBeGreaterThan(2225);expect(result.ordinaryMotionView.x).toBeLessThan(2235);
  expect(result.restartView.x).toBeLessThan(100);expect(result.restartCacheCount).toBe(0);expect(result.restartActorCount).toBe(0);expect(result.afterRestart).toEqual(result.restartView);expect(result.coordinatesInvalidate).toBe(true);
  expect(errors).toEqual([]);
});

test('hardware WebGL path keeps ground pixels, prepared camera and mouse coordinates aligned',async({page})=>{
  await page.addInitScript(()=>{
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:unknown[]){
      const context=Reflect.apply(getContext,this,args) as RenderingContext|null;
      if(args[0]==='webgl'&&context){const gl=context as WebGLRenderingContext,parameter=gl.getParameter.bind(gl);gl.getParameter=(name:number)=>name===37446||name===gl.RENDERER?'Hardware renderer fixture':parameter(name);}
      return context;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/frontline-heroes');
  const result=await page.evaluate(async()=>{
    const artPath='/src/frontline/render/ShooterRenderer.ts',enginePath='/src/frontline/core/engine.ts';
    const [art,engine]=await Promise.all([import(artPath),import(enginePath)]);
    const Renderer=art.ShooterRenderer as new(container:HTMLElement,options:object)=>FixtureRenderer,Match=engine.ShooterMatch as new(config:MatchConfig)=>{state:MatchState};
    const state=new Match({mapId:'aircraft',mode:'deathmatch',botCount:3,difficulty:'regular',humanClass:'assault',seed:2026,scoreLimit:30,rounds:3,timeLimit:480,eventFrequency:'normal'}).state;
    state.soldiers=state.soldiers.slice(0,1);Object.assign(state.soldiers[0],{x:500,y:600,aim:0,lastShotAt:-100});
    state.arena.platforms=[{id:1,x:200,y:480,w:700,h:20,oneWay:true,material:'metal',active:true}];state.arena.ladders=[];state.arena.decorations=[];state.arena.sections=[];state.arena.hazards=[];state.crates=[];state.loot=[];state.flags=[];state.events=[];
    const box=document.createElement('div');box.style.cssText='position:fixed;left:0;top:0;width:960px;height:540px;background:#172a35;z-index:9999';document.body.append(box);
    const renderer=new Renderer(box,{quality:'high',particles:false,shake:false});
    try{
      const camera=renderer.prepareView(state,0);renderer.render(state);
      for(let i=0;i<100&&!renderer.scene;i++)await new Promise(resolve=>setTimeout(resolve,20));renderer.paint(0);
      const scale=renderer.game.canvas.width/960;
      const pixel=await new Promise<Pixel>(resolve=>renderer.game.events.once('postrender',()=>renderer.game.renderer.snapshotPixel(Math.floor((400-camera.x)*scale),Math.floor((481.5-camera.y)*scale),resolve)));
      const bounds=renderer.game.canvas.getBoundingClientRect(),point=renderer.screenToWorld(bounds.left+bounds.width/2,bounds.top+bounds.height/2);
      return{width:renderer.game.canvas.width,camera,displayed:renderer.getCamera(),point,pixel,caches:renderer.cache.textureCount};
    }finally{renderer.destroy();box.remove();}
  });
  expect(result.width).toBe(1920);expect(result.displayed).toEqual(result.camera);expect(result.point.x).toBeCloseTo(result.camera.x+480);expect(result.point.y).toBeCloseTo(result.camera.y+270);expect(result.caches).toBe(4);
  expect(result.pixel.r).toBeCloseTo(84,0);expect(result.pixel.g).toBeCloseTo(94,0);expect(result.pixel.b).toBeCloseTo(96,0);expect(errors).toEqual([]);
});
