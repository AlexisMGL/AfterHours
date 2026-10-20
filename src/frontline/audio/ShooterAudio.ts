import type { GameEvent, MapId, MatchState } from '../core/types';
import { WEAPONS } from '../core/config';
import { OrchestraBank, ORCHESTRAL_PHRASES, type OrchestralInstrument } from './Orchestra';

export type ShooterTheme=MapId|'menu'|'selection'|'victory'|'defeat';
interface Score {bpm:number;root:number;scale:number[];progression:number[];wave:OscillatorType;style:'action'|'industrial'|'orchestral'|'urban'|'military'|'naval'|'menu'|'selection'|'victory'|'defeat';a:number[][];b:number[][]}
interface Voice {sources:AudioScheduledSourceNode[];nodes:AudioNode[];music:boolean;priority:number;end:number;closed:boolean}
interface Sound {wave?:OscillatorType;noise?:boolean;from:number;to?:number;duration:number;gain:number;delay?:number}
const minor=[0,2,3,5,7,8,10],major=[0,2,4,5,7,9,11];

// Ten original scores. Integers are scale degrees, -99 denotes a rest.
// Each score has two eight-bar sections; the 32-bar arrangement adds a varied
// second statement and an orchestrated return after the contrasting section.
// Skybreach and the menu/result themes use the longer, duration-based phrases
// in Orchestra.ts; the remaining maps retain their own eighth-note melodies.
export const SHOOTER_SCORES:Record<ShooterTheme,Score>={
 aircraft:{bpm:108,root:50,scale:minor,progression:[0,5,3,4,0,5,6,4],wave:'triangle',style:'orchestral',
  a:[[7,-99,9,11,14,11,9,7],[12,10,7,-99,5,7,10,12],[10,-99,12,14,12,10,7,5],[11,8,6,-99,8,11,13,11],[7,9,11,14,16,14,11,9],[12,-99,14,17,16,14,12,10],[13,11,9,6,9,11,13,16],[11,-99,8,6,4,6,8,11]],
  b:[[14,-99,11,9,7,-99,9,11],[12,14,17,14,12,10,7,-99],[10,12,14,17,19,17,14,12],[13,11,8,6,8,-99,11,13],[14,16,18,21,18,16,14,-99],[17,16,14,12,10,7,10,12],[13,-99,16,18,20,18,16,13],[15,13,11,8,6,-99,8,11]]},
 factory:{bpm:132,root:64,scale:minor,progression:[0,0,5,3,0,6,5,4],wave:'sawtooth',style:'industrial',
  a:[[0,0,-99,4,7,-99,6,4],[0,-99,2,0,4,2,-99,0],[5,5,-99,9,12,-99,10,9],[3,-99,7,10,7,5,3,-99],[7,7,-99,11,14,-99,13,11],[6,-99,9,13,-99,11,9,6],[5,5,-99,12,10,9,-99,7],[8,-99,11,15,13,11,8,-99]],
  b:[[14,-99,-99,11,9,7,-99,4],[14,13,11,-99,9,-99,7,6],[12,-99,16,19,17,16,12,-99],[10,14,-99,17,14,12,10,7],[14,-99,11,9,-99,7,4,-99],[13,16,20,-99,18,-99,16,13],[12,-99,10,9,7,5,-99,9],[11,13,15,-99,13,11,8,4]]},
 forest:{bpm:112,root:65,scale:major,progression:[0,3,5,4,0,3,1,4],wave:'triangle',style:'orchestral',
  a:[[7,-99,11,9,8,-99,7,4],[10,7,-99,5,7,10,12,-99],[12,-99,9,7,5,-99,7,9],[11,8,6,-99,8,11,13,-99],[7,11,14,-99,13,11,9,7],[10,-99,12,14,17,14,12,10],[8,12,-99,15,12,10,8,5],[11,-99,8,6,4,6,8,11]],
  b:[[14,-99,11,7,9,-99,11,14],[17,14,12,10,-99,7,10,12],[12,16,19,-99,17,16,14,12],[15,-99,13,11,8,6,-99,8],[14,18,21,-99,20,18,16,14],[17,-99,14,12,10,12,14,17],[15,12,10,-99,8,-99,10,12],[13,11,8,6,4,-99,6,8]]},
 city:{bpm:126,root:60,scale:minor,progression:[0,5,2,6,0,3,5,4],wave:'triangle',style:'urban',
  a:[[7,10,-99,9,7,4,-99,6],[5,-99,7,10,-99,12,10,7],[9,6,4,-99,2,4,6,9],[6,-99,10,13,11,10,-99,6],[7,10,14,-99,13,10,9,7],[10,-99,7,5,3,5,-99,7],[12,10,7,-99,5,7,10,12],[11,-99,8,6,4,8,-99,11]],
  b:[[14,-99,10,9,-99,7,4,7],[12,10,7,-99,10,12,14,-99],[9,-99,13,16,13,9,6,-99],[13,17,-99,20,17,13,10,6],[14,13,10,-99,9,7,-99,4],[17,-99,14,12,10,7,10,12],[12,14,17,-99,14,12,10,-99],[15,13,11,8,6,4,-99,8]]},
 harbor:{bpm:124,root:59,scale:minor,progression:[0,6,3,5,0,6,2,4],wave:'square',style:'military',
  a:[[7,-99,7,11,9,7,4,-99],[6,10,13,-99,10,6,3,-99],[10,-99,14,12,10,7,5,7],[12,9,-99,7,5,-99,7,9],[14,-99,11,7,11,14,16,14],[13,10,6,-99,10,13,17,-99],[9,-99,6,4,2,4,6,9],[11,13,15,13,11,-99,8,6]],
  b:[[14,14,-99,18,16,14,11,-99],[13,-99,17,20,17,13,10,-99],[17,14,10,-99,12,14,17,19],[19,-99,16,12,9,7,9,12],[14,18,21,18,16,14,-99,11],[20,17,13,-99,10,13,17,20],[16,-99,13,9,6,-99,9,13],[15,13,11,8,6,-99,8,11]]},
 ship:{bpm:120,root:55,scale:minor,progression:[0,3,6,4,0,5,3,4],wave:'sawtooth',style:'naval',
  a:[[7,9,-99,11,14,11,9,7],[10,-99,7,5,3,-99,5,7],[6,10,-99,13,11,10,6,3],[11,-99,8,6,4,6,8,11],[14,11,9,-99,7,9,11,14],[12,-99,9,7,5,7,-99,9],[10,12,14,-99,17,14,12,10],[13,11,8,-99,6,8,11,-99]],
  b:[[14,-99,18,21,20,18,14,11],[17,14,10,-99,7,10,14,17],[20,-99,17,13,10,13,-99,17],[18,15,13,11,8,-99,11,13],[21,18,14,-99,11,14,18,21],[19,-99,16,12,9,12,16,19],[17,14,12,10,-99,7,10,12],[15,-99,13,11,8,6,-99,11]]},
 menu:{bpm:104,root:62,scale:minor,progression:[0,5,3,6,0,5,3,4],wave:'triangle',style:'menu',
  a:[[7,-99,11,-99,14,13,11,-99],[12,-99,10,7,5,-99,7,10],[10,12,-99,14,12,10,7,-99],[13,-99,10,6,3,6,10,13],[14,-99,11,9,7,-99,9,11],[17,14,12,-99,10,7,10,12],[14,-99,12,10,7,5,-99,7],[11,-99,8,6,4,6,8,-99]],
  b:[[14,-99,18,21,18,14,11,-99],[17,14,12,10,7,-99,10,12],[17,-99,14,12,10,12,14,17],[20,17,13,-99,10,13,17,-99],[21,-99,18,14,11,14,18,21],[19,17,14,12,10,-99,12,14],[17,-99,14,12,10,7,10,12],[15,13,11,8,6,-99,8,11]]},
 selection:{bpm:94,root:57,scale:minor,progression:[0,0,5,3,0,6,5,4],wave:'sine',style:'selection',
  a:[[7,-99,-99,11,9,-99,7,-99],[4,-99,7,-99,11,-99,9,7],[5,-99,9,12,-99,10,9,-99],[3,-99,7,-99,10,7,-99,5],[7,-99,14,-99,11,9,7,-99],[6,-99,10,13,-99,10,6,-99],[5,-99,9,-99,12,10,9,7],[8,-99,11,-99,13,11,8,-99]],
  b:[[14,-99,11,-99,9,-99,7,4],[11,-99,14,-99,13,11,9,-99],[12,-99,9,-99,7,5,-99,9],[10,-99,14,17,-99,14,10,-99],[14,-99,18,-99,16,14,11,-99],[13,-99,17,-99,20,17,13,10],[12,-99,16,19,-99,16,12,-99],[15,-99,13,11,8,6,-99,8]]},
 victory:{bpm:126,root:62,scale:major,progression:[0,3,4,0,5,3,4,0],wave:'square',style:'victory',
  a:[[7,9,11,-99,14,-99,11,14],[10,12,14,17,14,-99,12,10],[11,-99,13,15,18,15,13,-99],[14,11,9,7,-99,9,11,14],[12,14,16,19,-99,16,14,12],[17,-99,14,12,10,12,14,17],[15,13,11,8,11,13,15,18],[14,-99,11,9,7,-99,-99,-99]],
  b:[[14,18,21,-99,23,21,18,14],[17,-99,19,21,24,21,19,17],[18,20,22,25,22,20,18,-99],[21,-99,18,16,14,-99,18,21],[19,21,23,26,-99,23,21,19],[24,21,19,17,-99,19,21,24],[22,-99,20,18,15,18,20,22],[21,-99,18,16,14,-99,-99,-99]]},
 defeat:{bpm:78,root:62,scale:minor,progression:[0,5,3,4,0,5,6,0],wave:'triangle',style:'defeat',
  a:[[14,-99,11,-99,9,7,-99,-99],[12,-99,10,7,5,-99,-99,-99],[10,-99,7,-99,5,3,-99,-99],[11,-99,8,6,4,-99,-99,-99],[7,-99,9,-99,11,9,7,-99],[10,-99,7,5,-99,7,10,-99],[13,-99,10,6,3,-99,6,-99],[7,-99,4,-99,0,-99,-99,-99]],
  b:[[11,-99,14,-99,18,14,11,-99],[12,-99,16,19,16,-99,12,-99],[10,-99,14,-99,17,14,10,-99],[11,-99,15,18,15,11,8,-99],[14,-99,11,9,7,-99,4,-99],[12,-99,10,7,5,-99,-99,-99],[13,-99,10,6,3,-99,6,-99],[7,-99,4,-99,0,-99,-99,-99]]},
};

