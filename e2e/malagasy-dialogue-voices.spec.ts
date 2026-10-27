import { expect, test, type Page } from '@playwright/test';

interface VoiceRecord { source: string; events: string[]; duration: number; rate: number }
interface VoiceAudit { records: VoiceRecord[]; active: number; maxConcurrent: number; synthCalls: number }
test.use({ reducedMotion: 'reduce' });

/** Observe real browser audio elements; do not replace their playback or asset bytes. */
async function observeVoiceAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const nativeAudio = window.Audio, elements: HTMLAudioElement[] = [];
    const records: VoiceRecord[] = [];
    let maxConcurrent = 0, synthCalls = 0;
    const audit = { snapshot: (): VoiceAudit => ({ records: records.map(record => ({ ...record, events: [...record.events] })),
      active: elements.filter(audio => !audio.paused && !audio.ended).length, maxConcurrent, synthCalls }) };
    (window as unknown as { __VOICE_AUDIT__: typeof audit }).__VOICE_AUDIT__ = audit;
    const observed = function (source?: string): HTMLAudioElement {
      const audio = new nativeAudio(source);
      if (source?.includes('/malagasy/voices/')) {
        const record: VoiceRecord = { source, events: [], duration: 0, rate: 1 };
        elements.push(audio); records.push(record);
        for (const event of ['loadedmetadata', 'playing', 'ended', 'pause', 'error']) audio.addEventListener(event, () => {
          record.events.push(event); record.rate = audio.playbackRate;
          if (Number.isFinite(audio.duration)) record.duration = audio.duration;
          if (event === 'playing') maxConcurrent = Math.max(maxConcurrent, elements.filter(element => !element.paused && !element.ended).length);
        });
      }
      return audio;
    };
    observed.prototype = nativeAudio.prototype;
    Object.setPrototypeOf(observed, nativeAudio);
    window.Audio = observed as unknown as typeof Audio;
    const nativeSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = utterance => { synthCalls++; nativeSpeak(utterance); };
  });
}
const audit = (page: Page): Promise<VoiceAudit> => page.evaluate(() => (window as unknown as { __VOICE_AUDIT__: { snapshot(): VoiceAudit } }).__VOICE_AUDIT__.snapshot());
const starts = async (page: Page): Promise<number> => (await audit(page)).records.reduce((total, record) => total + record.events.filter(event => event === 'playing').length, 0);
async function openFirstDialogue(page: Page): Promise<void> {
  await page.goto('/malagasy-adventure');
  await page.locator('.ma-world-hero').waitFor();
  await page.locator('[data-action="continue"]').click();
  await expect(page.locator('.ma-dialogue-discovery')).toBeVisible();
}
async function toPractice(page: Page): Promise<void> {
  for (let index = 0; index < 40; index++) {
    const begin = page.locator('[data-action="begin-exercises"]');
    if (await begin.count()) { await begin.click(); await page.locator('#ma-submit').waitFor(); return; }
    await page.locator('[data-action="advance-dialogue"]').click();
  }
  throw new Error('The introductory dialogues never reached practice');
}
test.beforeEach(async ({ page }) => observeVoiceAudio(page));

test('a real Malagasy model voice starts with a dialogue turn and its speaker button replays it', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await openFirstDialogue(page);
  await expect.poll(() => starts(page)).toBe(1);
  await expect.poll(async () => (await audit(page)).records[0]?.events.includes('ended')).toBe(true);
  const first = (await audit(page)).records[0];
  expect(first.source).toMatch(/\/malagasy\/voices\/mms\/audio-mms-[a-f0-9]+\.wav$/); expect(first.duration).toBeGreaterThan(.1);
  await page.locator('[data-action="replay-dialogue"]').first().click();
  await expect.poll(() => starts(page)).toBe(2);
  await expect.poll(async () => (await audit(page)).records.at(-1)?.events.includes('ended')).toBe(true);
  await page.locator('[data-action="slow-dialogue"]').first().click();
  await expect.poll(() => starts(page)).toBe(3);
  expect((await audit(page)).records.at(-1)?.rate).toBe(.75);
  expect((await audit(page)).synthCalls).toBe(0); expect(errors).toEqual([]);
});

test('new turns queue without overlap and navigation cancels the spoken phrase', async ({ page }) => {
  await openFirstDialogue(page);
  await expect.poll(() => starts(page)).toBe(1);
  await page.locator('[data-action="advance-dialogue"]').click();
  await expect.poll(() => starts(page)).toBe(2);
  expect((await audit(page)).records.at(-1)?.source).toContain('/malagasy/voices/profiles/');
  expect((await audit(page)).records.at(-1)?.rate).toBe(1);
  expect((await audit(page)).maxConcurrent).toBe(1);
  await page.locator('.ma-speech').last().locator('[data-action="replay-dialogue"]').click();
  await expect.poll(() => starts(page)).toBe(3);
  await page.locator('[data-view="worlds"]').click();
  await expect(page.locator('.ma-journey-map')).toBeVisible();
  await expect.poll(async () => (await audit(page)).active).toBe(0);
  expect((await audit(page)).maxConcurrent).toBe(1);
});

