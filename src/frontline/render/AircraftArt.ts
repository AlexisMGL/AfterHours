import type Phaser from 'phaser';
import type { ArenaDecoration, Platform, Rect } from '../core/types';
import { drawAircraftArchitecture } from './AircraftArchitecture';

const color=(value:string|undefined,fallback:number):number=>value?Number.parseInt(value.replace('#',''),16):fallback;

/** The aircraft is a world-space cutaway. Every uncovered space opens onto this sky. */
export function drawAircraftShell(bg:Phaser.GameObjects.Graphics,far:Phaser.GameObjects.Graphics,near:Phaser.GameObjects.Graphics,width:number,camera:Rect):void{
  // Explicit bands retain a blue sky on the native Canvas renderer, which has no gradient opcode.
  for(let i=0;i<90;i++){
    const ratio=i/89,red=Math.round(85+ratio*100),green=Math.round(151+ratio*60),blue=Math.round(191+ratio*24);
    bg.fillStyle(red<<16|green<<8|blue).fillRect(0,i*6,960,6);
  }
  bg.fillStyle(0xffe5ae,.1).fillCircle(757,82,130);
  bg.fillStyle(0xffe5ae,.12).fillCircle(757,82,88);
  bg.fillStyle(0xffeac6,.65).fillCircle(757,82,25);
  // Far below the aircraft, a broken coastline conveys altitude rather than a floor.
  const span=Math.max(1900,width*.38+1350);
  far.fillStyle(0x718d9b,.26).fillPoints([{x:-250,y:490},{x:190,y:437},{x:420,y:476},{x:695,y:422},{x:1020,y:481},{x:1320,y:439},{x:span,y:505},{x:span,y:990},{x:-250,y:990}],true);
  far.fillStyle(0x9bb3b7,.23).fillEllipse(540,517,960,84).fillEllipse(1490,552,1300,93);
  for(let i=0;i<18;i++){
    const x=i*214-180,y=100+(i*137)%410;
    if(x+420<camera.x*.16-220||x-210>camera.x*.16+1180)continue;
    far.fillStyle(0xf3e6cd,.2).fillEllipse(x,y,380+(i%3)*75,40+(i%4)*13);
    far.fillStyle(0xedede0,.3).fillEllipse(x-45,y-9,190,45).fillEllipse(x+65,y+4,238,37);
  }
  for(let i=0;i<12;i++){
    const x=i*320-120,y=220+(i*191)%540;
    if(x+450<camera.x*.38-220||x-220>camera.x*.38+1180)continue;
    near.fillStyle(0xf5ecd8,.15).fillEllipse(x,y,440,66).fillEllipse(x-57,y-19,230,73);
    near.fillStyle(0xd8e5df,.17).fillEllipse(x+65,y+18,360,44);
  }
}

