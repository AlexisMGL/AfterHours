import { expect, test, type Page } from '@playwright/test';
import { solvePuzzle, type Level, type Move, type PuzzleState } from '../src/traffic/core';
import { LEVELS, WORLDS } from '../src/traffic/levels';
import { TRACKS } from '../src/traffic/audio';

interface SavedProgress {
  lastLevel: number;
  best: Record<number, number>;
  runs: Record<number, Move[]>;
  volume: number;
  muted: boolean;
}
interface TrafficApi {
  state(): PuzzleState;
  level(): Level;
  progress(): SavedProgress;
}
const snapshot = (page: Page) => page.evaluate(() => {
  const api = (window as unknown as { __TRAFFIC__: TrafficApi }).__TRAFFIC__;
  return { state: api.state(), level: api.level(), progress: api.progress() };
});

test.use({ reducedMotion: 'reduce' });

async function openGame(page: Page): Promise<void> {
  await page.goto('/rush-hour');
  await expect(page.locator('#tl-board')).toBeVisible();
  await expect(page.locator('h1')).toContainText('déclic');
}

async function chooseLevel(page: Page, id: number): Promise<void> {
  const level = LEVELS.find(candidate => candidate.id === id)!;
  await page.locator(`[data-action="world"][data-world="${level.worldId}"]`).click();
  await page.locator(`[data-action="level"][data-level="${id}"]`).click();
  expect((await snapshot(page)).level.id).toBe(id);
}

/** Real pointer input; the inspection API is read-only and never moves a car. */
async function dragCar(page: Page, id: string, delta: number, crossAxis = false): Promise<void> {
  const car = page.locator(`[data-car="${id}"]`);
  await car.scrollIntoViewIfNeeded();
  const box = await car.boundingBox();
  expect(box).not.toBeNull();
  const cell = await page.locator('#tl-board').evaluate(board => board.clientWidth / 6);
  const horizontal = await car.getAttribute('data-axis') === 'h';
  const alongX = crossAxis ? !horizontal : horizontal;
  const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (alongX ? delta * cell : 0), y + (alongX ? 0 : delta * cell), { steps: 6 });
  await page.mouse.up();
}

async function requestHint(page: Page, move: Move): Promise<void> {
  await page.locator('[data-action="hint"]').click();
  await expect(page.locator(`[data-car="${move.id}"]`)).toHaveClass(/hinted/);
  await expect(page.locator('[data-action="apply-hint"]')).toBeVisible();
}

async function finishWithHints(page: Page): Promise<void> {
  const before = await snapshot(page), solution = solvePuzzle(before.state.vehicles);
  expect(solution).not.toBeNull();
  for (const [index, move] of solution!.entries()) {
    await requestHint(page, move);
    await page.locator('[data-action="apply-hint"]').click();
    expect((await snapshot(page)).state.moves).toBe(before.state.moves + index + 1);
  }
  await expect(page.getByRole('region', { name: 'Niveau réussi' })).toBeVisible();
}

