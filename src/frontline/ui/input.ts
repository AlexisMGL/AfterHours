import type {Action,Controller,MatchState,Vec} from '../core/types';
import type {ShooterSettings} from './settings';
export class LocalHumanController implements Controller {
 private held=new Set<string>();private edges:Action={};private firing=false;private enabled=false;private pointer:Vec={x:0,y:0};private hasPointer=false;
 constructor(private canvas:HTMLElement,private toWorld:(x:number,y:number)=>Vec,private settings:()=>ShooterSettings){
 window.addEventListener('keydown',this.down);window.addEventListener('keyup',this.up);window.addEventListener('blur',this.reset);
 canvas.addEventListener('pointermove',this.mouse);canvas.addEventListener('pointerdown',this.press);window.addEventListener('pointerup',this.release);canvas.addEventListener('contextmenu',this.context);
 }
 private down=(event:KeyboardEvent)=>{
  if(!this.enabled||event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;
  const b=this.settings().bindings;const code=event.code;
  if(Object.values(b).includes(code)||['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Digit1','Digit2','Tab'].includes(code))event.preventDefault();
  this.held.add(code);if(event.repeat)return;
  if(code===b.jump||code===b.climb||code==='ArrowUp')this.edges.jump=true;
  if(code===b.down||code==='ArrowDown')this.edges.drop=true;
  if(code===b.reload)this.edges.reload=true;if(code===b.ability)this.edges.ability=true;if(code===b.interact)this.edges.interact=true;if(code===b.grenade)this.edges.grenade=true;
  if(code==='Digit1')this.edges.switchWeapon=0;if(code==='Digit2')this.edges.switchWeapon=1;
 };
 private up=(event:KeyboardEvent)=>{this.held.delete(event.code);};
 private mouse=(event:PointerEvent)=>{this.pointer={x:event.clientX,y:event.clientY};this.hasPointer=true;};
 private press=(event:PointerEvent)=>{if(!this.enabled||event.button!==0)return;event.preventDefault();this.mouse(event);this.firing=true;};
 private release=()=>{this.firing=false;};private context=(event:Event)=>event.preventDefault();
 setEnabled(value:boolean):void{this.enabled=value;this.reset();}
 getAction(state:MatchState,soldierId:number):Action{
  if(!this.enabled)return{};const p=state.soldiers.find(s=>s.id===soldierId);if(!p)return{};
  const b=this.settings().bindings;const left=this.held.has(b.left)||this.held.has('ArrowLeft'),right=this.held.has(b.right)||this.held.has('ArrowRight');
  const up=this.held.has(b.climb)||this.held.has('ArrowUp'),down=this.held.has(b.down)||this.held.has('ArrowDown');
  const aim=this.hasPointer?this.toWorld(this.pointer.x,this.pointer.y):{x:p.x+300,y:p.y-34};
  const action:Action={...this.edges,move:(Number(right)-Number(left)) as -1|0|1,climb:(Number(down)-Number(up)) as -1|0|1,aim:Math.atan2(aim.y-(p.y-34),aim.x-p.x),fire:this.firing};this.edges={};return action;
 }
 reset=():void=>{this.held.clear();this.edges={};this.firing=false;};
 destroy():void{window.removeEventListener('keydown',this.down);window.removeEventListener('keyup',this.up);window.removeEventListener('blur',this.reset);this.canvas.removeEventListener('pointermove',this.mouse);this.canvas.removeEventListener('pointerdown',this.press);window.removeEventListener('pointerup',this.release);this.canvas.removeEventListener('contextmenu',this.context);}
}