test('Malagasy choices speak on selection, French stays silent and gaps never reveal a missing answer', async ({ page }) => {
  await openFirstDialogue(page); await toPractice(page);
  await expect.poll(async () => (await audit(page)).active).toBe(0);
  const before = (await audit(page)).records.length;
  await page.locator('.ma-speech-translation summary').first().click();
  await page.waitForTimeout(160);
  expect((await audit(page)).records.length).toBe(before);
  const beforeStarts = await starts(page);
  await page.locator('[data-choice="Veloma"]').click(); // Wrong answer still speaks the chosen word.
  await expect.poll(() => starts(page)).toBe(beforeStarts + 1);
  await page.locator('[data-choice="Salama"]').click();
  await expect.poll(() => starts(page)).toBe(beforeStarts + 2);
  expect((await audit(page)).records.at(-1)?.source).toContain('/profiles/');
  expect((await audit(page)).maxConcurrent).toBe(1);
  await page.locator('[data-choice="Salama"]').click(); // A second click also replays the answer.
  await expect.poll(() => starts(page)).toBe(beforeStarts + 3);
  await page.locator('#ma-submit').click(); await page.locator('[data-action="next-exercise"]').click();
  await expect.poll(async () => (await audit(page)).active).toBe(0);
  const french = (await audit(page)).records.length;
  await page.locator('[data-choice="Merci"]').click(); await page.waitForTimeout(160);
  expect((await audit(page)).records.length).toBe(french);
  await page.locator('#ma-submit').click(); await page.locator('[data-action="next-exercise"]').click();
  await expect(page.locator('[data-exercise-id]')).toHaveAttribute('data-exercise-id', 'exercise-01-01-c');
  await expect(page.locator('[data-action="replay-dialogue"]')).toBeDisabled();
  await expect(page.locator('[data-action="slow-dialogue"]')).toHaveCount(0);
  const missing = (await audit(page)).records.length;
  await page.locator('[data-choice="Azafady"]').click();
  await expect.poll(async () => (await audit(page)).records.length).toBe(missing + 1);
  await expect.poll(async () => (await audit(page)).records.at(-1)?.events.includes('playing')).toBe(true);
  expect((await audit(page)).records.at(-1)?.source).toBe('/malagasy/voices/commons-azafady.ogg');
  await page.locator('#ma-submit').click(); await page.locator('[data-action="next-exercise"]').click();
  await expect.poll(async () => (await audit(page)).active).toBe(0);
  const associations = (await audit(page)).records.length;
  await page.locator('[data-left="Misaotra"]').click();
  await expect.poll(async () => (await audit(page)).records.length).toBe(associations + 1);
  await page.locator('[data-right="Merci"]').click(); await page.waitForTimeout(160);
  expect((await audit(page)).records.length).toBe(associations + 1);
  expect((await audit(page)).synthCalls).toBe(0);
});

test('a muted selected answer stays silent and is read only after another deliberate selection', async ({ page }) => {
  await openFirstDialogue(page); await toPractice(page);
  await page.locator('.ma-sound').click();
  const before = (await audit(page)).records.length;
  await page.locator('[data-choice="Salama"]').click(); await page.waitForTimeout(160);
  expect((await audit(page)).records.length).toBe(before);
  await page.locator('.ma-sound').click(); await page.waitForTimeout(160);
  expect((await audit(page)).records.length).toBe(before);
  await page.locator('[data-choice="Salama"]').click();
  await expect.poll(async () => (await audit(page)).records.length).toBe(before + 1);
  await expect.poll(async () => (await audit(page)).active).toBe(1);
  await page.locator('.ma-sound').click();
  await expect.poll(async () => (await audit(page)).active).toBe(0);
  expect((await audit(page)).maxConcurrent).toBe(1);
});

test('mute stops the current voice and unmute leaves old lines silent until manual replay', async ({ page }) => {
  await openFirstDialogue(page); await expect.poll(() => starts(page)).toBe(1);
  await page.locator('.ma-sound').click();
  await expect.poll(async () => (await audit(page)).active).toBe(0);
  const before = (await audit(page)).records.length;
  await page.locator('[data-action="advance-dialogue"]').click();
  await page.waitForTimeout(160);
  expect((await audit(page)).records.length).toBe(before);
  await page.locator('.ma-sound').click(); await page.waitForTimeout(160);
  expect((await audit(page)).records.length).toBe(before);
  await page.locator('.ma-speech').last().locator('[data-action="replay-dialogue"]').click();
  await expect.poll(() => starts(page)).toBe(2);
  expect((await audit(page)).synthCalls).toBe(0);
});

test('a failed voice asset reports an error while the written dialogue and answer remain usable', async ({ page }) => {
  await page.route('**/malagasy/voices/mms/*.wav', route => route.fulfill({ status: 503, contentType: 'text/plain', body: 'Unavailable in this failure scenario' }));
  await openFirstDialogue(page);
  await expect(page.locator('.ma-speech[data-voice-state="error"]')).toBeVisible();
  await expect(page.locator('[data-action="replay-dialogue"]').first()).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: /lecture|enregistrement|réessayer/i }).first()).toBeVisible();
  await toPractice(page);
  await page.locator('[data-choice="Salama"]').click(); await page.locator('#ma-submit').click();
  await expect(page.locator('.ma-feedback.correct')).toBeVisible();
  expect((await audit(page)).synthCalls).toBe(0);
});

test('browser autoplay rejection exposes a manual retry that plays the real recording', async ({ page }) => {
  await page.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    let first = true;
    HTMLMediaElement.prototype.play = function (): Promise<void> {
      if (first && this.src.includes('/malagasy/voices/')) { first = false; return Promise.reject(new DOMException('Simulated browser policy', 'NotAllowedError')); }
      return nativePlay.call(this);
    };
  });
  await openFirstDialogue(page);
  await expect(page.locator('.ma-speech[data-voice-state="blocked"]')).toBeVisible();
  expect(await starts(page)).toBe(0);
  await page.locator('[data-action="replay-dialogue"]').first().click();
  await expect.poll(() => starts(page)).toBe(1);
  await expect.poll(async () => (await audit(page)).records.at(-1)?.events.includes('ended')).toBe(true);
  expect((await audit(page)).synthCalls).toBe(0);
});
