import { expect, test } from '@playwright/test';

/** Render the real motifs, rather than asserting an oscillator implementation. */
for (const mode of ['success', 'correction', 'muted', 'unit'] as const) {
  test(`Malagasy ${mode} sound has a controlled, finite output`, async ({ page }) => {
    // The catalog does not instantiate language audio. Each fresh page gets a fresh module context.
    await page.goto('/');
    await expect(page.locator('.arcade-game').first()).toBeVisible();
    const rendered = await page.evaluate(async sound => {
      const offline = new OfflineAudioContext(1, 72_000, 48_000);
      let created = 0;
      (window as unknown as Record<string, unknown>).AudioContext = function () { created++; return offline; };
      const modulePath = '/src/malagasy/audio.ts';
      const audio = await import(/* @vite-ignore */ modulePath);
      if (sound === 'unit') audio.completionSound(false, true);
      else audio.feedbackSound(sound === 'success', sound === 'muted', 3);
      const buffer = await offline.startRendering(), samples = buffer.getChannelData(0), rate = buffer.sampleRate;
      const rms = (from: number, to: number): number => {
        let energy = 0, count = 0;
        for (let index = Math.floor(from * rate); index < Math.floor(to * rate); index++) { energy += samples[index] ** 2; count++; }
        return Math.sqrt(energy / count);
      };
      const dominant = (from: number, to: number): number => {
        let best = 0, frequency = 0;
        for (let candidate = 250; candidate <= 1400; candidate += 5) {
          let real = 0, imaginary = 0;
          for (let index = Math.floor(from * rate); index < Math.floor(to * rate); index++) {
            const angle = 2 * Math.PI * candidate * index / rate;
            real += samples[index] * Math.cos(angle); imaginary += samples[index] * Math.sin(angle);
          }
          const power = real ** 2 + imaginary ** 2;
          if (power > best) { best = power; frequency = candidate; }
        }
        return frequency;
      };
      return { created, finite: samples.every(Number.isFinite),
        peak: samples.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0),
        valley: rms(.112, .125), secondAttack: rms(.14, .19), tail: rms(1.2, 1.4),
        firstFrequency: dominant(.02, .09), secondFrequency: dominant(.16, .23) };
    }, mode);
    expect(rendered.finite).toBe(true);
    expect(rendered.peak).toBeLessThanOrEqual(.2);
    expect(rendered.tail).toBeLessThan(.00001);
    if (mode === 'muted') {
      expect(rendered.created).toBe(0);
      expect(rendered.peak).toBe(0);
    } else {
      expect(rendered.peak).toBeGreaterThan(.02);
    }
    if (mode === 'success') {
      // Two fresh attacks and an ascending interval distinguish a success from a neutral glide.
      expect(rendered.secondAttack).toBeGreaterThan(rendered.valley * 2);
      expect(rendered.secondFrequency).toBeGreaterThan(rendered.firstFrequency * 1.3);
    }
    if (mode === 'correction') {
      expect(rendered.secondFrequency).toBeLessThan(rendered.firstFrequency);
      expect(rendered.peak).toBeLessThan(.06);
    }
  });
}