test('third catalog card opens a lazy puzzle route, refreshes and returns without Phaser', async ({ page }) => {
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('.arcade-game')).toHaveCount(4);
  await expect(page.locator('.arcade-section-label')).toContainText('04 EXPERIENCES');
  await page.getByRole('link', { name: 'Play Exit Lane', exact: true }).last().click();
  await expect(page).toHaveURL(/\/rush-hour$/);
  await expect(page).toHaveTitle('EXIT LANE · Afterhours Arcade');
  await expect(page.locator('#tl-board')).toBeVisible();
  expect(await page.locator('canvas').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('fr');
  await page.reload();
  await expect(page.locator('#tl-board')).toBeVisible();
  await page.locator('.tl-back').click();
  await expect(page.locator('h1')).toContainText('free time');
  await expect(page.getByRole('link', { name: 'Play Blast Arena', exact: true }).last()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Frontline Heroes', exact: true }).last()).toBeVisible();
  expect(requests.some(url => /phaser|ArenaRenderer|ShooterRenderer|\/frontline\/main|\/blast\.ts/.test(url))).toBe(false);
  expect(errors).toEqual([]);
});

test('keyboard and drag stay on axis, stop at cars and bounds, and undo/reset restore the board', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openGame(page);
  const initial = (await snapshot(page)).state;
  await page.locator('[data-car="R"]').click();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  expect((await snapshot(page)).state).toEqual(initial);

  await page.locator('[data-car="A"]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  expect((await snapshot(page)).state).toEqual(initial);
  await page.keyboard.press('ArrowDown');
  expect((await snapshot(page)).state.vehicles.find(car => car.id === 'A')!.y).toBe(3);
  await page.keyboard.press('Shift+ArrowDown');
  expect((await snapshot(page)).state.vehicles.find(car => car.id === 'A')!.y).toBe(4);
  await page.keyboard.press('ArrowDown');
  expect((await snapshot(page)).state.moves).toBe(2);
  await page.keyboard.press('r');
  expect((await snapshot(page)).state).toEqual(initial);

  await dragCar(page, 'A', 2, true);
  expect((await snapshot(page)).state).toEqual(initial);
  await dragCar(page, 'A', 5);
  const clearedA = (await snapshot(page)).state;
  expect(clearedA.vehicles.find(car => car.id === 'A')!.y).toBe(4);
  expect(clearedA.moves).toBe(1);
  await dragCar(page, 'R', 6);
  const blocked = (await snapshot(page)).state;
  expect(blocked.vehicles.find(car => car.id === 'R')!.x).toBe(3);
  expect(blocked.won).toBe(false);
  await page.keyboard.press('z');
  expect((await snapshot(page)).state).toEqual(clearedA);
  await page.keyboard.press('Control+z');
  expect((await snapshot(page)).state).toEqual(initial);
  await dragCar(page, 'A', 1);
  await page.locator('[data-action="reset"]').click();
  expect((await snapshot(page)).state).toEqual(initial);
  await expect(page.locator('[data-action="undo"]')).toBeDisabled();
});

test('hints complete the first puzzle, award the optimal record and persist the next unfinished board', async ({ page }) => {
  await openGame(page);
  await finishWithHints(page);
  const solved = await snapshot(page);
  expect(solved.state.won).toBe(true);
  expect(solved.state.moves).toBe(solved.level.par);
  expect(solved.progress.best[1]).toBe(solved.level.par);
  await expect(page.getByLabel('3 étoiles sur 3', { exact: true })).toBeVisible();
  await page.locator('[data-action="next-level"]').click();
  expect((await snapshot(page)).level.id).toBe(2);
  const move = solvePuzzle((await snapshot(page)).state.vehicles)![0]!;
  await dragCar(page, move.id, move.delta);
  const unfinished = await snapshot(page);
  expect(unfinished.state.moves).toBe(1);
  expect(unfinished.progress.runs[2]).toEqual([move]);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('afterhours-exit-lane-v1')!));
  expect(stored.best['1']).toBe(solved.level.par);
  expect(stored.lastLevel).toBe(2);
  await page.reload();
  await expect(page.locator('#tl-board')).toBeVisible();
  expect((await snapshot(page)).state).toEqual(unfinished.state);
  expect((await snapshot(page)).progress.best[1]).toBe(solved.level.par);
  await page.locator('[data-action="undo"]').click();
  expect((await snapshot(page)).state.moves).toBe(0);
});

test('all fifteen levels are accessible in three worlds and a fifth-level win opens the coast', async ({ page }) => {
  await openGame(page);
  await expect(page.locator('[data-action="world"]')).toHaveCount(3);
  const visited: number[] = [];
  for (const world of WORLDS) {
    await page.locator(`[data-action="world"][data-world="${world.id}"]`).click();
    await expect(page.locator('[data-action="level"]')).toHaveCount(5);
    for (const level of LEVELS.filter(candidate => candidate.worldId === world.id)) {
      await page.locator(`[data-action="level"][data-level="${level.id}"]`).click();
      await expect(page.locator('#tl-game')).toHaveAttribute('data-world', world.id);
      const current = await snapshot(page);
      expect(current.level.id).toBe(level.id);
      expect(current.state.moves).toBe(0);
      visited.push(current.level.id);
    }
  }
  expect(visited).toEqual(LEVELS.map(level => level.id));
  await chooseLevel(page, 5);
  await finishWithHints(page);
  await expect(page.locator('[data-action="next-level"]')).toContainText('prochain monde');
  await page.locator('[data-action="next-level"]').click();
  expect((await snapshot(page)).level.id).toBe(6);
  await expect(page.locator('[data-world="coast"][data-action="world"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tl-game')).toHaveAttribute('data-world', 'coast');
});

test('a hard night puzzle is solved through hints and physical car drags, preserving its best on replay', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 1100 });
  await openGame(page);
  await chooseLevel(page, 15);
  const first = await snapshot(page), solution = solvePuzzle(first.state.vehicles)!;
  expect(solution.length).toBe(first.level.par);
  expect(solution.length).toBeGreaterThanOrEqual(20);
  await page.keyboard.press('h');
  await expect(page.locator(`[data-car="${solution[0]!.id}"]`)).toHaveClass(/hinted/);
  await page.locator('[data-action="apply-hint"]').click();
  for (const [index, move] of solution.slice(1).entries()) {
    if (index === 9) {
      await requestHint(page, move);
      await page.locator('[data-action="hide-hint"]').click();
    }
    const car = (await snapshot(page)).state.vehicles.find(candidate => candidate.id === move.id)!;
    if (car.target && car.x + move.delta === 6) {
      await page.locator(`[data-car="${move.id}"]`).focus();
      await page.keyboard.press('Shift+ArrowRight');
    } else await dragCar(page, move.id, move.delta);
    expect((await snapshot(page)).state.moves).toBe(index + 2);
  }
  await expect(page.getByRole('region', { name: 'Niveau réussi' })).toBeVisible();
  const won = await snapshot(page);
  expect(won.state.won).toBe(true);
  expect(won.progress.best[15]).toBe(first.level.par);
  await page.locator('[data-action="reset"]').last().click();
  const replay = await snapshot(page);
  expect(replay.state.moves).toBe(0);
  expect(replay.state.won).toBe(false);
  expect(replay.progress.best[15]).toBe(first.level.par);
  expect(errors).toEqual([]);
});

