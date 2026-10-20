import type Phaser from 'phaser';

export interface GraphicsBackend { canvas:boolean;name:string }
let selectedBackend:GraphicsBackend|undefined;

/** Software WebGL can be much slower than the browser's native 2D renderer. */
export function chooseGraphicsBackend():GraphicsBackend{
  if(selectedBackend)return selectedBackend;
  const probe=document.createElement('canvas');
  try{
    const gl=probe.getContext('webgl',{powerPreference:'high-performance'});
    if(!gl)return selectedBackend={canvas:true,name:'Canvas 2D'};
    const info=gl.getExtension('WEBGL_debug_renderer_info');
    const name=String(gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return selectedBackend={canvas:/SwiftShader|llvmpipe|softpipe|software|Microsoft Basic Render/i.test(name),name};
  }catch{return selectedBackend={canvas:true,name:'Canvas 2D'};}
}

/** Phaser's Canvas Graphics backend does not implement its WebGL gradient opcode. */
export function canvasCompatibleGraphics(graphics:Phaser.GameObjects.Graphics):Phaser.GameObjects.Graphics{
  graphics.fillGradientStyle=(tl:number,tr:number,bl:number,br:number,atl=1,atr=atl,abl=atl,abr=atl)=>{
    const channel=(shift:number):number=>Math.round(((tl>>shift&255)+(tr>>shift&255)+(bl>>shift&255)+(br>>shift&255))/4);
    return graphics.fillStyle(channel(16)<<16|channel(8)<<8|channel(0),(atl+atr+abl+abr)/4);
  };
  return graphics;
}
