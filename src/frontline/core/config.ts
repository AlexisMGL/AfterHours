import type {ClassId,WeaponDefinition,WeaponId} from './types';
export const PHYSICS={gravity:1500,jumpSpeed:650,acceleration:2300,friction:2000,radius:14,height:54,coyote:.11,jumpBuffer:.13,climbSpeed:195,respawnDelay:2.8,spawnProtection:2} as const;
export const WEAPONS:Record<WeaponId,WeaponDefinition>={
 kestrel:{id:'kestrel',name:'Kestrel .45',category:'pistol',damage:25,interval:.26,magazine:12,reserve:72,reload:1.25,spread:.025,recoil:.055,speed:0,range:850,pellets:1,explosion:0,rarity:'common',moveMultiplier:1},
 hush:{id:'hush',name:'Hush-9',category:'pistol',damage:18,interval:.15,magazine:18,reserve:108,reload:1.1,spread:.035,recoil:.035,speed:0,range:720,pellets:1,explosion:0,rarity:'uncommon',moveMultiplier:1},
 wisp:{id:'wisp',name:'Wisp SMG',category:'smg',damage:14,interval:.082,magazine:32,reserve:192,reload:1.6,spread:.065,recoil:.055,speed:0,range:680,pellets:1,explosion:0,rarity:'common',moveMultiplier:1},
 cyclone:{id:'cyclone',name:'Cyclone PDW',category:'smg',damage:16,interval:.075,magazine:36,reserve:180,reload:1.9,spread:.05,recoil:.065,speed:0,range:740,pellets:1,explosion:0,rarity:'rare',moveMultiplier:.98},
 vanguard:{id:'vanguard',name:'Vanguard AR',category:'rifle',damage:22,interval:.115,magazine:30,reserve:180,reload:1.8,spread:.035,recoil:.06,speed:0,range:1050,pellets:1,explosion:0,rarity:'common',moveMultiplier:.97},
 ranger:{id:'ranger',name:'Ranger Mk II',category:'rifle',damage:27,interval:.14,magazine:24,reserve:144,reload:1.9,spread:.025,recoil:.07,speed:0,range:1150,pellets:1,explosion:0,rarity:'rare',moveMultiplier:.96},
 breach:{id:'breach',name:'Breach-8',category:'shotgun',damage:12,interval:.7,magazine:8,reserve:48,reload:2.2,spread:.16,recoil:.15,speed:0,range:470,pellets:8,explosion:0,rarity:'uncommon',moveMultiplier:.95},
 bulwark:{id:'bulwark',name:'Bulwark LMG',category:'lmg',damage:23,interval:.1,magazine:60,reserve:240,reload:3.2,spread:.055,recoil:.08,speed:0,range:1100,pellets:1,explosion:0,rarity:'uncommon',moveMultiplier:.85},
 longbow:{id:'longbow',name:'Longbow SR',category:'sniper',damage:88,interval:1.15,magazine:5,reserve:30,reload:2.7,spread:.008,recoil:.22,speed:0,range:1650,pellets:1,explosion:0,rarity:'rare',moveMultiplier:.93},
 meridian:{id:'meridian',name:'Meridian DMR',category:'dmr',damage:46,interval:.4,magazine:14,reserve:84,reload:2.05,spread:.018,recoil:.105,speed:0,range:1400,pellets:1,explosion:0,rarity:'rare',moveMultiplier:.95},
 thumper:{id:'thumper',name:'Thumper GL',category:'launcher',damage:65,interval:1.1,magazine:4,reserve:16,reload:2.8,spread:.035,recoil:.16,speed:670,range:1400,pellets:1,explosion:125,rarity:'epic',moveMultiplier:.9},
 comet:{id:'comet',name:'Comet RPG',category:'rocket',damage:105,interval:1.5,magazine:1,reserve:5,reload:2.8,spread:.016,recoil:.25,speed:830,range:1800,pellets:1,explosion:155,rarity:'epic',moveMultiplier:.86},
};
export interface ClassDefinition {id:ClassId;name:string;role:string;description:string;health:number;speed:number;primary:WeaponId;secondary:WeaponId;ability:string;duration:number;cooldown:number;color:string}
export const CLASSES:Record<ClassId,ClassDefinition>={
 assault:{id:'assault',name:'Assault',role:'THE SPEARHEAD',description:'Fast pushes. Controlled bursts. Six seconds of adrenaline: +25% speed, faster reloads, steadier recoil.',health:125,speed:260,primary:'vanguard',secondary:'kestrel',ability:'Adrenaline Rush',duration:6,cooldown:25,color:'#f7bb64'},
 support:{id:'support',name:'Support',role:'THE LIFELINE',description:'Deploy a destructible medic station: ten seconds of healing for nearby allies, with a finite shared healing supply.',health:115,speed:245,primary:'wisp',secondary:'hush',ability:'Medic Station',duration:10,cooldown:30,color:'#83d6a6'},
 defense:{id:'defense',name:'Defense',role:'THE ANCHOR',description:'A durable frontal shield stops 90% of bullets and 35% of blast damage. Slower while shielding. Vulnerable from behind.',health:185,speed:215,primary:'bulwark',secondary:'kestrel',ability:'Tactical Shield',duration:8,cooldown:26,color:'#7cb9ed'},
 sniper:{id:'sniper',name:'Sniper',role:'THE OVERWATCH',description:'Five seconds of Focus: reduced recoil and spread, with clearer enemy outlines. Control the long sightlines.',health:90,speed:250,primary:'longbow',secondary:'hush',ability:'Focus Mode',duration:5,cooldown:25,color:'#c3a7ed'},
};
