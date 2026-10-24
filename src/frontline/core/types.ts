export type MapId = 'aircraft'|'factory'|'forest'|'city'|'harbor'|'ship';
export type ClassId = 'assault'|'support'|'defense'|'sniper';
export type Difficulty = 'recruit'|'regular'|'veteran'|'elite';
export type Mode = 'deathmatch'|'elimination'|'flags';
export type Team = 0|1;
export type WeaponId = 'kestrel'|'hush'|'wisp'|'cyclone'|'vanguard'|'ranger'|'breach'|'bulwark'|'longbow'|'meridian'|'thumper'|'comet';
export interface Vec { x:number;y:number }
export interface Rect extends Vec { w:number;h:number }
export interface MovingPlatform { axis:'x'|'y';from:number;to:number;period:number;phase:number }
export type PlatformSkin = 'deck'|'catwalk'|'cargo-blue'|'cargo-orange'|'cargo-green'|'supply-crate'|'engine'|'avionics'|'service-cart'|'bulkhead'|'ramp'|'fuel-drum'|'fuel-barrels'|'strapped-case'|'pallet'|'medical';
/** oneWay is a legacy gallery/style tag; every active platform is solid. */
export interface Platform extends Rect { id:number;oneWay:boolean;material:'metal'|'stone'|'wood'|'glass';active:boolean;hp?:number;conveyor?:number;moving?:MovingPlatform;previousX?:number;previousY?:number;skin?:PlatformSkin;label?:string;color?:string }
export interface ArenaSection { id:string;name:string;x:number;w:number;color:string;accent:string }
/** Playable cutaway spaces; exterior zones expose the actual sky behind the combat geometry. */
export interface AircraftZone extends Rect { id:string;name:string;kind:'interior'|'exterior' }
/** Back-wall scenery only. Foreground cover must be an actual Platform. */
export type AircraftMotif='pressure-frame'|'gallery-brace'|'ramp-vista'|'cargo-crane'|'freight-recess'|'supply-lockers'|'medical-bay'|'cable-wall'|'flight-glass'|'ceiling-duct'|'loose-cable'|'light-pool';
export interface ArenaDecoration extends Rect { kind:'panel'|'window'|'rib'|'pipe'|'sign'|'light'|'cargo-net'|'fan'|'hatch';color?:string;accent?:string;label?:string;section?:string;motif?:AircraftMotif }
export interface Ladder extends Rect { id:number }
export interface NavNode extends Vec { id:number;platformId:number }
export interface NavEdge { to:number;kind:'walk'|'jump'|'drop'|'ladder'|'lift';cost:number;ladderId?:number;viaX?:number;exitY?:number }
export interface NavGraph { nodes:NavNode[];edges:Record<number,NavEdge[]> }
export interface HazardZone extends Rect { kind:'steam'|'fire'|'wind'|'flood';damage:number;starts:number;ends:number }
export interface Palette { sky:string;far:string;near:string;ground:string;edge:string;accent:string }
export interface Arena { id:MapId;name:string;width:number;height:number;platforms:Platform[];ladders:Ladder[];spawns:(Vec & {team:Team})[];crateSpawns:Vec[];flagSpawns:Vec[];nav:NavGraph;hazards:HazardZone[];palette:Palette;sections?:ArenaSection[];aircraftZones?:AircraftZone[];decorations?:ArenaDecoration[] }
export interface WeaponDefinition { id:WeaponId;name:string;category:'pistol'|'smg'|'rifle'|'shotgun'|'lmg'|'sniper'|'dmr'|'launcher'|'rocket';damage:number;interval:number;magazine:number;reserve:number;reload:number;spread:number;recoil:number;speed:number;range:number;pellets:number;explosion:number;rarity:'common'|'uncommon'|'rare'|'epic';moveMultiplier:number }
export interface WeaponSlot { id:WeaponId;ammo:number;reserve:number;reloadUntil:number;readyAt:number }
export interface SoldierStats { kills:number;deaths:number;shots:number;hits:number;damage:number;healing:number;objective:number;score:number }
export interface Soldier extends Vec { id:number;name:string;team:Team;classId:ClassId;human:boolean;difficulty:Difficulty;vx:number;vy:number;aim:number;grounded:boolean;platformId:number|null;climbing:boolean;coyoteUntil:number;jumpBufferUntil:number;dropUntil:number;health:number;maxHealth:number;alive:boolean;respawnAt:number;protectedUntil:number;weapons:[WeaponSlot,WeaponSlot];activeWeapon:0|1;grenades:number;abilityReadyAt:number;abilityUntil:number;shieldHealth:number;lastDamageAt:number;lastShotAt:number;recoil:number;hurtUntil:number;deathAt:number;stats:SoldierStats }
export interface Projectile extends Vec { id:number;owner:number;team:Team;vx:number;vy:number;kind:'bullet'|'grenade'|'rocket';damage:number;radius:number;expires:number;gravity:number;weapon:WeaponId }
export interface Tracer { id:number;owner:number;from:Vec;to:Vec;until:number;weapon:WeaponId;hit:boolean }
export interface Loot extends Vec { id:number;ammo:number;weapon?:WeaponId;until:number }
export interface WeaponCrate extends Vec { id:number;weapon:WeaponId;readyAt:number }
export interface MedicStation extends Vec { id:number;owner:number;team:Team;health:number;capacity:number;until:number }
export interface Flag extends Vec { id:number;label:string;owner:Team|null;capturing:Team|null;progress:number;contested:boolean }
export type EventType = 'shot'|'impact'|'jump'|'land'|'reload'|'dry'|'damage'|'death'|'heal'|'ability'|'crate'|'capture'|'explosion'|'warning'|'round'|'victory'|'footstep';
export interface GameEvent extends Vec { type:EventType;soldierId?:number;targetId?:number;weapon?:WeaponId;value?:number;material?:string }
export interface EnvironmentInfo { name:string;description:string;warningUntil:number;activeUntil:number }
export interface MatchConfig { mapId:MapId;mode:Mode;botCount:number;difficulty:Difficulty;humanClass:ClassId;seed:number;scoreLimit:number;rounds:3|5;timeLimit:number;eventFrequency:'normal'|'reduced';individualDifficulties?:Difficulty[];human?:boolean }
export interface MatchState { config:MatchConfig;tick:number;time:number;arena:Arena;combatView?:Rect;soldiers:Soldier[];projectiles:Projectile[];tracers:Tracer[];loot:Loot[];crates:WeaponCrate[];stations:MedicStation[];flags:Flag[];scores:[number,number];round:number;roundWins:[number,number];roundUntil:number;roundStartTime:number;phase:'playing'|'round-over'|'finished';winnerTeam:Team|null;events:GameEvent[];eventCycle:number;environment:EnvironmentInfo;weather:{rain:number;fog:number;wind:number;lighting:number;floodY:number} }
export interface Action { move?:-1|0|1;climb?:-1|0|1;jump?:boolean;drop?:boolean;aim?:number;fire?:boolean;reload?:boolean;ability?:boolean;interact?:boolean;switchWeapon?:0|1;grenade?:boolean }
export interface Controller { getAction(state:MatchState,soldierId:number):Action;reset():void }
export interface FutureRemoteController extends Controller { submit(tick:number,action:Action):void }
export const FIXED_DT=1/60;
export const clamp=(v:number,min:number,max:number):number=>Math.max(min,Math.min(max,v));
export const distance=(a:Vec,b:Vec):number=>Math.hypot(a.x-b.x,a.y-b.y);