/** Bounded musical sequencing and distance-filtered 2D battlefield acoustics. */
export class ShooterAudio{
  private context?:AudioContext;
  private master?:GainNode;
  private music?:GainNode;
  private sfx?:GainNode;
  private echo?:DelayNode;
  private room?:DelayNode;
  private noise?:AudioBuffer;
  private orchestra?:OrchestraBank;
  private hall?:ConvolverNode;
  private preparingOrchestra=false;
  private voices=new Set<Voice>();
  private theme:ShooterTheme='menu';
  private playing=false;
  private timer?:ReturnType<typeof setInterval>;
  private next=0;
  private step=0;
  private intensity=0;
  private volumes=[.75,.45,.8];
  private listener={x:0,y:0,interior:false};
  private noiseOffset=0;

  async unlock():Promise<void>{
    if(!this.context){
      const Constructor=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Constructor)return;
      const c=new Constructor();this.context=c;
      this.master=c.createGain();this.music=c.createGain();this.sfx=c.createGain();
      const compressor=c.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=18;compressor.ratio.value=4;compressor.attack.value=.003;compressor.release.value=.15;
      this.music.connect(this.master);this.sfx.connect(this.master);this.master.connect(compressor);compressor.connect(c.destination);
      this.echo=c.createDelay(.7);this.echo.delayTime.value=.22;const echoFeedback=c.createGain(),echoWet=c.createGain();echoFeedback.gain.value=.17;echoWet.gain.value=.1;
      this.echo.connect(echoFeedback);echoFeedback.connect(this.echo);this.echo.connect(echoWet);echoWet.connect(this.music);
      this.orchestra=new OrchestraBank(c);this.hall=c.createConvolver();this.hall.buffer=this.orchestra.hall();
      const hallWet=c.createGain();hallWet.gain.value=.32;this.hall.connect(hallWet);hallWet.connect(this.music);
      this.room=c.createDelay(.3);this.room.delayTime.value=.065;const roomWet=c.createGain();roomWet.gain.value=.18;const roomFilter=c.createBiquadFilter();roomFilter.frequency.value=2800;
      this.room.connect(roomFilter);roomFilter.connect(roomWet);roomWet.connect(this.sfx);
      this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const data=this.noise.getChannelData(0);let rng=0x5be79a31;
      for(let i=0;i<data.length;i++){rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;data[i]=(rng>>>0)/0xffffffff*2-1;}
      this.setVolumes(this.volumes[0]!,this.volumes[1]!,this.volumes[2]!);
    }
    try{if(this.context.state==='suspended')await this.context.resume();}catch{return;}
    if(this.playing&&!this.timer)this.start();
  }
  setVolumes(master:number,music:number,sfx:number):void{
    this.volumes=[master,music,sfx].map(v=>Math.max(0,Math.min(1,v)));
    if(!this.context)return;const t=this.context.currentTime;
    this.master!.gain.setTargetAtTime(this.volumes[0]!,t,.02);this.music!.gain.setTargetAtTime(this.volumes[1]!*.72,t,.02);this.sfx!.gain.setTargetAtTime(this.volumes[2]!,t,.02);
  }
  playTheme(id:ShooterTheme):void{
    if(this.theme===id&&this.playing)return;
    if(this.timer)clearInterval(this.timer);this.timer=undefined;
    for(const voice of [...this.voices])if(voice.music)this.release(voice);
    this.theme=id;this.playing=true;this.step=0;if(this.context?.state==='running')this.start();
  }
  updateListener(x:number,y:number,interior=false):void{this.listener={x,y,interior};}
  setIntensity(value:number):void{this.intensity=Math.max(0,Math.min(1,value));}
  destroy():void{
    if(this.timer)clearInterval(this.timer);this.timer=undefined;this.playing=false;
    for(const voice of [...this.voices])this.release(voice);void this.context?.close();this.context=undefined;
  }

  playEvent(event:GameEvent,state:MatchState):void{
    if(!this.context||this.context.state!=='running'||this.volumes[0]===0||this.volumes[2]===0)return;
    const sounds:Sound[]=[];
    const tone=(from:number,to:number,duration:number,gain:number,wave:OscillatorType='sine',delay=0):void=>{sounds.push({from,to,duration,gain,wave,delay});};
    const noise=(duration:number,gain:number,delay=0):void=>{sounds.push({noise:true,from:0,duration,gain,delay});};
    let filter=7000,priority=3;
    switch(event.type){
      case 'shot':{
        const category=WEAPONS[event.weapon??'vanguard'].category;
        priority=4;
        switch(category){
          case 'pistol':tone(240,65,.105,.28,'triangle');noise(.085,.25);filter=3400;break;
          case 'smg':tone(170,60,.065,.2,'triangle');noise(.055,.24);filter=4400;break;
          case 'rifle':tone(210,48,.13,.3,'triangle');noise(.105,.34);tone(1700,900,.025,.035);filter=5200;break;
          case 'shotgun':tone(135,35,.24,.43);noise(.25,.46);filter=2800;break;
          case 'lmg':tone(155,42,.16,.36,'triangle');noise(.13,.32);tone(1100,700,.035,.04);filter=3400;break;
          case 'sniper':tone(270,48,.27,.38,'triangle');noise(.20,.42);noise(.25,.1,.12);filter=6200;break;
          case 'dmr':tone(240,45,.19,.32,'triangle');noise(.14,.34);filter=4800;break;
          case 'launcher':tone(110,38,.27,.4);noise(.23,.23);filter=1700;break;
          case 'rocket':tone(140,45,.32,.35,'triangle');noise(.45,.28);filter=2400;break;
        }
        if(event.weapon==='hush'){for(const part of sounds)part.gain*=.38;filter=1500;}
        break;
      }
      case 'impact':{
        priority=2;
        if(event.material==='metal'){tone(1800,1200,.12,.08,'triangle');tone(2700,2350,.055,.04);noise(.035,.06);filter=6000;}
        else if(event.material==='glass'){for(let i=0;i<4;i++)tone(1700+i*675,1300+i*420,.13,.025,'sine',i*.009);noise(.08,.06);filter=9000;}
        else if(event.material==='wood'){tone(180,65,.07,.13,'triangle');noise(.055,.1);filter=1700;}
        else{noise(.075,.11);tone(740,370,.035,.035,'triangle');filter=2600;}break;
      }
      case 'explosion':priority=8;tone(94,23,.75,.55);tone(53,19,.55,.25,'triangle');noise(.75,.4);filter=1600;break;
      case 'footstep':priority=0;noise(.04,.035);tone(event.material==='metal'?180:115,65,.05,.04);filter=event.material==='metal'?2100:950;break;
      case 'jump':priority=1;tone(130,210,.08,.045,'triangle');noise(.05,.025);filter=1600;break;
      case 'land':priority=1;tone(110,45,.1,.12);noise(.075,.065);filter=1300;break;
      case 'reload':priority=2;noise(.055,.08);tone(1250,900,.025,.045,'triangle');noise(.04,.07,.16);tone(1600,1000,.035,.12,'triangle',.27);filter=5400;break;
      case 'dry':priority=2;tone(1300,750,.025,.07,'triangle');filter=3600;break;
      case 'damage':priority=5;tone(140,58,.1,.16,'triangle');noise(.065,.13);filter=1800;break;
      case 'death':priority=5;tone(220,65,.2,.10,'triangle');noise(.17,.08);filter=1600;break;
      case 'heal':priority=2;tone(660,660,.12,.05);tone(880,880,.16,.05,'sine',.07);filter=5000;break;
      case 'ability':{
        priority=5;const soldier=state.soldiers.find(s=>s.id===event.soldierId);
        if(soldier?.classId==='defense'){tone(160,540,.23,.15,'triangle');tone(1100,800,.15,.05,'sine',.1);noise(.15,.04);}
        else if(soldier?.classId==='support'){[523,659,784].forEach((n,i)=>tone(n,n,.22,.065,'sine',i*.055));}
        else if(soldier?.classId==='sniper'){tone(460,1300,.3,.06);tone(920,1600,.22,.025,'triangle',.07);}
        else{tone(120,300,.25,.13,'triangle');noise(.15,.05);}filter=4800;break;
      }
      case 'crate':priority=3;tone(420,520,.08,.09,'triangle');noise(.07,.08);[660,880,1100].forEach((n,i)=>tone(n,n,.13,.06,'triangle',.1+i*.05));filter=5000;break;
      case 'capture':priority=7;[523,659,784,1047].forEach((n,i)=>tone(n,n,.2,.08,'triangle',i*.09));filter=6000;break;
      case 'warning':priority=7;for(let i=0;i<3;i++)tone(440,660,.18,.06,'triangle',i*.25);filter=4300;break;
      case 'round':case 'victory':priority=8;[392,523,659,784,1047].forEach((n,i)=>tone(n,n,.28,.09,'triangle',i*.11));filter=6500;break;
    }
    const dx=event.x-this.listener.x,dy=event.y-this.listener.y,distance=Math.hypot(dx,dy);
    if(distance>2400&&priority<7)return;
    const volume=1/(1+(distance/360)**1.65);
    if(volume<.025&&priority<5)return;
    this.sound(sounds,Math.max(350,filter/(1+distance/600))*(this.listener.interior?.7:1),Math.max(-1,Math.min(1,dx/650)),volume,priority+volume,this.listener.interior);
  }

  private start():void{
    const c=this.context!;
    // Sample generation must never run inside the live scheduling horizon.
    // Cache the complete arrangement before choosing its audio-clock time.
    if(this.orchestralTheme()){
      this.preparingOrchestra=true;
      try{const score=SHOOTER_SCORES[this.theme];for(let step=0;step<256;step++)this.musicStep(score,step,0,60/score.bpm/2);}finally{this.preparingOrchestra=false;}
    }
    this.next=c.currentTime+.06;
    const schedule=():void=>{
      if(!this.context||this.context.state!=='running')return;
      if(this.next<this.context.currentTime-.2)this.next=this.context.currentTime+.025;
      while(this.next<this.context.currentTime+.15){const score=SHOOTER_SCORES[this.theme],eighth=60/score.bpm/2;this.musicStep(score,this.step,this.next,eighth);this.step=(this.step+1)%256;this.next+=eighth;}
    };
    schedule();this.timer=setInterval(schedule,25);
  }
  private orchestralTheme():boolean{return this.theme==='aircraft'||this.theme==='menu'||this.theme==='selection'||this.theme==='victory'||this.theme==='defeat';}
  private pitch(s:Score,degree:number):number{return s.root+Math.floor(degree/7)*12+s.scale[((degree%7)+7)%7]!;}
  private musicStep(s:Score,step:number,t:number,eighth:number):void{
    if(this.orchestralTheme()){
      this.orchestralStep(s,step,t,eighth);return;
    }
    const bar=Math.floor(step/8),beat=step%8,section=Math.floor(bar/8),phrase=bar%8;
    const degrees=(section===2?s.b:s.a)[phrase]!,note=degrees[beat]!,chord=s.progression[phrase]!;
    const soft=s.style==='selection'||s.style==='defeat';
    if(note!==-99){this.note(this.pitch(s,note),t,eighth*(degrees[(beat+1)%8]===-99?1.7:.8),'lead',s,soft?.055:.075);if(section===3&&!soft&&beat%2===0)this.note(this.pitch(s,note+7),t,eighth*.65,'arp',s,.016);}
    if(!soft||beat%2===0)this.note(this.pitch(s,chord-14+(beat===3||beat===7?7:0)),t,eighth*.8,'bass',s,.11);
    if(beat===0)for(const n of[0,2,4])this.note(this.pitch(s,chord+n-7),t,eighth*7.5,'pad',s,soft?.019:.023);
    if(section===1||section===3||this.intensity>.6){if(beat%2===1)this.note(this.pitch(s,chord+[0,2,4,6][beat%4]!+7),t,eighth*.4,'arp',s,.025);}
    if(s.style==='defeat')return;
    const drum=soft?.35:1;
    if(beat===0||beat===4||((s.style==='industrial'||s.style==='action')&&beat===6))this.musicDrum(t,140,36,.17,.24*drum);
    if(beat===2||beat===6){this.musicNoise(t,.12,3100,.085*drum);this.musicDrum(t,185,125,.065,.075*drum);}
    this.musicNoise(t,beat===7?.08:.025,6500,(beat%2?.022:.035)*drum);
    if(s.style==='orchestral'||s.style==='naval'){if(beat===3||beat===7)this.musicDrum(t,170+beat*11,80,.18,.13);}
    if(s.style==='military'){if(beat===3||beat===7){this.musicNoise(t+eighth*.5,.05,3500,.04);this.musicNoise(t+eighth*.75,.04,3500,.03);}}
    if(s.style==='industrial'&&beat%2)this.note(this.pitch(s,14+beat%3*2),t,.025,'arp',s,.035);
    if(s.style==='urban'&&beat===5)this.musicDrum(t+eighth*.5,130,45,.12,.16);
    if(phrase===7&&beat>=6){this.musicDrum(t+eighth*.5,260-beat*15,80,.12,.1);this.musicNoise(t+eighth*.5,.06,4200,.05);}
    if(this.intensity>.5&&beat%2)this.musicNoise(t+eighth*.5,.03,7800,.035*this.intensity);
  }

  private orchestralStep(s:Score,step:number,t:number,eighth:number):void{
    const bar=Math.floor(step/8),beat=step%8,section=Math.floor(bar/8),phrase=bar%8;
    const quiet=this.theme==='selection'||this.theme==='defeat',menu=this.theme==='menu';
    const root=this.theme==='aircraft'?s.root:this.theme==='selection'?45:50;
    const score={...s,root},chord=s.progression[phrase]!,arc=section===2?.9:section===3?1:section===1?.8:.67;
    const dynamic=(quiet?.52:menu?.7:1)*arc*(.92+this.intensity*.12);
    if(beat===0){
      // Long, overlapping bowed chords and a double-bass foundation.
      for(const n of [0,2,4])this.orchestralNote('strings',this.pitch(score,chord+n),t,eighth*8.15,.072*dynamic,.32,(n-2)*.17);
      this.orchestralNote('basses',this.pitch(score,chord-7),t,eighth*7.5,.13*dynamic,.12,-.18);
      if(!quiet&&!menu)this.orchestralNote('horns',this.pitch(score,chord),t,eighth*3.3,.09*dynamic,.2,.22);
    }
    const melody=(section===2?ORCHESTRAL_PHRASES.b:ORCHESTRAL_PHRASES.a)[phrase];
    for(const [offset,degree,length] of melody)if(offset===beat){
      const pitch=this.pitch(score,degree);
      this.orchestralNote(quiet||section===2?'flute':'horns',pitch,t,eighth*length,.19*dynamic,.09,.12);
      this.orchestralNote('strings',pitch+(section===3?12:0),t+.025,eighth*(length+.12),.07*dynamic,.16,-.3);
    }
    // Bowed low-string pulses are articulated rather than a synth arpeggiator.
    if(!quiet&&!menu&&(beat%2===0||section===3||this.intensity>.7)){
      this.orchestralNote('basses',this.pitch(score,chord+(beat===6?4:0)),t,eighth*.72,.105*dynamic,.018,-.35);
    }
    if(quiet)return;
    if(beat===0||(!menu&&beat===4))this.orchestralNote('timpani',this.pitch(score,chord-7),t,eighth*3,.32*dynamic,.003,-.22);
    if(phrase===7&&beat>=6&&!menu)this.orchestralNote('timpani',this.pitch(score,beat===6?-7:-10),t,eighth*1.6,.2*dynamic,.003,.2);
    if(beat===0&&(phrase===0||phrase===4))this.orchestralNote('cymbal',60,t,2.8,.12*dynamic,.04,.4);
  }

  private orchestralNote(instrument:OrchestralInstrument,midi:number,t:number,duration:number,volume:number,attack:number,pan:number):void{
    const sample=this.orchestra!.sample(instrument,midi);if(this.preparingOrchestra)return;
    const c=this.context!,source=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter(),panner=c.createStereoPanner();
    source.buffer=sample.buffer;source.playbackRate.value=sample.rate;
    const percussion=instrument==='timpani'||instrument==='cymbal',release=percussion?.12:instrument==='strings'?.38:.23;
    if(!percussion){source.loop=true;source.loopStart=.4;source.loopEnd=1.5;}
    filter.type='lowpass';filter.frequency.setValueAtTime(instrument==='horns'?1700:instrument==='basses'?1100:instrument==='cymbal'?11000:5800,t);
    if(instrument==='horns')filter.frequency.linearRampToValueAtTime(2900,t+.18);
    panner.pan.value=pan;const end=t+duration+release;
    gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(volume,t+attack);
    gain.gain.setTargetAtTime(volume*(percussion?.08:.82),t+Math.min(duration*.55,.6),percussion?.4:.35);
    gain.gain.setTargetAtTime(.0001,t+duration,release/4);gain.gain.setValueAtTime(0,end);
    source.connect(filter);filter.connect(gain);gain.connect(panner);panner.connect(this.music!);panner.connect(this.hall!);
    const voice=this.register([source],[filter,gain,panner],true,percussion?1:instrument==='horns'||instrument==='flute'?4:2,end);
    if(!voice)return;source.start(t);source.stop(end+.01);
  }

  private note(midi:number,t:number,duration:number,kind:'lead'|'bass'|'pad'|'arp',score:Score,volume:number):void{
    const c=this.context!,gain=c.createGain(),filter=c.createBiquadFilter(),sources:OscillatorNode[]=[];
    filter.type='lowpass';filter.frequency.value=kind==='bass'?650:kind==='pad'?1500:score.style==='industrial'?1900:score.style==='orchestral'?3100:3600;filter.Q.value=kind==='bass'?1.2:.6;
    const attack=kind==='pad'?.16:kind==='lead'?.012:.003,end=t+duration+.08;
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+attack);gain.gain.exponentialRampToValueAtTime(volume*.6,t+Math.max(attack+.02,duration*.65));gain.gain.exponentialRampToValueAtTime(.0001,end);
    const count=kind==='lead'&&['action','naval','orchestral'].includes(score.style)?2:1;
    for(let i=0;i<count;i++){const osc=c.createOscillator();osc.type=kind==='bass'?'sawtooth':kind==='pad'?'triangle':kind==='arp'?'triangle':score.wave;osc.frequency.value=440*2**((midi-69)/12);osc.detune.value=count===2?(i?5:-5):0;osc.connect(filter);sources.push(osc);}
    filter.connect(gain);gain.connect(this.music!);if(kind==='lead'||kind==='arp')gain.connect(this.echo!);
    const voice=this.register(sources,[filter,gain],true,kind==='lead'?3:kind==='pad'?2:1,end);if(!voice)return;
    for(const osc of sources){osc.start(t);osc.stop(end+.01);}
  }
  private musicDrum(t:number,from:number,to:number,duration:number,volume:number):void{
    const c=this.context!,osc=c.createOscillator(),gain=c.createGain();osc.type='sine';osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+duration);
    gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(this.music!);
    const voice=this.register([osc],[gain],true,0,t+duration);if(!voice)return;osc.start(t);osc.stop(t+duration+.01);
  }
  private musicNoise(t:number,duration:number,frequency:number,volume:number):void{
    const c=this.context!,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noise!;filter.type='highpass';filter.frequency.value=frequency;
    gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter);filter.connect(gain);gain.connect(this.music!);
    const voice=this.register([source],[filter,gain],true,0,t+duration);if(!voice)return;source.start(t,this.offset());source.stop(t+duration+.01);
  }

  private sound(parts:Sound[],frequency:number,pan:number,volume:number,priority:number,interior:boolean):void{
    if(!parts.length)return;const c=this.context!,t=c.currentTime;
    const filter=c.createBiquadFilter(),panner=c.createStereoPanner(),output=c.createGain();filter.type='lowpass';filter.frequency.value=frequency;panner.pan.value=pan;output.gain.value=volume;
    filter.connect(panner);panner.connect(output);output.connect(this.sfx!);if(interior)output.connect(this.room!);
    const sources:AudioScheduledSourceNode[]=[],nodes:AudioNode[]=[filter,panner,output];let end=t;
    for(const part of parts){
      const start=t+(part.delay??0),finish=start+part.duration,envelope=c.createGain();end=Math.max(end,finish);
      envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,part.gain),start+.003);envelope.gain.exponentialRampToValueAtTime(.0001,finish);envelope.connect(filter);nodes.push(envelope);
      if(part.noise){const source=c.createBufferSource();source.buffer=this.noise!;source.connect(envelope);sources.push(source);}
      else{const source=c.createOscillator();source.type=part.wave??'sine';source.frequency.setValueAtTime(part.from,start);source.frequency.exponentialRampToValueAtTime(part.to??part.from,finish);source.connect(envelope);sources.push(source);}
    }
    const voice=this.register(sources,nodes,false,priority,end);if(!voice)return;
    parts.forEach((part,i)=>{const source=sources[i]!,start=t+(part.delay??0);if(part.noise)(source as AudioBufferSourceNode).start(start,this.offset());else(source as OscillatorNode).start(start);source.stop(start+part.duration+.01);});
  }
  private offset():number{this.noiseOffset=(this.noiseOffset+.073)% .24;return this.noiseOffset;}

  private register(sources:AudioScheduledSourceNode[],nodes:AudioNode[],music:boolean,priority:number,end:number):Voice|undefined{
    const group=[...this.voices].filter(v=>v.music===music),limit=music?40:24;
    if(group.length>=limit||this.voices.size>=64){
      const candidates=group.length>=limit?group:[...this.voices];candidates.sort((a,b)=>a.priority-b.priority||a.end-b.end);const weakest=candidates[0];
      if(weakest&&weakest.priority>priority){for(const source of sources)source.disconnect();for(const node of nodes)node.disconnect();return undefined;}
      if(weakest)this.release(weakest);
    }
    const voice:Voice={sources,nodes,music,priority,end,closed:false};this.voices.add(voice);let remaining=sources.length;
    for(const source of sources)source.onended=()=>{remaining--;if(remaining===0)this.release(voice,false);};return voice;
  }
  private release(voice:Voice,stop=true):void{
    if(voice.closed)return;voice.closed=true;
    for(const source of voice.sources){if(stop)try{source.stop();}catch{/* A scheduled voice may have already ended. */}source.disconnect();source.onended=null;}
    for(const node of voice.nodes)node.disconnect();this.voices.delete(voice);
  }
}
