import { expect, test, type Page } from '@playwright/test';
import { CONTENT } from '../src/malagasy/content';
import { normalizeAnswer } from '../src/malagasy/engine';
import { tokensFor } from '../src/malagasy/exercise-view';
import { RECOVERY_KEY, SAVE_KEY } from '../src/malagasy/storage';
import type { Exercise, Progress } from '../src/malagasy/types';

test.use({ reducedMotion: 'reduce' });

/** Inspect the genuine browser save; never inject answers, progress or a testing API. */
async function savedProgress(page: Page): Promise<Progress> {
  const saved = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
  expect(saved).not.toBeNull();
  return JSON.parse(saved!) as Progress;
}
async function openAdventure(page: Page): Promise<void> {
  await page.goto('/malagasy-adventure');
  await expect(page.locator('h1')).toContainText('Un nouveau monde');
}
async function clickData(page: Page, attribute: string, value: string): Promise<void> {
  const candidates = page.locator(`[data-${attribute}]`);
  const values = await candidates.evaluateAll((nodes, key) => nodes.map(node => node.getAttribute(`data-${key}`)), attribute);
  const index = values.indexOf(value);
  expect(index, `A real button for data-${attribute}=${value} must exist`).toBeGreaterThanOrEqual(0);
  await candidates.nth(index).click();
}
async function answerCorrectly(page: Page, exercise: Exercise): Promise<void> {
  if (exercise.type === 'match') {
    for (const pair of exercise.pairs ?? []) {
      await clickData(page, 'left', pair.left);
      await clickData(page, 'right', pair.right);
    }
  } else if (exercise.type === 'order') {
    const tokens = tokensFor(exercise), used = new Set<number>();
    for (const word of exercise.answers[0].split(' ')) {
      const index = tokens.findIndex((token, candidate) => !used.has(candidate) && normalizeAnswer(token) === normalizeAnswer(word));
      expect(index, `The word bank must contain ${word}`).toBeGreaterThanOrEqual(0);
      used.add(index);
      await page.locator(`[data-token="${index}"]`).click();
    }
  } else if (exercise.type === 'translate' || exercise.type === 'cloze') {
    await page.locator('#ma-answer').fill(exercise.answers[0]);
  } else {
    await clickData(page, 'choice', exercise.answers[0]);
  }
}
async function answerIncorrectly(page: Page, exercise: Exercise): Promise<void> {
  if (exercise.type === 'match') {
    const pairs = exercise.pairs!;
    for (const [index, pair] of pairs.entries()) {
      await clickData(page, 'left', pair.left);
      await clickData(page, 'right', pairs[(index + 1) % pairs.length].right);
    }
  } else if (exercise.type === 'order') {
    await page.locator('[data-token]').first().click();
  } else if (exercise.type === 'translate' || exercise.type === 'cloze') {
    await page.locator('#ma-answer').fill('réponse volontairement incorrecte');
  } else {
    const wrong = exercise.choices!.find(choice => !exercise.answers.some(answer => normalizeAnswer(choice) === normalizeAnswer(answer)));
    expect(wrong).toBeDefined();
    await clickData(page, 'choice', wrong!);
  }
}
async function finishSession(page: Page, seenTypes = new Set<string>(), correct = true): Promise<number> {
  if (await page.locator('[data-action="begin-exercises"]').count()) {
    await page.getByRole('button', { name: 'Passer à la pratique' }).click();
  }
  let answered = 0;
  for (; answered < 100; answered++) {
    if (await page.locator('.ma-completion').count()) break;
    const task = page.locator('[data-exercise-id]');
    await expect(task).toBeVisible();
    const exerciseId = await task.getAttribute('data-exercise-id');
    const exercise = CONTENT.exercises.find(candidate => candidate.id === exerciseId);
    expect(exercise, `The displayed task ${exerciseId} belongs to the authored content`).toBeDefined();
    seenTypes.add(exercise!.type);
    await expect(page.locator('#ma-submit')).toBeDisabled();
    if (correct) await answerCorrectly(page, exercise!);
    else await answerIncorrectly(page, exercise!);
    await page.getByRole('button', { name: 'Vérifier ma réponse' }).click();
    await expect(page.locator(`.ma-feedback.${correct ? 'correct' : 'incorrect'}`)).toBeVisible();
    await page.locator('[data-action="next-exercise"]').click();
  }
  expect(answered).toBeLessThan(100);
  await expect(page.locator('.ma-completion')).toBeVisible();
  await expect(page.locator('.ma-completion-stats')).toContainText(correct ? '100 %' : '0 %');
  return answered;
}
async function startLesson(page: Page, id: string): Promise<void> {
  await page.locator('[data-view="path"]').first().click();
  await page.locator(`[data-lesson="${id}"]`).click();
  await expect(page.getByRole('button', { name: 'Passer à la pratique' })).toBeVisible();
}
async function noHorizontalOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The view fits the device width').toBe(true);
}

