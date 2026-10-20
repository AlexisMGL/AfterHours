/** Original sampled synthesis: bowed ensembles, rounded brass and concert drums.
 * Buffers are generated locally once per pitch family; no asset downloads. */
export type OrchestralInstrument='strings'|'horns'|'flute'|'basses'|'timpani'|'cymbal';
export const ORCHESTRAL_PHRASES={
 a:[[[0,7,3.7],[4,9,1.8],[6,10,1.8]],[[0,11,5.6],[6,9,1.8]],[[0,10,3.7],[4,9,1.8],[6,7,1.8]],[[0,6,5.6],[6,4,1.6]],[[0,7,2.8],[3,9,2.8],[6,11,1.8]],[[0,12,3.7],[4,11,3.7]],[[0,10,2.8],[3,9,2.8],[6,8,1.8]],[[0,6,3.7],[4,4,3.5]]],
 b:[[[0,14,5.7],[6,13,1.8]],[[0,12,2.8],[3,11,2.8],[6,9,1.8]],[[0,10,3.7],[4,12,3.7]],[[0,11,5.6],[6,9,1.8]],[[0,14,3.7],[4,16,3.7]],[[0,15,2.8],[3,14,2.8],[6,12,1.8]],[[0,13,3.7],[4,11,1.8],[6,9,1.8]],[[0,8,3.7],[4,6,3.5]]],
} as const;

export function orchestralPCM(instrument:OrchestralInstrument,midi:number,sampleRate:number):Float32Array{
 const percussion=instrument==='timpani'||instrument==='cymbal';
 const duration=instrument==='cymbal'?3.2:percussion?2.3:1.6;
 const data=new Float32Array(Math.ceil(sampleRate*duration)),hz=440*2**((midi-69)/12);
 let seed=0x24f395b1+midi*8191,previousNoise=0,peak=0;
 const random=():number=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/0xffffffff*2-1;};
 const ensemble=instrument==='strings'?4:instrument==='horns'?3:instrument==='basses'?2:1;
 const weights=Array.from({length:18},(_,h)=>{
  const harmonic=h+1,frequency=hz*harmonic;
  if(frequency>sampleRate*.43)return 0;
  if(instrument==='strings')return 1/harmonic**1.45*(1+.35*Math.exp(-(((frequency-2200)/1000)**2)));
  if(instrument==='horns')return (harmonic===1?.8:1)/harmonic**1.55*(1+1.25*Math.exp(-(((frequency-680)/340)**2)));
  if(instrument==='basses')return 1/harmonic**1.8;
  return [1,.18,.085,.018][h]??0;
 });
 const phases=Array.from({length:ensemble},(_,i)=>i*1.871),detune=[-.0051,.0038,-.0018,.0062];
 for(let i=0;i<data.length;i++){
  const t=i/sampleRate,n=random();let value=0;
  if(instrument==='timpani'){
   const bend=1+.025*Math.exp(-t*24);
   for(const [ratio,gain,decay] of [[1,1,1.7],[1.505,.48,2.2],[1.99,.32,3.1],[2.455,.18,4.3],[2.94,.13,5.8]])value+=Math.sin(2*Math.PI*hz*ratio!*t*bend)*gain!*Math.exp(-t*decay!);
   value+=n*.16*Math.exp(-t*90);
  }else if(instrument==='cymbal'){
   const high=n-previousNoise*.86;previousNoise=n;
   value=(high*.56+Math.sin(t*2*Math.PI*2933)*Math.sin(t*2*Math.PI*1789)*.11+Math.sin(t*2*Math.PI*4217)*.06)*(1-Math.exp(-t*100))*Math.exp(-t*1.8);
  }else{
   for(let v=0;v<ensemble;v++){
    const vibrato=1+.0018*Math.sin(t*Math.PI*2*(4.6+v*.31)+v)*(1-Math.exp(-t*6));
    phases[v]!+=2*Math.PI*hz*(1+detune[v]!)*vibrato/sampleRate;
    const fundamental=Math.sin(phases[v]!),cosine=Math.cos(phases[v]!);let before=0,current=fundamental;
    for(let h=0;h<weights.length;h++){value+=current*weights[h]!/ensemble;const next=2*cosine*current-before;before=current;current=next;}
   }
   if(instrument==='strings')value+=n*.014;
   if(instrument==='flute'){previousNoise=previousNoise*.65+n*.35;value+=previousNoise*.035;}
  }
  data[i]=value;peak=Math.max(peak,Math.abs(value));
 }
 const normalizer=.72/Math.max(.001,peak);for(let i=0;i<data.length;i++)data[i]!*=normalizer;
 if(!percussion){
  // Crossfade the end into the sustain loop to avoid a click on long legato notes.
  const end=Math.floor(sampleRate*1.5),start=Math.floor(sampleRate*.4),fade=Math.floor(sampleRate*.065);
  for(let i=0;i<fade;i++){const blend=i/(fade-1);data[end-fade+i]=data[end-fade+i]!*(1-blend)+data[start-fade+i]!*blend;}
 }
 const attack=Math.ceil(sampleRate*.006);for(let i=0;i<attack;i++)data[i]!*=i/attack;
 return data;
}

export class OrchestraBank{
 private samples=new Map<string,AudioBuffer>();
 constructor(private readonly context:BaseAudioContext){}
 sample(instrument:OrchestralInstrument,midi:number):{buffer:AudioBuffer;rate:number}{
  const anchor=instrument==='cymbal'?60:Math.round(midi/5)*5,key=`${instrument}:${anchor}`;
  let buffer=this.samples.get(key);
  if(!buffer){const rate=22050,pcm=orchestralPCM(instrument,anchor,rate);buffer=this.context.createBuffer(1,pcm.length,rate);buffer.copyToChannel(pcm as Float32Array<ArrayBuffer>,0);this.samples.set(key,buffer);}
  return{buffer,rate:2**((midi-anchor)/12)};
 }
 hall():AudioBuffer{
  const rate=this.context.sampleRate,buffer=this.context.createBuffer(2,Math.ceil(rate*2.5),rate);let seed=0x41c65;
  for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);let smooth=0;
   for(let i=0;i<data.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;smooth=smooth*.5+((seed>>>0)/0xffffffff*2-1)*.5;const t=i/rate;data[i]=t<.025?0:smooth*Math.exp(-t*3.5)*.32;}
   for(const [delay,amplitude] of [[.031,.22],[.057,.16],[.089,.11],[.137,.075]])data[Math.floor((delay!+channel*.007)*rate)]=amplitude!;
  }return buffer;
 }
}
