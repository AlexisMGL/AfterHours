import type Phaser from 'phaser';
import type { ArenaDecoration } from '../core/types';

const tint=(value:string|undefined,fallback:number):number=>value?Number.parseInt(value.slice(1),16):fallback;

/** Large, recessed aircraft scenes. These stay on the fuselage behind the
 * combat plane: muted edges and inset frames distinguish them from cover. */
export function drawAircraftArchitecture(g:Phaser.GameObjects.Graphics,d:ArenaDecoration):boolean{
 const {x,y,w,h,motif}=d;
 if(!motif)return false;
 const base=tint(d.color,0x557482),accent=tint(d.accent,0xe3b76e);
 if(motif==='pressure-frame'){
  g.fillStyle(0x122b39,.34).fillRoundedRect(x,y,w,h,w*.42);
  g.lineStyle(w*.16,0x76909a,.32).strokeRoundedRect(x+w*.22,y+4,w*.56,h-8,w*.23);
  g.lineStyle(2,0xb2c3bc,.27).lineBetween(x+w*.36,y+32,x+w*.36,y+h-24);
  for(let b=y+24;b<y+h-18;b+=54){
   g.fillStyle(0xbfcbbb,.31).fillCircle(x+w*.36,b,2).fillCircle(x+w*.7,b,2);
   if(Math.round((b-y)/54)%3===0)g.fillStyle(accent,.3).fillRoundedRect(x+w*.2,b+9,w*.6,6,2);
  }
 }else if(motif==='gallery-brace'){
  // Open triangular wall brackets connect the galleries to the pressure hull.
  // They never paint a second, misleading walking surface across a shaft.
  g.lineStyle(12,0x122e3c,.4).lineBetween(x+8,y+6,x+8,y+h-8).lineBetween(x+8,y+h-8,x+w-8,y+6);
  g.lineStyle(5,base,.43).lineBetween(x+9,y+6,x+9,y+h-9).lineBetween(x+9,y+h-9,x+w-8,y+6);
  g.lineStyle(1.5,0xa6b9b2,.25).lineBetween(x+14,y+8,x+14,y+h-22).lineBetween(x+14,y+h-22,x+w-15,y+8);
  for(const[a,b]of[[x+8,y+10],[x+8,y+h-12],[x+w-12,y+10]])g.fillStyle(accent,.38).fillCircle(a!,b!,3);
 }else if(motif==='ramp-vista'){
  g.fillStyle(0x112a38,.77).fillRoundedRect(x,y,w,h,35);
  g.fillGradientStyle(0x7797ad,0x91adba,0xcfbc9d,0x94a3a2,.75,.75,.75,.75).fillRoundedRect(x+19,y+17,w-38,h-38,24);
  // A bank of sunlit clouds, distant coast, and the aircraft's outer tailplane.
  g.fillStyle(0xe3d5b6,.52).fillEllipse(x+w*.24,y+h*.37,w*.56,h*.18).fillEllipse(x+w*.51,y+h*.3,w*.63,h*.2);
  g.fillStyle(0xc5cfca,.45).fillEllipse(x+w*.72,y+h*.6,w*.52,h*.14).fillEllipse(x+w*.29,y+h*.62,w*.6,h*.16);
  g.fillStyle(0x587581,.33).fillPoints([{x:x+19,y:y+h*.78},{x:x+w*.26,y:y+h*.65},{x:x+w*.46,y:y+h*.76},{x:x+w*.7,y:y+h*.62},{x:x+w-19,y:y+h*.72},{x:x+w-19,y:y+h-18},{x:x+19,y:y+h-18}],true);
  g.fillStyle(0x81969b,.77).fillPoints([{x:x+w*.08,y:y+h*.64},{x:x+w*.84,y:y+h*.4},{x:x+w*.7,y:y+h*.57},{x:x+w*.15,y:y+h*.76}],true);
  g.lineStyle(3,0xd1d1b7,.48).lineBetween(x+w*.09,y+h*.64,x+w*.84,y+h*.4);
  g.lineStyle(19,0x334f60,.95).strokeRoundedRect(x+9,y+9,w-18,h-18,30);
  g.lineStyle(3,0x9ea99c,.5).strokeRoundedRect(x+19,y+19,w-38,h-38,23);
  for(const a of[x+35,x+w-35]){
   g.lineStyle(8,0x3f5964,.8).lineBetween(a,y+38,a,y+h-35);
   for(let b=y+49;b<y+h-30;b+=42)g.fillStyle(0xd1bd86,.55).fillRoundedRect(a-6,b,12,7,2);
  }
  g.fillStyle(accent,.06).fillTriangle(x+w*.25,y+20,x+w*.87,y+h-20,x+28,y+h-20);
 }else if(motif==='cargo-crane'){
  const railY=y+24;
  g.fillStyle(0x172f3d,.4).fillRoundedRect(x,railY,w,28,7);
  g.fillStyle(0x78919a,.27).fillRoundedRect(x+5,railY+4,w-10,8,3);
  for(let a=x+12;a<x+w-20;a+=53)g.lineStyle(3,0xc4a56e,.25).lineBetween(a,railY+20,a+17,railY+10);
  // Empty hoists are visually light rear-wall equipment. The freight underneath
  // is supplied by real collision platforms, never by decorative floating boxes.
  for(const[offset,drop]of[[.23,.69],[.77,.43]]){
   const cx=x+w*offset!,hookY=y+h*drop!;
   g.fillStyle(base,.48).fillRoundedRect(cx-28,railY-8,56,29,8);
   g.fillStyle(0x233d48,.7).fillCircle(cx-17,railY+12,7).fillCircle(cx+17,railY+12,7);
   g.lineStyle(2,0xbdb494,.47).lineBetween(cx-8,railY+18,cx-8,hookY).lineBetween(cx+8,railY+18,cx+8,hookY);
   g.fillStyle(0x3f5960,.8).fillRoundedRect(cx-15,hookY-5,30,23,8);
   g.lineStyle(3,0xc6a76c,.58).strokeCircle(cx,hookY+7,8);
   g.lineStyle(4,0xbdac86,.63).beginPath().moveTo(cx,hookY+16).lineTo(cx,hookY+29).lineTo(cx-10,hookY+35).lineTo(cx-17,hookY+29).lineTo(cx-17,hookY+22).strokePath();
   for(let i=0;i<3;i++)g.fillStyle(accent,.3).fillCircle(cx-8+i*8,railY+1,1.6);
  }
 }else if(motif==='freight-recess'){
  g.fillStyle(0x172f3a,.52).fillRoundedRect(x,y,w,h,32);
  g.lineStyle(12,base,.4).strokeRoundedRect(x+5,y+6,w-10,h-12,26);
  g.lineStyle(2,accent,.3).strokeRoundedRect(x+15,y+15,w-30,h-30,19);
  const count=4,gap=12,bw=(w-70-gap*(count-1))/count;
  for(let i=0;i<count;i++){
   const a=x+35+i*(bw+gap),top=y+55+(i%2)*29;
   g.fillStyle(i%2?0x46666a:0x746d58,.36).fillRoundedRect(a,top,bw,h-95-(i%2)*29,8);
   g.lineStyle(3,0xa1ac92,.3).lineBetween(a+15,top+6,a+15,y+h-40).lineBetween(a+bw-15,top+6,a+bw-15,y+h-40);
   g.lineStyle(1,0xb8b99b,.28).lineBetween(a+4,top+18,a+bw-4,y+h-51).lineBetween(a+bw-4,top+18,a+4,y+h-51);
  }
  for(let a=x+24;a<x+w-15;a+=42){g.fillStyle(0xc6aa74,.3).fillRect(a,y+h-19,18,5);g.fillStyle(0x203d47,.7).fillCircle(a,y+h-28,3);}
 }else if(motif==='supply-lockers'){
  g.fillStyle(0x142f3a,.45).fillRoundedRect(x,y,w,h,24);
  g.lineStyle(8,base,.48).strokeRoundedRect(x+4,y+4,w-8,h-8,22);
  for(let i=0;i<5;i++){
   const bw=(w-42)/5,a=x+15+i*bw;
   g.fillStyle(i%2?0x698175:0x5d7981,.5).fillRoundedRect(a,y+25,bw-9,h-48,12);
   g.lineStyle(2,0xacc5b0,.27).strokeRoundedRect(a+5,y+30,bw-19,h-58,8);
   g.fillStyle(0x1c3a42,.55).fillRoundedRect(a+bw*.25,y+48,bw*.45,h*.3,10);
   g.lineStyle(4,0xb5ad8b,.4).lineBetween(a+bw*.25,y+58,a+bw*.25,y+h-35).lineBetween(a+bw*.7,y+58,a+bw*.7,y+h-35);
   g.fillStyle(accent,.4).fillRoundedRect(a+bw*.34,y+h-67,bw*.28,8,3);
   g.fillStyle(0x203b43,.55).fillRoundedRect(a+bw*.36,y+h-35,bw*.25,5,2);
  }
 }else if(motif==='medical-bay'){
  g.fillStyle(0x1b3945,.57).fillRoundedRect(x,y,w,h,45);
  g.fillStyle(0x91b8a3,.17).fillRoundedRect(x+14,y+14,w-28,h-28,34);
  g.lineStyle(10,0x8daaa5,.5).strokeRoundedRect(x+8,y+8,w-16,h-16,40);
  g.fillStyle(0xc7d7bd,.7).fillRoundedRect(x+w*.19,y+30,14,58,4).fillRoundedRect(x+w*.19-22,y+52,58,14,4);
  g.fillStyle(0x132e3b,.8).fillRoundedRect(x+w*.45,y+35,w*.36,h*.29,9);
  g.lineStyle(2,0x8bd5b6,.65).lineBetween(x+w*.48,y+89,x+w*.57,y+89).lineBetween(x+w*.57,y+89,x+w*.6,y+63).lineBetween(x+w*.6,y+63,x+w*.63,y+105).lineBetween(x+w*.63,y+105,x+w*.67,y+83).lineBetween(x+w*.67,y+83,x+w*.77,y+83);
  // Folded stretcher, bedside cabinet, curtain rail and a rumpled privacy curtain.
  g.lineStyle(6,0x8baca9,.4).lineBetween(x+43,y+112,x+w-35,y+112);
  for(let i=0;i<6;i++){const a=x+w*.78+i*w*.027;g.fillStyle(i%2?0xa2b9b1:0x759a92,.36).fillRoundedRect(a,y+115,w*.039,h-146,5);}
  g.fillStyle(0x93a998,.38).fillRoundedRect(x+40,y+h-112,w*.49,37,13);
  g.fillStyle(0xc4cbb5,.42).fillRoundedRect(x+49,y+h-108,w*.14,25,10);
  g.lineStyle(5,0x70928e,.5).lineBetween(x+62,y+h-75,x+51,y+h-27).lineBetween(x+w*.47,y+h-75,x+w*.49,y+h-27);
  g.fillStyle(0x648987,.5).fillRoundedRect(x+w*.57,y+h-118,w*.12,89,6);
  for(let i=0;i<3;i++)g.fillStyle(0xabc0a8,.6).fillRoundedRect(x+w*.595,y+h-104+i*24,w*.07,3,1);
 }else if(motif==='cable-wall'){
  g.fillStyle(0x152e3c,.6).fillRoundedRect(x,y,w,h,24);
  g.lineStyle(8,base,.5).strokeRoundedRect(x+5,y+5,w-10,h-10,20);
  for(let i=0;i<4;i++){
   const cx=x+30+i*11,cy=y+30+i*10;
   g.lineStyle(5,[0x858b75,0x9d8467,0x6f9698,0x8e7599][i]!, .65).lineBetween(cx,cy,cx,y+h-35-i*8).lineBetween(cx,y+h-35-i*8,x+w-32,y+h-35-i*8);
  }
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){
   const a=x+w*.23+col*w*.225,b=y+28+row*h*.36,bw=w*.19,bh=h*.3;
   g.fillStyle(0x5f7c84,.65).fillRoundedRect(a,b,bw,bh,5);g.fillStyle(0x15333f,.85).fillRoundedRect(a+6,b+6,bw-12,bh*.58,3);
   g.lineStyle(1.5,accent,.5).strokeCircle(a+bw*.48,b+bh*.34,Math.min(bw,bh)*.18);
   g.lineStyle(1,0x8fc8ba,.6).lineBetween(a+12,b+bh*.4,a+bw*.42,b+bh*.25).lineBetween(a+bw*.42,b+bh*.25,a+bw-12,b+bh*.35);
   for(let i=0;i<3;i++)g.fillStyle([0x98c8ac,0xd2b66c,0xad7773][i]!, .65).fillCircle(a+14+i*14,b+bh*.8,2.5);
  }
 }else if(motif==='flight-glass'){
  g.fillStyle(0x172e3c,.83).fillRoundedRect(x,y,w,h,43);
  g.fillGradientStyle(0x6c9ab0,0x8db3bc,0xd6d3b3,0xa1b6b6,.85,.85,.85,.85).fillRoundedRect(x+13,y+13,w-26,h-26,32);
  g.fillStyle(0xf3e0b7,.56).fillCircle(x+w*.73,y+h*.24,h*.11);
  for(let i=0;i<4;i++)g.fillStyle(i%2?0xd9d7bf:0xc6d4cb,.42).fillEllipse(x+w*(.18+i*.21),y+h*(.48+(i%2)*.13),w*.5,h*.17);
  g.fillStyle(0x577e8c,.35).fillTriangle(x+18,y+h-20,x+w*.39,y+h*.62,x+w*.66,y+h-20).fillTriangle(x+w*.25,y+h-20,x+w*.78,y+h*.57,x+w-15,y+h-20);
  for(const ratio of[.3,.66]){g.lineStyle(12,0x3b5968,.88).lineBetween(x+w*ratio,y+16,x+w*(ratio-.07),y+h-13);g.lineStyle(2,0xc5ccba,.4).lineBetween(x+w*ratio+6,y+16,x+w*(ratio-.07)+6,y+h-13);}
  g.lineStyle(11,0x425d6a,.9).strokeRoundedRect(x+7,y+7,w-14,h-14,38);
  g.lineStyle(2,0xc3c8b0,.45).strokeRoundedRect(x+16,y+16,w-32,h-32,30);
  g.fillStyle(0xf0e5c4,.12).fillPoints([{x:x+30,y:y+20},{x:x+w*.3,y:y+20},{x:x+w*.59,y:y+h-24},{x:x+w*.42,y:y+h-24}],true);
 }else if(motif==='ceiling-duct'){
  g.fillStyle(0x203a47,.8).fillRoundedRect(x,y,w,h,17);
  g.fillStyle(base,.46).fillRoundedRect(x+3,y+3,w-6,h-9,15);
  g.fillStyle(0xb4beb0,.16).fillRoundedRect(x+7,y+5,w-14,5,3);
  for(let a=x+17;a<x+w-10;a+=38){g.lineStyle(2,0x162f3b,.7).lineBetween(a,y+4,a,y+h-5);g.lineStyle(1,0xafbcb0,.25).lineBetween(a+3,y+5,a+3,y+h-7);}
  for(let a=x+55;a<x+w-20;a+=220){g.lineStyle(7,0x152c39,.65).lineBetween(a,y+3,a,y+h-3);g.lineStyle(2,accent,.27).lineBetween(a+3,y+3,a+3,y+h-3);}
 }else if(motif==='loose-cable'){
  g.lineStyle(4,0x132a38,.75).beginPath().moveTo(x+5,y+4).lineTo(x+w*.2,y+h*.57).lineTo(x+w*.48,y+h*.86).lineTo(x+w*.76,y+h*.56).lineTo(x+w-5,y+8).strokePath();
  g.lineStyle(1,accent,.5).beginPath().moveTo(x+6,y+4).lineTo(x+w*.2+1,y+h*.57).lineTo(x+w*.48+1,y+h*.86).lineTo(x+w*.76+1,y+h*.56).lineTo(x+w-4,y+8).strokePath();
  g.fillStyle(0xaeb9ad,.55).fillRoundedRect(x+1,y,9,13,2).fillRoundedRect(x+w-9,y+3,9,13,2);
 }else if(motif==='light-pool'){
  // Three nested soft ellipses work on both native Canvas and WebGL.
  g.fillStyle(accent,.026).fillEllipse(x+w/2,y+h/2,w,h);
  g.fillStyle(accent,.032).fillEllipse(x+w/2,y+h/2,w*.75,h*.77);
  g.fillStyle(accent,.04).fillEllipse(x+w/2,y+h/2,w*.45,h*.48);
 }
 return true;
}