test('fourth catalog card launches a lightweight app and twenty inspectable destinations', async ({ page }) => {
  const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.locator('.arcade-game')).toHaveCount(4);
  await expect(page.getByRole('link', { name: 'Play Blast Arena', exact: true }).last()).toHaveAttribute('href', '/blast-arena');
  await expect(page.getByRole('link', { name: 'Play Frontline Heroes', exact: true }).last()).toHaveAttribute('href', '/frontline-heroes');
  await expect(page.getByRole('link', { name: 'Play Exit Lane', exact: true }).last()).toHaveAttribute('href', '/rush-hour');
  await page.getByRole('link', { name: 'Découvrir Malagasy Adventure', exact: true }).last().click();
  await expect(page).toHaveURL(/\/malagasy-adventure$/);
  await expect(page.locator('h1')).toContainText('Un nouveau monde');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(requests.some(url => /phaser|ArenaRenderer|ShooterRenderer/.test(url))).toBe(false);
  await expect(page.locator('[data-lesson]').first()).toBeEnabled();
  await expect(page.locator('[data-lesson]').nth(1)).toBeDisabled();
  await expect(page.locator('[data-lesson]')).toHaveCount(9);
  await page.locator('[data-view="worlds"]').click();
  await expect(page.locator('[data-world]')).toHaveCount(20);
  await expect(page.locator('.ma-destination.open')).toHaveCount(1);
  await page.locator('[data-world="world-20"]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('DESTINATION EN PRÉPARATION');
  await expect(dialog).toContainText('Les constructions à découvrir');
  await expect(dialog.locator('[data-view="path"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.locator('[data-world="world-01"]').click();
  await expect(dialog).toContainText('3 UNITÉS JOUABLES');
  await dialog.getByRole('button', { name: 'Retrouver mon parcours' }).click();
  await page.reload();
  await expect(page.locator('h1')).toContainText('Un nouveau monde');
  expect(errors).toEqual([]);
});

test('all nine lessons are reachable through real exercises and progress survives reload', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [], seenTypes = new Set<string>();
  page.on('pageerror', error => errors.push(error.message));
  await openAdventure(page);
  let answered = 0;
  for (const lesson of CONTENT.lessons) {
    await startLesson(page, lesson.id);
    answered += await finishSession(page, seenTypes);
    const saved = await savedProgress(page);
    expect(saved.completedLessons).toContain(lesson.id);
    expect(saved.history).toHaveLength(answered);
    await page.reload();
    await expect(page.locator(`[data-lesson="${lesson.id}"]`)).toHaveClass(/done/);
  }
  const finished = await savedProgress(page);
  expect(finished.completedLessons).toEqual(CONTENT.lessons.map(lesson => lesson.id));
  expect(finished.achievements).toEqual(expect.arrayContaining(['first-lesson', 'three-lessons', 'first-unit']));
  expect(Object.keys(finished.concepts)).toHaveLength(CONTENT.concepts.length);
  expect(finished.xp).toBe(25 * CONTENT.lessons.length + 10 * finished.rewardedExercises.length);
  expect(seenTypes).toEqual(new Set(CONTENT.exercises.map(exercise => exercise.type)));
  await page.locator('[data-view="stats"]').click();
  await expect(page.locator('.ma-main')).toContainText('3 / 3 unités validées');
  await page.locator('[data-view="reviews"]').click();
  await page.getByRole('button', { name: 'Lancer une révision' }).click();
  await finishSession(page);
  const reviewed = await savedProgress(page);
  expect(reviewed.completedLessons).toHaveLength(9);
  expect(reviewed.history.length).toBeGreaterThan(finished.history.length);
  expect(errors).toEqual([]);
});

test('replaying a lesson rewards only new exercise IDs and keeps prior completion', async ({ page }) => {
  await openAdventure(page);
  const first = CONTENT.lessons[0];
  await startLesson(page, first.id);
  await finishSession(page);
  for (let repeat = 0; repeat < 2; repeat++) {
    const before = await savedProgress(page);
    await startLesson(page, first.id);
    await finishSession(page);
    const after = await savedProgress(page);
    const newRewards = after.rewardedExercises.filter(id => !before.rewardedExercises.includes(id));
    expect(after.xp - before.xp).toBe(newRewards.length * 10);
    expect(after.completedLessons).toEqual([first.id]);
    expect(new Set(after.rewardedExercises).size).toBe(after.rewardedExercises.length);
  }
});

test('a failed replay offers practice while retaining the previously validated lesson', async ({ page }) => {
  await openAdventure(page);
  const first = CONTENT.lessons[0];
  await startLesson(page, first.id);
  await finishSession(page);
  const before = await savedProgress(page);
  await startLesson(page, first.id);
  await finishSession(page, new Set(), false);
  await expect(page.locator('.ma-completion h1')).toHaveText('Reprenons le chemin.');
  await expect(page.getByRole('button', { name: 'Réessayer cette étape' })).toBeVisible();
  const after = await savedProgress(page);
  expect(after.completedLessons).toEqual(before.completedLessons);
  expect(after.xp).toBe(before.xp);
  await page.locator('[data-view="path"]').first().click();
  await expect(page.locator(`[data-lesson="${first.id}"]`)).toHaveClass(/done/);
  await expect(page.locator(`[data-lesson="${CONTENT.lessons[1].id}"]`)).toBeEnabled();
});

test('unreadable local progress is preserved verbatim and can be downloaded before a fresh lesson', async ({ page }) => {
  await openAdventure(page);
  const damaged = '{"schemaVersion":1,"xp":42,"unfinished":';
  // Deliberately corrupt the persisted primary document to exercise recovery, never to bypass learning.
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: SAVE_KEY, raw: damaged });
  await page.reload();
  await expect(page.locator('.ma-storage-warning')).toContainText('Une copie de récupération a été conservée');
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(damaged);
  expect(await page.evaluate(key => localStorage.getItem(key), RECOVERY_KEY)).toBe(damaged);
  await page.locator('[data-view="backup"]').first().click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger la copie conservée' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('malagasy-copie-a-examiner.json');
  const stream = await download.createReadStream(), chunks: Buffer[] = [];
  expect(stream).not.toBeNull();
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe(damaged);
  await startLesson(page, CONTENT.lessons[0].id);
  await finishSession(page);
  expect((await savedProgress(page)).completedLessons).toEqual([CONTENT.lessons[0].id]);
  expect(await page.evaluate(key => localStorage.getItem(key), RECOVERY_KEY)).toBe(damaged);
  await page.reload();
  await page.locator('[data-view="backup"]').first().click();
  await expect(page.getByRole('button', { name: 'Télécharger la copie conservée' })).toBeVisible();
});

