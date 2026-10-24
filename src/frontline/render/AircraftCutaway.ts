import type Phaser from 'phaser';
import type { AircraftZone, Arena, Rect } from '../core/types';

const overlaps=(a:Rect,b:Rect):boolean=>a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;
const tint=(value:string):number=>Number.parseInt(value.replace('#',''),16);

/** Split the rear wall around real openings. An exterior route never gets a wall painted behind it. */
function subtract(rect:Rect,hole:Rect):Rect[]{
  if(!overlaps(rect,hole))return [rect];
  const left=Math.max(rect.x,hole.x),right=Math.min(rect.x+rect.w,hole.x+hole.w),top=Math.max(rect.y,hole.y),bottom=Math.min(rect.y+rect.h,hole.y+hole.h);
  const pieces:Rect[]=[];
  if(top>rect.y)pieces.push({x:rect.x,y:rect.y,w:rect.w,h:top-rect.y});
  if(bottom<rect.y+rect.h)pieces.push({x:rect.x,y:bottom,w:rect.w,h:rect.y+rect.h-bottom});
  if(left>rect.x)pieces.push({x:rect.x,y:top,w:left-rect.x,h:bottom-top});
  if(right<rect.x+rect.w)pieces.push({x:right,y:top,w:rect.x+rect.w-right,h:bottom-top});
  return pieces;
}

function wall(g:Phaser.GameObjects.Graphics,rect:Rect,zone:AircraftZone,arena:Arena,view:Rect):void{
  if(!overlaps(rect,view))return;
  const {x,y,w,h}=rect;
  const section=arena.sections?.find(section=>zone.x+zone.w*.5>=section.x&&zone.x+zone.w*.5<section.x+section.w);
  const color=section?tint(section.color):0x597b82;
  const warm=zone.id.includes('cargo'),medical=zone.id.includes('crew'),under=zone.id.includes('underpass');
  g.fillGradientStyle(warm?0x384b51:medical?0x354c50:0x2a4553,0x314b58,under?0x183541:0x243d48,0x263f4b).fillRect(x,y,w,h);
  g.fillStyle(color,.13).fillRect(x,y,w,h);
  // Fine seams and recessed bays belong to the rear wall; only real platforms receive bright top edges.
  const startX=Math.max(x+14,Math.floor((view.x-x)/210)*210+x+14);
  for(let a=startX;a<x+w-14&&a<view.x+view.w;a+=210){
    const panelWidth=Math.min(192,x+w-12-a);
    if(panelWidth<22)continue;
    g.lineStyle(1,0xb7c9c0,.1).strokeRoundedRect(a,y+14,panelWidth,Math.max(12,h-28),Math.min(30,h*.15));
    g.lineStyle(3,0x102d3b,.27).lineBetween(a+7,y+26,a+7,y+h-22);
    for(let b=y+38;b<y+h-22;b+=95)g.fillStyle(0xbcc4b2,.24).fillCircle(a+6,b,1.5);
    if(h>155){
      g.fillStyle(0xc7b180,.12).fillRoundedRect(a+23,y+31,Math.min(panelWidth-36,102),4,2);
      g.fillStyle(0x0c2936,.22).fillRoundedRect(a+20,y+h-63,Math.max(8,panelWidth-40),34,6);
    }
  }
  // A soft top shadow attaches each room to its hull without inventing a foreground ceiling.
  g.fillStyle(0x102c38,.2).fillRect(x,y,w,Math.min(21,h));
}

/** Opaque interior rooms are drawn in world space, leaving roof, tail and wing exposed to the sky. */
export function drawAircraftCutaway(g:Phaser.GameObjects.Graphics,arena:Arena,view:Rect):void{
  const zones=arena.aircraftZones??[],outside=zones.filter(zone=>zone.kind==='exterior');
  for(const zone of zones){
    if(zone.kind!=='interior'||!overlaps(zone,view))continue;
    let fragments:Rect[]=[zone];
    for(const hole of outside)fragments=fragments.flatMap(rect=>subtract(rect,hole));
    for(const fragment of fragments)wall(g,fragment,zone,arena,view);
  }
  // Tail doorway edge and actuator recess stay vertical: the open ramp remains an uninterrupted vista.
  const ramp=outside.find(zone=>zone.id==='tail-ramp');
  if(ramp&&overlaps({x:ramp.x+ramp.w-20,y:ramp.y,w:40,h:ramp.h},view)){
    const x=ramp.x+ramp.w;
    g.fillStyle(0x142e3d,.4).fillRoundedRect(x+8,ramp.y+24,29,ramp.h-42,13);
    g.lineStyle(3,0xa3b5ad,.38).lineBetween(x+20,ramp.y+51,x+20,ramp.y+ramp.h-24);
    for(let y=ramp.y+67;y<ramp.y+ramp.h-36;y+=79)g.fillStyle(0xd1af72,.5).fillRoundedRect(x+11,y,18,8,3);
  }
}

