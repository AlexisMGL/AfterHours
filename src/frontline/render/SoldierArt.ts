import type Phaser from 'phaser';
import type { Soldier, Vec } from '../core/types';
import { clamp } from '../core/types';
import { CLASSES } from '../core/config';

const INK=0x142a35;
const numberColor=(v:string):number=>Number.parseInt(v.slice(1),16);
function limb(g:Phaser.GameObjects.Graphics,a:Vec,b:Vec,width:number,color:number,shine:number):void{
  g.lineStyle(width+2.5,INK).lineBetween(a.x,a.y,b.x,b.y);g.fillStyle(INK).fillCircle(a.x,a.y,(width+2.5)/2).fillCircle(b.x,b.y,(width+2.5)/2);
  g.lineStyle(width,color).lineBetween(a.x,a.y,b.x,b.y);g.fillStyle(color).fillCircle(a.x,a.y,width/2).fillCircle(b.x,b.y,width/2);
  g.lineStyle(1.2,shine,.45).lineBetween(a.x-1.2,a.y-1,b.x-1.2,b.y-1);
}

/** Smooth layered cartoon figure. Every part remains native vector artwork, including the firearm. */
export function drawSoldierBody(g:Phaser.GameObjects.Graphics,s:Soldier,time:number,now:number,reduced:boolean,focus:boolean,landing:number):void{
  const face=Math.cos(s.aim)>=0?1:-1,team=s.team===0?0x76d6ee:0xf29880;
  const navy=s.team===0?0x3a6277:0x75534d,armor=s.team===0?0x608b9b:0x9d7865,shine=s.team===0?0xa0c0c6:0xd4b79a;
  const run=s.grounded&&Math.abs(s.vx)>12&&!reduced?Math.sin(time*(s.classId==='defense'?12:14)+s.id)*Math.min(1,Math.abs(s.vx)/200):0;
  const bob=s.grounded?Math.abs(run)*1.2+landing:0;
  const active=s.abilityUntil>now,hurt=s.hurtUntil>now;
  const skins=[0xd6b18d,0xbc916f,0xe6c4a1,0xa57960],skin=hurt?0xffdfb9:skins[s.id%skins.length]!;
  const darkSkin=[0xa87960,0x8e6552,0xb68d6c,0x795648][s.id%4]!;
  if(s.grounded)g.fillStyle(0x091c29,.28).fillEllipse(0,1,34,8);
  if(s.protectedUntil>now){g.fillStyle(team,.045).fillEllipse(0,-30,48,67);g.lineStyle(1.6,team,.45).strokeEllipse(0,-30,48,67);}
  if(focus)g.lineStyle(1.8,0xe5ccff,.65).strokeRoundedRect(-19,-63,38,66,14);

  // Back gear sits behind the shoulders and has a different silhouette for every class.
  if(s.classId==='support'){
    g.fillGradientStyle(0xabc3aa,0x4e7666,0x769d7d,0x2c514e).fillRoundedRect(-face*17-6,-41-bob,13,26,5);
    g.lineStyle(1.8,INK).strokeRoundedRect(-face*17-6,-41-bob,13,26,5);
    g.fillStyle(0xe8e6ca).fillRoundedRect(-face*17-3.5,-35-bob,8,12,2);g.fillStyle(0x598c69).fillRoundedRect(-face*17-.5,-33.5-bob,2,9,1).fillRoundedRect(-face*17-3.5,-30-bob,8,2,1);
    g.fillStyle(0xd2cfac).fillRoundedRect(-face*17-4,-42-bob,9,4,2);
  }else if(s.classId==='sniper'){
    g.fillGradientStyle(0x82927b,0x455c55,0x536d5b,0x263e3f).fillPoints([{x:-face*10,y:-43-bob},{x:-face*19,y:-22},{x:-face*14,y:-14},{x:face*7,y:-23},{x:face*9,y:-39-bob}],true);
    g.lineStyle(1,0x9bae91,.5).lineBetween(-face*11,-37-bob,-face*14,-22).lineBetween(-face*6,-32-bob,-face*7,-20);
  }else if(s.classId==='assault'){
    g.fillStyle(0x314c54).fillRoundedRect(-face*16-4,-39-bob,9,19,3);g.lineStyle(1.7,INK).strokeRoundedRect(-face*16-4,-39-bob,9,19,3);
    g.lineStyle(1.6,0x8baba4).lineBetween(-face*17,-39-bob,-face*19,-57-bob);g.fillStyle(0xe1bc76).fillCircle(-face*19,-57-bob,1.5);
  }else{
    g.fillStyle(0x526b73).fillRoundedRect(-face*16-4,-42-bob,10,24,4);g.lineStyle(2,INK).strokeRoundedRect(-face*16-4,-42-bob,10,24,4);
  }

  const airborne=s.grounded?0:s.vy<0?1:-1,climb=s.climbing&&!reduced?Math.sin(time*8):0;
  const kneeA={x:-6-run*6,y:-11+(airborne?-3:0)},kneeB={x:6+run*6,y:-11+(airborne?-1:0)};
  const footA={x:-7+run*10+(airborne?6:0),y:airborne?-8:climb*3},footB={x:7-run*10-(airborne?4:0),y:airborne?-3:-climb*3};
  limb(g,{x:-6,y:-23-bob},kneeA,8,navy,shine);limb(g,kneeA,footA,7,navy,shine);
  limb(g,{x:6,y:-23-bob},kneeB,8,armor,shine);limb(g,kneeB,footB,7,navy,shine);
  for(const knee of[kneeA,kneeB]){
    g.fillGradientStyle(0xa5b8b2,0x4b6670,0x526f79,0x2d4958).fillRoundedRect(knee.x-4.5,knee.y-4,9,8,3);
    g.lineStyle(1,INK).strokeRoundedRect(knee.x-4.5,knee.y-4,9,8,3);g.fillStyle(0xd5c9a3,.5).fillRoundedRect(knee.x-2.5,knee.y-2,5,1.5,1);
  }
  for(const foot of[footA,footB]){
    g.fillGradientStyle(0x516971,0x263b48,0x243b47,0x142a36).fillRoundedRect(foot.x-5,foot.y-5,12.5,8,3.5);
    g.lineStyle(1.3,INK).strokeRoundedRect(foot.x-5,foot.y-5,12.5,8,3.5);
    g.fillStyle(0xa0afa8,.5).fillRoundedRect(foot.x+1,foot.y-3,5,2,1);
    g.lineStyle(1.1,0x9caa9f,.5).lineBetween(foot.x-3,foot.y+2,foot.x+5,foot.y+2);
  }

  // Shaped armor uses curved edges, a bevel, fabric undersuit and layered pouches.
  const width=s.classId==='defense'?28:25;
  g.fillGradientStyle(armor,navy,navy,0x243e4c).fillRoundedRect(-width/2,-41-bob,width,23,7);
  g.lineStyle(1.8,INK).strokeRoundedRect(-width/2,-41-bob,width,23,7);
  g.fillGradientStyle(shine,armor,armor,navy).fillRoundedRect(-8.5,-39-bob,18,15,5);
  g.lineStyle(1,0xd2d2b5,.5).lineBetween(-5,-37-bob,5,-37-bob);
  g.fillStyle(0x233e4a).fillRoundedRect(-11,-25-bob,23,6,2.5);
  for(let i=0;i<3;i++){
    g.fillGradientStyle(0x9ba98e,0x596d61,0x6c826d,0x324e4d).fillRoundedRect(-8+i*6,-28-bob,5,8,1.5);
    g.lineStyle(.8,0x243f43).strokeRoundedRect(-8+i*6,-28-bob,5,8,1.5);g.fillStyle(0xd4c9a0).fillCircle(-5.5+i*6,-26-bob,.7);
  }
  g.fillStyle(0xd4c29b).fillRoundedRect(-2,-23-bob,5,3,1);
  g.lineStyle(2,0x243f4a).lineBetween(-7,-40-bob,-5,-30-bob).lineBetween(8,-40-bob,6,-30-bob);
  g.fillStyle(team).fillRoundedRect(-12,-39-bob,5,9,2);g.fillStyle(0xe4ede0,.55).fillRoundedRect(-11,-38-bob,3,2,1);
  if(s.classId==='defense'){
    g.fillGradientStyle(0xa5b9bc,0x586e78,0x657e87,0x354f5c).fillRoundedRect(-17,-42-bob,11,11,4).fillRoundedRect(7,-42-bob,11,11,4);
    g.lineStyle(1.4,INK).strokeRoundedRect(-17,-42-bob,11,11,4).strokeRoundedRect(7,-42-bob,11,11,4);
    g.fillStyle(team).fillRoundedRect(-15,-40-bob,7,2.5,1).fillRoundedRect(9,-40-bob,7,2.5,1);
    g.lineStyle(1.4,0xc4cabc,.5).lineBetween(-9,-33-bob,10,-33-bob);
  }else if(s.classId==='assault'){
    g.fillStyle(0xf0c184).fillRoundedRect(2,-35-bob,5,7,1.5);g.lineStyle(1,0x6f6854).lineBetween(3,-34-bob,6,-30-bob);
  }else if(s.classId==='support'){
    g.fillStyle(0xd9e7ce).fillCircle(4,-33-bob,4);g.fillStyle(0x4c8164).fillRoundedRect(3.2,-35.5-bob,1.6,5,1).fillRoundedRect(1.5,-33.8-bob,5,1.6,1);
  }else{
    g.lineStyle(2,0x9caa8d,.65).lineBetween(-7,-37-bob,8,-31-bob);
  }

  // A visible face replaces a flat pixel visor: cheek, eye, brow, nose, chin and microphone.
  g.fillStyle(darkSkin).fillRoundedRect(-4,-46-bob,9,10,3);
  g.fillGradientStyle(skin,skin,darkSkin,darkSkin).fillEllipse(face*2,-47-bob,22,23);
  g.lineStyle(1.3,INK).strokeEllipse(face*2,-47-bob,22,23);
  g.fillStyle(0xf4b796,.22).fillEllipse(face*7,-43.5-bob,7,5);
  const helmet=s.classId==='sniper'?0x607b65:navy;
  g.fillGradientStyle(shine,helmet,helmet,0x2b4753).fillRoundedRect(-14,-63-bob,28,18,11);
  g.lineStyle(1.6,INK).strokeRoundedRect(-14,-63-bob,28,18,11);
  g.fillStyle(0x1d3847).fillRoundedRect(-13,-51-bob,28,5,2.5);
  g.fillGradientStyle(shine,armor,armor,navy).fillRoundedRect(face>0?-5:-17,-53-bob,22,4,2);
  g.lineStyle(1,0xd3dbcb,.55).lineBetween(-7,-60-bob,4,-60-bob);
  g.fillStyle(0x183541).fillRoundedRect(-7,-58-bob,16,5,2.5);
  g.fillGradientStyle(0xc8eeeb,team,team,0x578f9e).fillRoundedRect(-5,-57-bob,5,3.2,1.5).fillRoundedRect(2,-57-bob,5,3.2,1.5);
  const eyeX=face*7;
  g.fillStyle(0xf8ead2).fillEllipse(eyeX,-46.3-bob,5.1,3.5);g.fillStyle(0x163240).fillEllipse(eyeX+face*.7,-46-bob,1.7,2.8);
  g.lineStyle(1.2,0x56483c).lineBetween(eyeX-face*2.6,-49-bob,eyeX+face*2.5,-48.3-bob);
  g.fillStyle(skin).fillTriangle(face*10,-46.5-bob,face*15,-44.5-bob,face*10,-42.3-bob);
  g.lineStyle(1.1,0x8d6854,.85).lineBetween(face*5,-40.5-bob,face*9,-40.5-bob);
  g.fillStyle(0x203c49).fillEllipse(-face*10,-48-bob,8,11);g.lineStyle(1.2,0x9eb8b4).strokeEllipse(-face*10,-48-bob,8,11);
  g.fillStyle(armor).fillCircle(-face*10,-48-bob,2.5);g.fillStyle(team).fillCircle(-face*10,-48-bob,1);
  g.lineStyle(1.2,0x304a54).lineBetween(-face*10,-43-bob,-face*5,-39-bob).lineBetween(-face*5,-39-bob,face*5,-39-bob);g.fillStyle(0x122e3a).fillEllipse(face*6,-39-bob,4,2.5);
  if(s.classId==='sniper'){g.fillGradientStyle(0x8a9b7d,0x536d59,0x4a6555,0x304b48).fillRoundedRect(-9,-41.5-bob,21,6,3);g.lineStyle(1,0xa2af92,.5).lineBetween(-5,-39-bob,5,-39-bob);}
  if(s.classId==='defense'){g.fillStyle(0xb7d7d8,.28).fillRoundedRect(face>0?-3:-12,-51-bob,16,11,3);g.lineStyle(.8,0xd5e8df,.5).lineBetween(face>0?10:-10,-48-bob,face>0?10:-10,-43-bob);}

  const weapon=s.weapons[s.activeWeapon],reload=weapon.reloadUntil>now;
  const recoil=now-s.lastShotAt<.09?(1-clamp((now-s.lastShotAt)/.09,0,1))*3:0;
  const hand={x:Math.cos(s.aim)*(18-recoil),y:-34+Math.sin(s.aim)*(18-recoil)-bob};
  const elbow={x:face*2+Math.cos(s.aim)*8,y:-24+Math.sin(s.aim)*7-bob};
  limb(g,{x:face*2,y:-35-bob},elbow,8,armor,shine);limb(g,elbow,hand,6.7,navy,shine);
  g.fillGradientStyle(0x97ac9c,0x496563,0x5f7c6e,0x2c494b).fillCircle(hand.x,hand.y,4.5);g.lineStyle(1,INK).strokeCircle(hand.x,hand.y,4.5);
  const off=reload?{x:face*(8+Math.sin(time*15)*3),y:-23-bob}:{x:Math.cos(s.aim)*11,y:-30+Math.sin(s.aim)*11-bob};
  limb(g,{x:-face*8,y:-35-bob},{x:-face*5,y:-25-bob},7,navy,shine);limb(g,{x:-face*5,y:-25-bob},off,6,armor,shine);
  g.fillStyle(0x5f7c6e).fillCircle(off.x,off.y,3.7);g.lineStyle(1,INK).strokeCircle(off.x,off.y,3.7);
  if(s.classId==='support'){g.fillStyle(0xe0e6cf).fillRoundedRect(-face*10-3,-33-bob,6,4,1.5);}
  if(active){
    const c=numberColor(CLASSES[s.classId].color);
    if(s.classId==='defense'&&s.shieldHealth>0){const x=face*26;g.fillGradientStyle(0xd1e9e3,0x76b6ce,0x70afc7,0x355d76,.18,.28,.15,.2).fillRoundedRect(x-5,-56,10,51,4);g.lineStyle(1.6,0xb6e2e8,.85).strokeRoundedRect(x-5,-56,10,51,4);g.lineStyle(1,0x86c0d3,.6).lineBetween(x-4,-36,x+4,-36);}
    else{g.lineStyle(1.2,c,.4).strokeEllipse(0,-30,43,67);g.fillStyle(c,.035).fillEllipse(0,-30,43,67);}
  }
  if(hurt)g.lineStyle(1.8,0xffd1ae,.7).strokeEllipse(0,-31,39,64);
}