test('downloaded saves preview before replacement, restore progress and reject corrupted input', async ({ page }) => {
  await openAdventure(page);
  await startLesson(page, CONTENT.lessons[0].id);
  await finishSession(page);
  const original = await savedProgress(page);
  await page.locator('[data-view="backup"]').click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter ma sauvegarde' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^malagasy-adventure-.*\.json$/);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = Buffer.concat(chunks);
  expect(JSON.parse(exported.toString())).toEqual(original);
  await startLesson(page, CONTENT.lessons[1].id);
  await finishSession(page);
  const newer = await savedProgress(page);
  expect(newer.completedLessons).toHaveLength(2);
  await page.locator('[data-view="backup"]').click();
  await page.locator('#ma-import-file').setInputFiles({ name: 'voyage.json', mimeType: 'application/json', buffer: exported });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Reprendre ce voyage ?');
  expect(await savedProgress(page)).toEqual(newer);
  await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(await savedProgress(page)).toEqual(newer);
  await page.locator('#ma-import-file').setInputFiles({ name: 'voyage-copie.json', mimeType: 'application/json', buffer: exported });
  await dialog.getByRole('button', { name: 'Remplacer mon carnet' }).click();
  expect(await savedProgress(page)).toEqual(original);
  await page.reload();
  await expect(page.locator('.ma-backup-panel').first()).toContainText(`${original.xp} XP`);
  await page.locator('#ma-import-file').setInputFiles({ name: 'corrompu.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":1,"__proto__":{"polluted":true}}') });
  await expect(dialog).toContainText('Ce carnet ne peut pas être ouvert');
  await expect(dialog.getByRole('alert')).toContainText('invalide');
  expect(await savedProgress(page)).toEqual(original);
});

test('sources follow the registry and lexicon clearly identifies unavailable language audio', async ({ page }) => {
  await page.goto('/malagasy-adventure#sources');
  await expect(page.locator('.ma-source-list article')).toHaveCount(CONTENT.sources.filter(source => source.consulted).length);
  for (const source of CONTENT.sources.filter(source => source.consulted)) {
    const link = page.locator(`#source-${source.id} a`);
    await expect(link).toHaveAttribute('href', source.url);
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
  await expect(page.locator('.ma-main')).toContainText('relecture');
  await page.locator('[data-view="vocabulary"]').click();
  await expect(page.locator('.ma-main')).toContainText('Aucun enregistrement natif vérifié');
  await expect(page.locator('audio')).toHaveCount(0);
  await expect(page.locator('.ma-word-card')).toHaveCount(CONTENT.vocabulary.length);
  await page.locator('#ma-search').fill('salama');
  expect(await page.locator('.ma-word-card').count()).toBeGreaterThan(0);
  await page.locator('[data-vocab-source]').first().click();
  await expect(page.getByRole('dialog').locator('a')).not.toHaveCount(0);
});

for (const width of [340, 390]) test(`all app views and a real lesson fit a ${width}px mobile screen`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const view of ['path', 'worlds', 'reviews', 'vocabulary', 'stats', 'sources', 'backup']) {
    await page.goto(`/malagasy-adventure#${view}`);
    await expect(page.locator('h1')).toBeVisible();
    await noHorizontalOverflow(page);
  }
  await page.locator('[data-view="worlds"]').click();
  await page.locator('[data-world="world-20"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await noHorizontalOverflow(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await startLesson(page, CONTENT.lessons[0].id);
  await noHorizontalOverflow(page);
  await finishSession(page);
  await noHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
