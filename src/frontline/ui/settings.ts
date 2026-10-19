export type Binding = 'left'|'right'|'jump'|'down'|'climb'|'reload'|'ability'|'interact'|'grenade';
export interface ShooterSettings {master:number;music:number;sfx:number;quality:'low'|'medium'|'high';particles:boolean;shake:boolean;reducedMotion:boolean;bindings:Record<Binding,string>}
export const DEFAULT_BINDINGS:Record<Binding,string>={left:'KeyA',right:'KeyD',jump:'Space',down:'KeyS',climb:'KeyW',reload:'KeyR',ability:'KeyQ',interact:'KeyE',grenade:'KeyF'};
export function loadSettings():ShooterSettings {
 const defaults:ShooterSettings={master:.8,music:.28,sfx:.7,quality:'high',particles:true,shake:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,bindings:{...DEFAULT_BINDINGS}};
 try{const saved=JSON.parse(localStorage.getItem('frontline-settings')??'{}') as Partial<ShooterSettings>;
 for(const key of ['master','music','sfx'] as const)if(typeof saved[key]==='number'&&Number.isFinite(saved[key]))defaults[key]=Math.max(0,Math.min(1,saved[key]!));
 for(const key of ['particles','shake','reducedMotion'] as const)if(typeof saved[key]==='boolean')defaults[key]=saved[key]!;
 if(saved.quality&&['low','medium','high'].includes(saved.quality))defaults.quality=saved.quality;
 if(saved.bindings&&typeof saved.bindings==='object')for(const key of Object.keys(DEFAULT_BINDINGS) as Binding[])if(typeof saved.bindings[key]==='string'&&/^(Key[A-Z]|Digit[0-9]|Space|Arrow(Left|Right|Up|Down))$/.test(saved.bindings[key]))defaults.bindings[key]=saved.bindings[key];
 }catch{/* Browser preferences are optional. */}return defaults;
}
export function saveSettings(settings:ShooterSettings):void{try{localStorage.setItem('frontline-settings',JSON.stringify(settings));}catch{/* Keep playing when storage is disabled. */}}
export function keyLabel(code:string):string{return code.replace('Key','').replace('Digit','').replace('Arrow','');}