/** Every opaque object in this function exactly occupies authoritative collision geometry. */
export function drawAircraftPlatform(g:Phaser.GameObjects.Graphics,p:Platform,view?:Rect):boolean{
  const {x,y,w,h}=p,skin=p.skin??(p.oneWay?'catwalk':h<100&&w>500?'deck':'supply-crate');
  const wing=p.label==='PORT WING / EXTERIOR',outerHull=wing||/PRESSURE HULL|CREW ROOF|RADAR SPINE|COCKPIT CANOPY/.test(p.label??'');
  if(outerHull){
    // These are the actual colliders: smooth airframe skin replaces the indoor catwalk girders.
    g.fillStyle(wing?0xb4c9c8:0x91b2c0).fillRect(x,y,w,h);
    g.fillStyle(0xeceddb).fillRect(x,y,w,3);
    g.fillStyle(wing?0x8ba9b0:0x7499ab).fillRect(x,y+h*.54,w,h*.46);
    g.fillStyle(0x294f65,.75).fillRect(x,y+Math.max(7,h*.31),w,Math.max(3,h*.16));
    g.fillStyle(0xe0dfc1,.48).fillRect(x,y+h-4,w,2);
    g.fillStyle(0x3a6173).fillRect(x,y+h-2,w,2);
    const left=Math.max(x,view?.x??x),right=Math.min(x+w,view?view.x+view.w:x+w);
    for(let a=Math.floor(left/108)*108;a<right;a+=108){
      const panel=Math.max(x+2,a),seam=Math.min(x+w-2,a+103);
      if(seam<=panel+8)continue;
      g.lineStyle(1,0x466d7e,.6).lineBetween(seam,y+4,seam-9,y+h-5);
      g.lineStyle(1,0xe4e8d6,.55).lineBetween(seam+2,y+4,seam-7,y+h-5);
      for(const offset of[9,39,70])if(panel+offset<seam-8){
        g.fillStyle(0x486d79,.65).fillCircle(panel+offset,y+6,1.1);
        if(h>29)g.fillStyle(0x577b85,.7).fillCircle(panel+offset,y+h-8,1.1);
      }
      if(wing&&h>30&&seam-panel>34){
        g.fillStyle(0x6e909a,.65).fillRoundedRect(panel+20,y+h*.68,Math.min(39,seam-panel-26),5,2);
        g.fillStyle(0xdce3d3,.6).fillRect(panel+22,y+h*.68,Math.min(34,seam-panel-28),1);
      }
    }
    return true;
  }
  if(skin==='deck'||skin==='catwalk'||p.oneWay){
    const deck=color(p.color,0x617b88);
    g.fillStyle(0x152c37,.65).fillRoundedRect(x+2,y+3,w,h,3);
    g.fillGradientStyle(PhaserColor(deck,1.38),deck,PhaserColor(deck,.77),0x2a4252).fillRoundedRect(x,y,w,h,3);
    g.fillStyle(0xd0d7c8).fillRect(x,y,w,3);
    g.fillStyle(0x253c48).fillRect(x+3,y+5,w-6,Math.min(h-5,6));
    const left=Math.max(x,view?.x??x),right=Math.min(x+w,view?view.x+view.w:x+w);
    for(let a=x+8+Math.max(0,Math.floor((left-x)/38))*38;a<right-18;a+=38){
      g.fillStyle(0x9eafad,.6).fillRoundedRect(a,y+6,18,2,1);
      if(h>=17)g.lineStyle(2,0x203847,.6).lineBetween(a,y+13,a+12,y+h-2);
    }
    if(skin==='deck'&&h>35){
      for(let a=x+20+Math.max(0,Math.floor((left-x)/100))*100;a<right;a+=100){g.lineStyle(1,0x1d3441,.75).lineBetween(a,y+16,a,y+h);g.fillStyle(0x9bafaa,.5).fillCircle(a+7,y+21,2);}
      g.fillStyle(0x172e3a,.5).fillRect(x,y+h-12,w,12);
    }
    for(let a=x+4+Math.max(0,Math.floor((left-x)/84))*84;a<right-13;a+=84){
      g.fillStyle(0xe4bd6a).fillPoints([{x:a,y:y+2},{x:a+13,y:y+2},{x:a+7,y:y+7},{x:a,y:y+7}],true);
      if(a+17<right)g.fillStyle(0xcbb368,.2).fillRect(a+17,y+2,Math.min(37,right-a-17),3);
    }
    return true;
  }
  g.fillStyle(0x0b202a,.5).fillRoundedRect(x+3,y+5,w,h,5);
  if(skin.startsWith('cargo-')){
    const base=color(p.color,skin==='cargo-blue'?0x388da3:skin==='cargo-orange'?0xc7794c:0x568b73);
    const light=PhaserColor(base,1.35),dark=PhaserColor(base,.55);
    g.fillGradientStyle(light,base,base,dark).fillRoundedRect(x,y,w,h,5);
    g.lineStyle(2,0x183340).strokeRoundedRect(x,y,w,h,5);
    g.fillStyle(0xf0d6a4,.35).fillRoundedRect(x+4,y+3,w-8,4,2);
    for(let a=x+15;a<x+w-9;a+=15){g.fillStyle(0x0c2c36,.23).fillRoundedRect(a,y+9,4,h-19,2);g.fillStyle(0xffffff,.1).fillRect(a+4,y+10,1,h-21);}
    g.fillStyle(0x263b42).fillRoundedRect(x+4,y+h-10,w-8,9,2);
    g.fillStyle(0xab9470).fillRect(x+8,y+h-7,w-16,3);
    for(const a of[x+2,x+w-10])for(const b of[y+2,y+h-11]){g.fillStyle(0x9caaa4).fillRoundedRect(a,b,8,9,2);g.fillStyle(0x374b53).fillCircle(a+4,b+4,1.5);}
    // A handling pictogram, rather than an object-name label.
    const markX=x+w*.46,markY=y+h*.48;
    g.fillStyle(0xf0e6c5,.7).fillRoundedRect(markX-12,markY-12,25,23,3);
    g.lineStyle(2.5,0x4d6468,.9).lineBetween(markX-5,markY+6,markX-5,markY-6).lineBetween(markX+5,markY+6,markX+5,markY-6);
    g.fillStyle(0x4d6468,.9).fillTriangle(markX-9,markY-3,markX-5,markY-8,markX-1,markY-3).fillTriangle(markX+1,markY-3,markX+5,markY-8,markX+9,markY-3);
    if(p.id%2===0){
      g.lineStyle(3,0x182f35,.55).lineBetween(x+8,y+3,x+w-10,y+h-9).lineBetween(x+w-8,y+3,x+10,y+h-9);
      for(let a=x+10;a<x+w;a+=22)g.lineStyle(1.3,0xd1c094,.6).lineBetween(a,y+4,Math.min(x+w-7,a+21),y+h-11);
    }
  }else if(skin==='fuel-drum'||skin==='fuel-barrels'){
    const count=skin==='fuel-barrels'?Math.max(2,Math.round(w/39)):1,dw=w/count;
    for(let i=0;i<count;i++){
      const a=x+i*dw+2,barrelWidth=dw-4;
      g.fillGradientStyle(0xa56c53,0x62483e,0x945c46,0x453d38).fillRoundedRect(a,y,barrelWidth,h,barrelWidth*.18);
      g.lineStyle(2,0x273d43).strokeRoundedRect(a,y,barrelWidth,h,barrelWidth*.18);
      g.fillStyle(0xcfa97a,.6).fillEllipse(a+barrelWidth/2,y+4,barrelWidth-4,8);
      g.fillStyle(0x34474b).fillRoundedRect(a-1,y+h*.25,barrelWidth+2,5,2).fillRoundedRect(a-1,y+h*.76,barrelWidth+2,5,2);
      g.fillStyle(0xe4c58d).fillRoundedRect(a+barrelWidth*.23,y+h*.4,barrelWidth*.55,17,2);
      g.fillStyle(0x674a3a).fillTriangle(a+barrelWidth*.5,y+h*.42,a+barrelWidth*.32,y+h*.56,a+barrelWidth*.69,y+h*.56);
      g.fillStyle(0x242f31).fillCircle(a+barrelWidth*.7,y+4,2);
    }
  }else if(skin==='engine'){
    g.fillGradientStyle(0x6e8b91,0x3b5662,0x3f626b,0x1e3b48).fillRoundedRect(x,y,w,h,10);
    g.lineStyle(2,0x152f3d).strokeRoundedRect(x,y,w,h,10);
    const r=Math.min(h*.35,w*.23),cx=x+w*.42,cy=y+h*.48;
    g.fillStyle(0x172c37).fillCircle(cx,cy,r);g.lineStyle(4,0x93a4a4).strokeCircle(cx,cy,r);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;g.lineStyle(3,0x627f83).lineBetween(cx+Math.cos(a)*r*.25,cy+Math.sin(a)*r*.25,cx+Math.cos(a+.25)*r*.8,cy+Math.sin(a+.25)*r*.8);}
    g.fillStyle(0xa0b1a7).fillCircle(cx,cy,r*.2);
    g.fillStyle(0xe2b767).fillRoundedRect(x+w-17,y+11,7,8,2);g.fillStyle(0x78c6b5).fillRoundedRect(x+w-17,y+24,7,5,2);
    g.fillStyle(0x273d45).fillRoundedRect(x+6,y+h-13,w-12,9,2);
  }else if(skin==='avionics'||skin==='medical'){
    const medical=skin==='medical';
    g.fillGradientStyle(medical?0xc3cbb7:0x798e94,medical?0x6c8b80:0x3b5365,medical?0x7fa294:0x486879,0x2b444e).fillRoundedRect(x,y,w,h,5);
    g.lineStyle(2,0x213943).strokeRoundedRect(x,y,w,h,5);
    if(medical){g.fillStyle(0xf1ecda).fillRoundedRect(x+w*.24,y+h*.2,w*.52,h*.51,5);g.fillStyle(0x658d70).fillRoundedRect(x+w*.45,y+h*.27,w*.1,h*.37,2).fillRoundedRect(x+w*.33,y+h*.4,w*.34,h*.1,2);}
    else{
      g.fillStyle(0x132e3e).fillRoundedRect(x+8,y+8,w-16,h*.44,3);g.lineStyle(1.5,0x76aab0).strokeRoundedRect(x+8,y+8,w-16,h*.44,3);
      g.lineStyle(1.5,0x7fd4bf,.85).lineBetween(x+13,y+h*.3,x+w*.33,y+h*.25).lineBetween(x+w*.33,y+h*.25,x+w*.49,y+h*.4).lineBetween(x+w*.49,y+h*.4,x+w*.7,y+h*.18).lineBetween(x+w*.7,y+h*.18,x+w-13,y+h*.24);
      for(let i=0;i<3;i++)g.fillStyle([0xe2b967,0x83c4b4,0xd17d68][i]!).fillCircle(x+13+i*13,y+h*.67,3);
      g.fillStyle(0x1c3742).fillRoundedRect(x+10,y+h-16,w-20,7,2);
    }
    g.fillStyle(0xc4c9b6).fillRoundedRect(x+w*.36,y+h-7,w*.28,3,1);
  }else if(skin==='service-cart'){
    g.fillGradientStyle(0xc59759,0x8d6b45,0xa8824d,0x514d41).fillRoundedRect(x,y,w,h-8,4);
    g.lineStyle(2,0x203740).strokeRoundedRect(x,y,w,h-8,4);
    for(let b=y+10;b<y+h-15;b+=15){g.lineStyle(1,0x5c563f).lineBetween(x+5,b,x+w-5,b);g.fillStyle(0xe0c38d).fillRoundedRect(x+w*.35,b+4,w*.3,3,1);}
    for(const a of[x+10,x+w-10]){g.fillStyle(0x162f3b).fillCircle(a,y+h-5,5);g.fillStyle(0x91a3a0).fillCircle(a,y+h-5,2);}
  }else if(skin==='bulkhead'){
    g.fillGradientStyle(0x6d858d,0x3c5664,0x344e5a,0x1e3644).fillRoundedRect(x,y,w,h,5);
    g.lineStyle(2,0x162d3a).strokeRoundedRect(x,y,w,h,5);
    g.fillStyle(0x1c3543).fillRoundedRect(x+7,y+9,Math.max(8,w-14),Math.max(10,h-18),4);
    g.lineStyle(2,0xa9b4a3,.4).strokeRoundedRect(x+9,y+11,Math.max(5,w-18),Math.max(7,h-22),3);
    g.fillStyle(0xe1b86b).fillRoundedRect(x+w-9,y+h*.32,4,14,2);
  }else if(skin==='ramp'){
    g.fillGradientStyle(0x87999b,0x577780,0x46616c,0x29434f).fillRect(x,y,w,h);
    for(let a=x+9;a<x+w;a+=22){g.lineStyle(3,0x263e4c,.7).lineBetween(a,y+4,a,y+h-3);g.lineStyle(1,0xa7b6b0,.6).lineBetween(a+2,y+4,a+2,y+h-3);}
    g.fillStyle(0xe1ba72).fillRect(x,y,w,4);
  }else{
    const strapped=skin==='strapped-case',pallet=skin==='pallet';
    g.fillGradientStyle(strapped?0x778c70:0xad9066,strapped?0x3f5e54:0x775d45,strapped?0x597666:0x8d7152,0x3a4741).fillRoundedRect(x,y,w,h,5);
    g.lineStyle(2,0x22383f).strokeRoundedRect(x,y,w,h,5);
    g.fillStyle(0xc9b386,.45).fillRoundedRect(x+4,y+3,w-8,4,2);
    if(pallet){for(let a=x+8;a<x+w;a+=19)g.fillStyle(0x413b30,.5).fillRect(a,y+4,3,h-8);}
    else{
      g.fillStyle(0x243a3c).fillRoundedRect(x+w*.2,y,6,h,2).fillRoundedRect(x+w*.75,y,6,h,2);
      g.fillStyle(0xd9bc85).fillRoundedRect(x+w*.2-1,y+h*.45,8,8,2).fillRoundedRect(x+w*.75-1,y+h*.45,8,8,2);
      g.lineStyle(2,0xe1d7b4,.6).strokeRoundedRect(x+9,y+12,w-18,h-25,3);
      g.fillStyle(0x203a39).fillRoundedRect(x+w*.4,y+6,w*.2,4,2);
    }
    g.fillStyle(0xc4a878,.7).fillRect(x+4,y+h-8,w-8,4);
  }
  return true;
}