/** A handful of slow cloud banks move behind the hull; no foreground debris obscures combat. */
export function drawAircraftAtmosphere(g:Phaser.GameObjects.Graphics,camera:Rect,time:number,quality:'low'|'medium'|'high'):void{
  const count=quality==='low'?3:5;
  for(let i=0;i<count;i++){
    const x=((i*389-time*(9+i*2)-camera.x*.12)%1540+1540)%1540-280;
    const y=105+(i*163)%550-camera.y*.08;
    g.fillStyle(0xf6eddb,.1).fillEllipse(x,y,370+(i%2)*110,43).fillEllipse(x-56,y-14,207,52);
  }
}

/** Contextual motion belongs to the real aircraft: wind outside, running machinery inside. */
export function drawAircraftLife(g:Phaser.GameObjects.Graphics,arena:Arena,view:Rect,time:number):void{
  for(const zone of arena.aircraftZones??[]){
    if(zone.kind!=='exterior'||!overlaps({x:zone.x,y:zone.y-80,w:zone.w,h:zone.h+80},view))continue;
    const floor=zone.y+zone.h;
    if(zone.id.includes('roof')||zone.id==='wing-balcony'){
      const supports=arena.platforms.filter(platform=>platform.active&&platform.skin==='deck'&&platform.w>30&&Math.abs(platform.y-floor)<4&&platform.x+platform.w>zone.x&&platform.x<zone.x+zone.w);
      const anchor=(desired:number):number|undefined=>supports.map(platform=>Math.max(platform.x+13,Math.min(platform.x+platform.w-13,desired))).sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired))[0];
      const x=anchor(zone.x+(zone.id==='wing-balcony'?zone.w*.09:Math.min(170,zone.w*.23)));
      if(x!==undefined){
        const flutter=Math.sin(time*4.7+x)*3;
        g.lineStyle(3,0x788e94,.9).lineBetween(x,floor-3,x,floor-67);
        g.fillStyle(0xd7d8ba).fillCircle(x,floor-67,3);
        const top=floor-64;
        g.fillStyle(0xd7a477,.9).fillPoints([{x:x+4,y:top},{x:x+60,y:top+8+flutter},{x:x+60,y:top+17+flutter},{x:x+4,y:top+22}],true);
        for(const offset of [16,34])g.fillStyle(0xf0dfbd,.8).fillPoints([{x:x+offset,y:top+(offset/60)*(8+flutter)},{x:x+offset+8,y:top+((offset+8)/60)*(8+flutter)},{x:x+offset+8,y:top+22+((offset+8)/60)*(-5+flutter)},{x:x+offset,y:top+22+(offset/60)*(-5+flutter)}],true);
      }
      const positions=zone.id==='wing-balcony'?[zone.x+24,zone.x+zone.w-24]:[zone.x+zone.w-24];
      for(let i=0;i<positions.length;i++){
        const lightX=anchor(positions[i]!);
        if(lightX===undefined)continue;
        const lightY=floor-5,alpha=.5+Math.max(0,Math.sin(time*2.3+zone.x))*.4;
        const light=zone.id==='wing-balcony'&&i===1?0x8ed7b5:0xeaa27d;
        g.fillStyle(0x516f7d).fillEllipse(lightX,lightY+2,21,8);
        g.fillStyle(0xc1ceca,.8).fillEllipse(lightX-2,lightY,13,5);
        g.fillStyle(light,alpha*.14).fillCircle(lightX,lightY,13);
        g.fillStyle(light,alpha).fillCircle(lightX,lightY,3);
      }
    }
  }
  for(const platform of arena.platforms){
    if(!platform.active||platform.skin!=='engine'||!overlaps(platform,view))continue;
    const r=Math.min(platform.h*.35,platform.w*.23),cx=platform.x+platform.w*.42,cy=platform.y+platform.h*.48;
    g.fillStyle(0x172c37).fillCircle(cx,cy,r-3);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+time*1.7;
      g.lineStyle(2.5,0x68878b,.85).lineBetween(cx+Math.cos(a)*r*.23,cy+Math.sin(a)*r*.23,cx+Math.cos(a+.32)*r*.76,cy+Math.sin(a+.32)*r*.76);
    }
    g.fillStyle(0x9caeaa).fillCircle(cx,cy,r*.19);
  }
}
