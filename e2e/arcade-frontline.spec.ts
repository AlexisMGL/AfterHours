import {test,expect,type Page} from '@playwright/test';
import type {MatchState,Rect} from '../src/frontline/core/types';
interface Api{state():MatchState;camera():Rect;screen():string;paused():boolean}
function expectSameView(view:Rect,camera:Rect){for(const key of ['x','y','w','h'] as const)expect(view[key]).toBeCloseTo(camera[key],8);}
const snapshot=(page:Page)=>page.evaluate(()=>{const api=(window as unknown as {__FRONTLINE__:Api}).__FRONTLINE__,s=api.state();return {time:s.time,tick:s.tick,config:s.config,phase:s.phase,soldiers:s.soldiers,stationCount:s.stations.length,flagCount:s.flags.length,projectileCount:s.projectiles.length,camera:api.camera()};});
async function setup(page:Page){await page.goto('/frontline-heroes');await page.getByRole('button',{name:'DEPLOY YOUR SQUAD'}).click();}
async function deploy(page:Page){await page.getByRole('button',{name:'START MISSION'}).click();await page.locator('#fh-canvas canvas').waitFor();await expect.poll(async()=>(await snapshot(page)).time).toBeGreaterThan(.05);}

test('portal lazily loads either game, navigation and direct refresh preserve both',async({page})=>{
 const errors:string[]=[],requests:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto('/');await expect(page.locator('h1')).toContainText('free time');
 expect(await page.locator('canvas').count()).toBe(0);expect(requests.some(url=>/phaser|ArenaRenderer|ShooterRenderer/.test(url))).toBe(false);
 await page.getByRole('link',{name:'Play Blast Arena',exact:true}).last().click();await expect(page.locator('#arena canvas')).toBeVisible();await expect(page).toHaveURL(/\/blast-arena$/);
 expect(await page.evaluate(()=>('__BLAST__' in window)&&!('__FRONTLINE__' in window))).toBe(true);
 await page.getByRole('link',{name:'Back to arcade',exact:true}).click();await expect(page.locator('h1')).toContainText('free time');
 await page.getByRole('link',{name:'Play Frontline Heroes',exact:true}).last().click();await expect(page.locator('h1')).toContainText('GROUND');
 expect(await page.evaluate(()=>!('__BLAST__' in window))).toBe(true);await page.reload();await expect(page.locator('h1')).toContainText('GROUND');
 await page.getByRole('link',{name:'Back to arcade',exact:true}).click();await expect(page.locator('h1')).toContainText('free time');expect(errors).toEqual([]);
});

test('human movement, jump, mouse aim, fire, reload, weapon switch, ability, grenade and pause/restart',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await expect(page.locator('#fh-difficulty')).toHaveValue('recruit');await page.locator('#fh-bots').fill('3');await page.locator('#fh-bots').dispatchEvent('change');await deploy(page);
 const before=await snapshot(page);expect(before.soldiers).toHaveLength(4);expect(before.camera.w).toBe(960);
 await page.keyboard.down('KeyD');await page.waitForFunction(()=>(window as unknown as {__FRONTLINE__:Api}).__FRONTLINE__.state().soldiers[0].x>180);await page.keyboard.up('KeyD');
 await page.keyboard.press('Space');await page.waitForFunction(()=>(window as unknown as {__FRONTLINE__:Api}).__FRONTLINE__.state().soldiers[0].y<1100);
 const canvas=await page.locator('#fh-canvas').boundingBox();expect(canvas).not.toBeNull();await page.mouse.move(canvas!.x+canvas!.width*.7,canvas!.y+canvas!.height*.45);await page.mouse.down();await page.waitForTimeout(250);await page.mouse.up();
 await expect.poll(async()=>(await snapshot(page)).soldiers[0].weapons[0].ammo).toBeLessThan(30);expect((await snapshot(page)).soldiers[0].stats.shots).toBeGreaterThan(0);
 await page.keyboard.press('KeyR');await page.waitForFunction(()=>{const s=(window as unknown as {__FRONTLINE__:Api}).__FRONTLINE__.state();return s.soldiers[0].weapons[0].reloadUntil>s.time;});
 await expect.poll(async()=>(await snapshot(page)).soldiers[0].weapons[0].ammo).toBe(30);
 await page.keyboard.press('Digit2');await expect.poll(async()=>(await snapshot(page)).soldiers[0].activeWeapon).toBe(1);
 await page.keyboard.press('KeyQ');await expect.poll(async()=>(await snapshot(page)).soldiers[0].abilityReadyAt).toBeGreaterThan(0);
 const grenades=(await snapshot(page)).soldiers[0].grenades;await page.keyboard.press('KeyF');await expect.poll(async()=>(await snapshot(page)).soldiers[0].grenades).toBe(grenades-1);
 await page.keyboard.down('Tab');await expect(page.locator('#fh-scoreboard')).toBeVisible();await expect(page.locator('#fh-scoreboard tbody tr')).toHaveCount(4);await page.keyboard.up('Tab');await expect(page.locator('#fh-scoreboard')).toBeHidden();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Mission paused'})).toBeVisible();const paused=(await snapshot(page)).time;await page.waitForTimeout(250);expect((await snapshot(page)).time).toBe(paused);
 await page.getByRole('button',{name:'RESTART MISSION'}).click();expect((await snapshot(page)).soldiers[0].stats.shots).toBe(0);expect((await snapshot(page)).soldiers[0].weapons[0].ammo).toBe(30);expect(errors).toEqual([]);
});

