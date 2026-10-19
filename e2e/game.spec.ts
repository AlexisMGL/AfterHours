import { test, expect, type Page } from '@playwright/test';
import type { MatchState } from '../src/core/types';
interface DebugApi { state(): MatchState; screen(): string; paused(): boolean }
const state = (page:Page) => page.evaluate(() => {
  const s=(window as unknown as {__BLAST__:DebugApi}).__BLAST__.state();
  return {time:s.time,seed:s.seed,arena:{id:s.arena.id},players:s.players,bombs:s.bombs,flames:s.flames};
});
async function start(page:Page,map?:string,opponents=1) {
  await page.goto('/blast-arena');
  await page.getByRole('button',{name:/LET.S PLAY/}).click();
  if(map) await page.getByRole('button',{name:`Select ${map}`,exact:true}).click();
  await page.locator(`[data-action="opponents"][data-value="${opponents}"]`).click();
  await page.getByRole('button',{name:'ENTER ARENA'}).click();
  await expect.poll(async()=>(await state(page)).time).toBeGreaterThan(.02);
}

test('main menu, help, soundtrack preview and persistent settings work',async({page})=>{
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/blast-arena');
  await expect(page).toHaveTitle(/BLAST ARENA/);
  await expect(page.locator('h1')).toContainText('BLAST');
  await expect(page.locator('#arena canvas')).toBeVisible();
  await expect(page.locator('.map-card')).toHaveCount(5);
  await page.getByRole('button',{name:'HOW TO PLAY'}).click();
  await expect(page.getByRole('dialog')).toContainText('Power Kick');
  await expect(page.getByRole('dialog')).toContainText('Portal Charge');
  await page.getByRole('button',{name:'GOT IT'}).click();
  await page.getByRole('button',{name:'PREVIEW NEON GALLERIA'}).click();
  await expect(page.getByRole('status')).toContainText('Now playing');
  await page.getByRole('button',{name:'Settings',exact:true}).first().click();
  await page.locator('#music-volume').fill('0.2');
  await page.getByLabel('Mute sound effects').check();
  await page.getByLabel('Reduce motion, particles & camera shake').check();
  await page.getByRole('button',{name:'ALL SET'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Settings',exact:true}).first().click();
  await expect(page.locator('#music-volume')).toHaveValue('0.2');
  await expect(page.getByLabel('Mute sound effects')).toBeChecked();
  await expect(page.getByLabel('Reduce motion, particles & camera shake')).toBeChecked();
  expect(errors).toEqual([]);
});

test('keyboard movement, explosions, AI actions, defeat and rematch work',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await start(page);
  const initial=(await state(page)).players[0];
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(()=>(window as unknown as {__BLAST__:DebugApi}).__BLAST__.state().players[0].x>=2);
  await page.keyboard.up('ArrowRight');
  expect((await state(page)).players[0].x).toBeGreaterThan(initial.x+.5);
  await page.keyboard.press('Space');
  await expect.poll(async()=>(await state(page)).bombs.some(b=>b.owner===0)).toBe(true);
  // Deliberately stay in the blast to exercise the real defeat/results flow.
  // Safe initial escapes are verified on every map in the deterministic suite.
  await page.waitForFunction(()=>(window as unknown as {__BLAST__:DebugApi}).__BLAST__.state().flames.some(f=>f.owner===0));
  await expect.poll(async()=>(await state(page)).bombs.some(b=>b.owner===0)).toBe(false);
  expect((await state(page)).players[0].stats.bombs).toBe(1);
  expect((await state(page)).players[0].alive).toBe(false);
  expect((await state(page)).players[0].stats.blocks).toBeGreaterThan(0);
  expect((await state(page)).players.slice(1).some(p=>p.stats.bombs>0)).toBe(true);
  await expect(page.getByRole('dialog',{name:'Round results'})).toBeVisible();
  await page.getByRole('button',{name:'RUN IT BACK'}).click();
  expect((await state(page)).time).toBe(0);
  expect((await state(page)).players[0].alive).toBe(true);
  expect(errors).toEqual([]);
});

test('pause freezes simulation, resume and restart reset the match',async({page})=>{
  await start(page);
  await page.keyboard.press('Space');
  await expect.poll(async()=>(await state(page)).players[0].stats.bombs).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-label','Game paused');
  const stopped=(await state(page)).time;
  await page.waitForTimeout(300);
  expect((await state(page)).time).toBe(stopped);
  await page.getByRole('button',{name:'RESUME'}).click();
  await expect.poll(async()=>(await state(page)).time).toBeGreaterThan(stopped);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'RESTART ROUND'}).click();
  const fresh=await state(page);
  expect(fresh.time).toBe(0);expect(fresh.bombs).toHaveLength(0);
  expect(fresh.players.every(p=>p.alive&&p.stats.bombs===0)).toBe(true);
  await page.getByRole('button',{name:'Pause game'}).click();
  await page.getByRole('button',{name:'QUIT TO ARCADE'}).click();
  await expect(page.locator('h1')).toBeVisible();
});

for(const [map,id] of [['NEON GALLERIA','mall'],['DEPARTURE ZERO','airport'],['JADE TEMPLE','jungle'],['STEAMWORKS','factory'],['STORM DECK','boat']]) {
  test(`${map} launches with three individually configured rivals`,async({page})=>{
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/blast-arena');await page.getByRole('button',{name:/LET.S PLAY/}).click();
    await page.getByRole('button',{name:`Select ${map}`,exact:true}).click();
    await page.locator('#global-difficulty').selectOption('hard');
    await page.locator('[data-ai="2"]').selectOption('expert');
    await page.locator('#seed').fill('914');await page.locator('#seed').press('Tab');
    await page.getByRole('button',{name:'ENTER ARENA'}).click();
    await expect.poll(async()=>(await state(page)).time).toBeGreaterThan(.02);
    const s=await state(page);expect(s.arena.id).toBe(id);expect(s.seed).toBe(914);expect(s.players).toHaveLength(4);
    await expect(page.locator('#players')).toContainText('EXPERT AI');
    expect(await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.width)).toBe(720);
    expect(errors).toEqual([]);
  });
}

test('mobile controls remain visible and the arena fits the viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await start(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole('button',{name:'Move right',exact:true})).toBeVisible();
  const before=(await state(page)).players[0].x;
  const move=page.getByRole('button',{name:'Move right',exact:true});
  await move.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',bubbles:true});
  await page.waitForTimeout(250);
  await move.dispatchEvent('pointerup',{pointerId:1,pointerType:'touch',bubbles:true});
  expect((await state(page)).players[0].x).toBeGreaterThan(before);
  await page.getByRole('button',{name:'Place bomb',exact:true}).click();
  await expect.poll(async()=>(await state(page)).players[0].stats.bombs).toBe(1);
});

