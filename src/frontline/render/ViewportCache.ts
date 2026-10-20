import Phaser from 'phaser';
import type { Rect } from '../core/types';

/** One fixed-size, high-resolution viewport texture per static layer, never a world-sized atlas. */
export class ViewportCache {
  private layers=new Map<string,Phaser.GameObjects.RenderTexture>();
  constructor(private scene:Phaser.Scene){}

  capture(key:string,source:Phaser.GameObjects.Graphics,bounds:Rect,resolution:number,factorX=1,factorY=factorX):void{
    const width=Math.ceil(bounds.w*resolution),height=Math.ceil(bounds.h*resolution);
    let layer=this.layers.get(key);
    if(!layer){layer=this.scene.add.renderTexture(bounds.x,bounds.y,width,height).setOrigin(0);this.layers.set(key,layer);}
    if(layer.width!==width||layer.height!==height)layer.resize(width,height);
    layer.setPosition(bounds.x,bounds.y).setDisplaySize(bounds.w,bounds.h).setScrollFactor(factorX,factorY).setDepth(source.depth);
    layer.camera.setOrigin(0,0).setZoom(resolution).setScroll(bounds.x,bounds.y);
    const previousX=source.scrollFactorX,previousY=source.scrollFactorY;
    source.setScrollFactor(1).setVisible(true);
    layer.clear().draw(source);
    source.setScrollFactor(previousX,previousY).setVisible(false);
  }

  get textureCount():number{return this.layers.size;}
  destroy():void{for(const layer of this.layers.values())layer.destroy();this.layers.clear();}
}