test('the live camera bounds combat and offscreen bots cannot shoot into the player view',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await setup(page);await page.locator('#fh-bots').fill('3');await page.locator('#fh-bots').dispatchEvent('change');await deploy(page);
 const inspect=()=>page.evaluate(()=>{
  const api=(window as unknown as {__FRONTLINE__:Api}).__FRONTLINE__,state=api.state(),view=state.combatView,camera=api.camera();
  if(!view)throw new Error('The live match has no combat viewport');
  const inside=(point:{x:number;y:number})=>point.x>=view.x-1e-6&&point.x<=view.x+view.w+1e-6&&point.y>=view.y-1e-6&&point.y<=view.y+view.h+1e-6;
  return{view,camera,player:state.soldiers[0],tracers:state.tracers.length,
   escaped:state.projectiles.some(point=>!inside(point))||state.tracers.some(trace=>!inside(trace.from)||!inside(trace.to)),
   offscreenEnemyShots:state.soldiers.filter(s=>s.team===1&&!inside({x:s.x,y:s.y-34})).reduce((sum,s)=>sum+s.stats.shots,0)};
 });
 const first=await inspect();expectSameView(first.view,first.camera);expect(first.offscreenEnemyShots).toBe(0);
 const box=await page.locator('#fh-canvas canvas').boundingBox();expect(box).not.toBeNull();
 await page.mouse.move(box!.x+1,box!.y+(first.player.y-34-first.view.y)/first.view.h*box!.height);await page.mouse.down();
 let observedTracers=0;
 for(let sample=0;sample<12;sample++){
  await page.waitForTimeout(90);const current=await inspect();observedTracers+=current.tracers;
  expectSameView(current.view,current.camera);expect(current.escaped).toBe(false);expect(current.offscreenEnemyShots).toBe(0);
 }
 await page.mouse.up();expect(observedTracers).toBeGreaterThan(0);
 await page.keyboard.press('Space');await expect.poll(async()=>(await inspect()).player.y).toBeLessThan(1090);
 const airborne=await inspect();expectSameView(airborne.view,airborne.camera);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'RESTART MISSION'}).click();
 const restarted=await inspect();expect(restarted.camera.x).toBe(0);expectSameView(restarted.view,restarted.camera);expect(restarted.player.stats.shots).toBe(0);
 expect(errors).toEqual([]);
});

for(const className of ['Assault','Support','Defense','Sniper'])test(`${className} deploys with working class ability`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await page.getByRole('button',{name:`Choose ${className}`,exact:true}).click();await deploy(page);await page.keyboard.press('KeyQ');
 await expect.poll(async()=>(await snapshot(page)).soldiers[0].abilityReadyAt).toBeGreaterThan(0);const s=await snapshot(page),p=s.soldiers[0];expect(p.classId).toBe(className.toLowerCase());
 if(className==='Support')expect(s.stationCount).toBeGreaterThan(0);else expect(p.abilityUntil).toBeGreaterThan(s.time);if(className==='Defense')expect(p.shieldHealth).toBeGreaterThan(0);expect(errors).toEqual([]);
});

const maps=[['SKYBREACH','aircraft'],['CINDERLINE','factory'],['VERDANT FRONT','forest'],['BLACKOUT DISTRICT','city'],['IRON TIDE','harbor'],['TEMPEST','ship']] as const;
for(const [index,[name,id]]of maps.entries())test(`${name} launches a multi-level ${['deathmatch','elimination','flags'][index%3]} mission with 15 bots`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await page.getByRole('button',{name:`Choose ${name}`,exact:true}).click();await page.locator(`[data-mode="${['deathmatch','elimination','flags'][index%3]}"]`).click();await page.locator('#fh-bots').fill('15');await page.locator('#fh-bots').dispatchEvent('change');await page.locator('#fh-difficulty').selectOption('elite');await page.locator('#fh-seed').fill('0');await page.locator('#fh-seed').press('Tab');await deploy(page);
 const s=await snapshot(page);expect(s.config.mapId).toBe(id);expect(s.config.seed).toBe(0);expect(s.soldiers).toHaveLength(16);expect(s.soldiers.filter(p=>p.team===0)).toHaveLength(8);expect(s.soldiers.filter(p=>p.team===1)).toHaveLength(8);expect(s.flagCount).toBe(3);expect(s.camera.w).toBe(960);expect(s.camera.h).toBe(540);expect(s.camera.x).toBeGreaterThanOrEqual(0);await expect(page.locator('#fh-minimap')).toBeVisible();
 await page.waitForTimeout(600);expect((await snapshot(page)).time).toBeGreaterThan(s.time);expect(errors).toEqual([]);
});

test('settings, independent volume controls and key bindings persist',async({page})=>{
 await page.goto('/frontline-heroes');await page.getByRole('button',{name:'Shooter settings',exact:true}).click();await page.getByLabel('music volume',{exact:true}).fill('0.1');await page.getByLabel('sfx volume',{exact:true}).fill('0.2');await page.getByLabel('Camera shake',{exact:true}).uncheck();await page.locator('[data-binding="left"]').click();await page.keyboard.press('KeyZ');await page.getByRole('button',{name:'ALL SET'}).click();await page.reload();await page.getByRole('button',{name:'Shooter settings',exact:true}).click();await expect(page.getByLabel('music volume',{exact:true})).toHaveValue('0.1');await expect(page.getByLabel('sfx volume',{exact:true})).toHaveValue('0.2');await expect(page.getByLabel('Camera shake',{exact:true})).not.toBeChecked();await expect(page.locator('[data-binding="left"]')).toHaveText('Z');
});

test('portal and shooter menus fit a mobile viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('link',{name:'Play Frontline Heroes',exact:true}).last().click();await expect(page.locator('h1')).toContainText('GROUND');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'DEPLOY YOUR SQUAD'}).click();await expect(page.getByRole('button',{name:'START MISSION'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