test('five distinct music tracks rotate and volume/mute preferences survive a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openGame(page);
  const names: string[] = [];
  for (const track of TRACKS) {
    await expect(page.locator('#tl-track-name')).toHaveText(track.name);
    names.push((await page.locator('#tl-track-name').textContent())!);
    await page.getByRole('button', { name: 'Musique suivante', exact: true }).click();
  }
  expect(new Set(names).size).toBe(5);
  await expect(page.locator('#tl-track-name')).toHaveText(TRACKS[0]!.name);
  await page.getByRole('slider', { name: 'Volume de la musique', exact: true }).fill('23');
  await expect(page.locator('#tl-volume-value')).toHaveText('23%');
  await page.locator('[data-action="mute"]').click();
  await expect(page.locator('[data-action="mute"]')).toHaveAttribute('aria-pressed', 'true');
  expect((await snapshot(page)).progress).toMatchObject({ volume: .23, muted: true });
  await page.reload();
  await expect(page.getByRole('slider', { name: 'Volume de la musique', exact: true })).toHaveValue('23');
  await expect(page.locator('[data-action="mute"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="mute"]').click();
  await expect(page.locator('[data-action="mute"]')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('restart during a drag releases the car and browser Back restores an interactive saved game', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openGame(page);
  const initial = (await snapshot(page)).state;
  const car = page.locator('[data-car="A"]');
  await car.scrollIntoViewIfNeeded();
  const box = (await car.boundingBox())!, cell = await page.locator('#tl-board').evaluate(board => board.clientWidth / 6);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + cell, { steps: 4 });
  await expect(page.locator('[data-car="A"]')).toHaveClass(/is-dragging/);
  await page.keyboard.press('r');
  await expect(page.locator('.is-dragging')).toHaveCount(0);
  expect((await snapshot(page)).state).toEqual(initial);
  await page.mouse.up();
  await dragCar(page, 'A', 2);
  const moved = (await snapshot(page)).state;
  expect(moved.moves).toBe(1);
  await page.locator('.tl-back').click();
  await expect(page.locator('.arcade-game')).toHaveCount(4);
  await page.goBack();
  await expect(page.locator('#tl-board')).toBeVisible();
  expect((await snapshot(page)).state).toEqual(moved);
  await page.locator('[data-car="A"]').focus();
  await page.keyboard.press('ArrowUp');
  expect((await snapshot(page)).state.moves).toBe(2);
  await page.keyboard.press('z');
  expect((await snapshot(page)).state).toEqual(moved);
  const track = await page.locator('#tl-track-name').textContent();
  await page.locator('[data-action="next-track"]').click();
  await expect(page.locator('#tl-track-name')).not.toHaveText(track!);
  expect(errors).toEqual([]);
});

test.describe('touch controls', () => {
  test.use({ hasTouch: true });
  for (const width of [360, 390]) test(`a ${width}px phone fits the worlds, board and controls and moves cars with touch`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await openGame(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('[data-action="world"]')).toHaveCount(3);
    await expect(page.locator('[data-action="hint"]')).toBeVisible();
    const car = page.locator('[data-car="A"]');
    await car.scrollIntoViewIfNeeded();
    const box = (await car.boundingBox())!, cell = await page.locator('#tl-board').evaluate(board => board.clientWidth / 6);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 6; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 2 * cell * step / 6 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
    const moved = (await snapshot(page)).state;
    expect(moved.moves).toBe(1);
    expect(moved.vehicles.find(candidate => candidate.id === 'A')!.y).toBe(4);
    await page.locator('[data-action="undo"]').tap();
    await expect.poll(async () => (await snapshot(page)).state.moves).toBe(0);
    await page.locator('[data-action="world"][data-world="night"]').tap();
    await page.locator('[data-action="level"][data-level="15"]').tap();
    await expect(page.locator('#tl-game')).toHaveAttribute('data-world', 'night');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Comment jouer', exact: true }).tap();
    await expect(page.locator('#tl-help')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-action="close-help"]').tap();
    const currentTrack = await page.locator('#tl-track-name').textContent();
    const trackIndex = TRACKS.findIndex(track => track.name === currentTrack);
    await page.locator('[data-action="next-track"]').tap();
    const nextTrack = TRACKS[(trackIndex + 1) % TRACKS.length]!.name;
    await expect(page.locator('#tl-track-name')).toHaveText(nextTrack);
    await page.locator('[data-action="mute"]').tap();
    await expect(page.locator('[data-action="mute"]')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('slider', { name: 'Volume de la musique', exact: true }).fill('31');
    // Subsequent input lets any native compatibility click arrive: it must not repeat the touch action.
    await expect(page.locator('#tl-track-name')).toHaveText(nextTrack);
    await expect(page.locator('[data-action="mute"]')).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });
});