export function drawAircraftDecoration(g:Phaser.GameObjects.Graphics,d:ArenaDecoration):void{
  if(drawAircraftArchitecture(g,d))return;
  const {x,y,w,h}=d,base=color(d.color,0x53717c),accent=color(d.accent,0xd0ad72);
  if(d.kind==='window'){
    g.fillStyle(0x18313e).fillRoundedRect(x,y,w,h,Math.min(w,h)*.45);
    g.fillStyle(0x7fa7b9).fillRoundedRect(x+5,y+5,w-10,h-10,Math.min(w,h)*.4);
    g.fillStyle(0xbdd9db,.17).fillRoundedRect(x+10,y+9,w-23,h-25,Math.min(w,h)*.36);
    g.fillStyle(0xf9ebcd,.5).fillEllipse(x+w*.4,y+h*.28,w*.6,h*.19).fillEllipse(x+w*.65,y+h*.37,w*.55,h*.15);
    g.fillStyle(0xe5eeee,.13).fillTriangle(x+7,y+h-11,x+w-8,y+16,x+w-8,y+h*.35);
    g.lineStyle(3,base,.8).strokeRoundedRect(x+2,y+2,w-4,h-4,Math.min(w,h)*.43);
    for(const a of[x+w*.18,x+w*.82])g.fillStyle(0xb9c8c3,.6).fillCircle(a,y+h-6,1.7);
  }else if(d.kind==='rib'){
    g.lineStyle(Math.min(13,w*.25),0x1d3745,.4).strokeRoundedRect(x,y,w,h,Math.min(w/2,65));
    g.lineStyle(3,base,.5).strokeRoundedRect(x+4,y+3,w-8,h-6,Math.min(w/2-4,60));
    for(let b=y+20;b<y+h;b+=70)g.fillStyle(0xb1bdb4,.3).fillCircle(x+5,b,2).fillCircle(x+w-5,b,2);
  }else if(d.kind==='pipe'){
    const horizontal=w>h;
    g.lineStyle(10,0x162e3b,.6).lineBetween(x,y,x+w,y+h);g.lineStyle(6,base,.65).lineBetween(x,y-1,x+w,y+h-1);g.lineStyle(1.5,0xb2c5bb,.3).lineBetween(x,y-3,x+w,y+h-3);
    const length=Math.hypot(w,h);for(let a=30;a<length;a+=80){const ratio=a/length;g.fillStyle(accent,.5).fillRoundedRect(x+w*ratio-4,y+h*ratio-4,horizontal?7:11,horizontal?11:7,2);}
  }else if(d.kind==='light'){
    g.fillStyle(accent,.045).fillEllipse(x+w/2,y+h+20,w*1.8,65);g.fillStyle(0x18313f,.8).fillRoundedRect(x,y,w,h,4);
    g.fillStyle(accent,.65).fillRoundedRect(x+4,y+3,w-8,Math.max(3,h-6),3);g.fillStyle(0xf5eac8,.3).fillRoundedRect(x+7,y+3,w-14,2,1);
  }else if(d.kind==='fan'){
    const cx=x+w/2,cy=y+h/2,r=Math.min(w,h)/2;g.fillStyle(0x1c3540,.7).fillCircle(cx,cy,r);g.lineStyle(4,base,.65).strokeCircle(cx,cy,r-2);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;g.lineStyle(5,base,.55).lineBetween(cx+Math.cos(a)*r*.2,cy+Math.sin(a)*r*.2,cx+Math.cos(a+.3)*r*.75,cy+Math.sin(a+.3)*r*.75);}
    g.fillStyle(accent,.4).fillCircle(cx,cy,r*.17);
  }else if(d.kind==='cargo-net'){
    g.lineStyle(1.5,base,.35).strokeRoundedRect(x,y,w,h,4);
    for(let a=0;a<w+h;a+=24){
      const startX=Math.max(0,a-h),startY=Math.min(h,a),endX=Math.min(w,a),endY=Math.max(0,a-w);
      g.lineStyle(1,accent,.26).lineBetween(x+startX,y+startY,x+endX,y+endY);
      g.lineBetween(x+w-startX,y+startY,x+w-endX,y+endY);
    }
    g.fillStyle(0xa3ae9a,.35).fillCircle(x,y,3).fillCircle(x+w,y,3).fillCircle(x,y+h,3).fillCircle(x+w,y+h,3);
  }else{
    g.fillStyle(0x1a3442,.52).fillRoundedRect(x,y,w,h,5);g.lineStyle(1.5,base,.65).strokeRoundedRect(x,y,w,h,5);
    if(d.kind==='panel'){
      if(h>500){
        // Large areas are recessed hull panels, not giant computer screens.
        for(let row=0;row<4;row++){
          const a=y+18+row*(h-36)/4,panelH=(h-36)/4-13;
          g.fillStyle(base,.13).fillRoundedRect(x+12,a,w-24,panelH,20);
          g.lineStyle(1,0xa5b9b4,.13).strokeRoundedRect(x+12,a,w-24,panelH,20);
          for(const b of[x+23,x+w-23])g.fillStyle(0xc0c6b6,.19).fillCircle(b,a+12,2).fillCircle(b,a+panelH-12,2);
        }
      }else{
        g.fillStyle(0x152e3d,.6).fillRoundedRect(x+7,y+7,w*.62,Math.max(10,h-14),3);
        g.lineStyle(1.5,accent,.55).lineBetween(x+12,y+h*.6,x+w*.25,y+h*.45).lineBetween(x+w*.25,y+h*.45,x+w*.38,y+h*.65).lineBetween(x+w*.38,y+h*.65,x+w*.58,y+h*.3);
        for(let i=0;i<3;i++)g.fillStyle([0x9acfc1,accent,0xcc8873][i]!, .65).fillCircle(x+w*.82,y+13+i*12,2.5);
      }
    }else if(d.kind==='hatch'){
      g.lineStyle(2,base,.7).strokeRoundedRect(x+5,y+5,w-10,h-10,8);g.lineStyle(3,accent,.6).strokeCircle(x+w*.7,y+h*.55,Math.min(10,w*.1));
      g.lineStyle(2,base,.4).lineBetween(x+w*.2,y+12,x+w*.2,y+h-12);
    }else{
      g.fillStyle(accent,.7).fillRoundedRect(x+5,y+5,5,h-10,2);g.fillStyle(accent,.3).fillRect(x+17,y+h-8,w-23,2);
    }
  }
}

function PhaserColor(value:number,multiplier:number):number{
  const red=Math.min(255,Math.round((value>>16&255)*multiplier)),green=Math.min(255,Math.round((value>>8&255)*multiplier)),blue=Math.min(255,Math.round((value&255)*multiplier));
  return red<<16|green<<8|blue;
}
