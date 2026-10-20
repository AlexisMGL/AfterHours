import { describe, expect, it } from 'vitest';
import { ORCHESTRAL_PHRASES, OrchestraBank, orchestralPCM, type OrchestralInstrument } from '../src/frontline/audio/Orchestra';
import { SHOOTER_SCORES, ShooterAudio } from '../src/frontline/audio/ShooterAudio';

const RATE = 22050;
const INSTRUMENTS: OrchestralInstrument[] = ['strings', 'horns', 'flute', 'basses', 'timpani', 'cymbal'];
const rms = (data: Float32Array, from = 0, to = data.length): number => {
  let energy = 0;
  for (let i = from; i < to; i++) energy += data[i]! * data[i]!;
  return Math.sqrt(energy / Math.max(1, to - from));
};

/** Compare harmonic balance, rather than waveform phase or oscillator labels. */
function harmonicBalance(data: Float32Array, midi: number): number[] {
  const count = 8192, start = Math.floor(RATE * 0.45), frequency = 440 * 2 ** ((midi - 69) / 12);
  const window = Float64Array.from({ length: count }, (_, index) => data[start + index]! * (0.5 - 0.5 * Math.cos(2 * Math.PI * index / (count - 1))));
  const harmonics = Array.from({ length: 8 }, (_, harmonic) => {
    let energy = 0;
    for (const detune of [-0.009, -0.0045, 0, 0.0045, 0.009]) {
      const coefficient = 2 * Math.cos(2 * Math.PI * frequency * (harmonic + 1) * (1 + detune) / RATE);
      let before = 0, current = 0;
      for (const value of window) { const next = value + coefficient * current - before; before = current; current = next; }
      energy += Math.max(0, current * current + before * before - coefficient * current * before);
    }
    return energy;
  });
  const total = harmonics.reduce((sum, value) => sum + value, 0);
  return harmonics.map(value => value / total);
}

describe('original orchestral sample quality', () => {
  it.each(INSTRUMENTS)('%s produces finite, audible PCM with mixing headroom across its pitch range', instrument => {
    for (const midi of [40, 60, 80]) {
      const data = orchestralPCM(instrument, midi, RATE);
      expect(data.length).toBeGreaterThan(RATE);
      let peak = 0, finite = true;
      for (const value of data) { finite = finite && Number.isFinite(value); peak = Math.max(peak, Math.abs(value)); }
      expect(finite).toBe(true);
      expect(peak).toBeGreaterThan(0.3); expect(peak).toBeLessThanOrEqual(0.721);
      expect(rms(data)).toBeGreaterThan(0.025);
      expect(Math.abs(data[0]!)).toBe(0);
    }
  });
  it('recreates the same instrument deterministically without external recordings', () => {
    expect(orchestralPCM('strings', 60, 8000)).toEqual(orchestralPCM('strings', 60, 8000));
    expect(orchestralPCM('cymbal', 60, 8000)).toEqual(orchestralPCM('cymbal', 60, 8000));
  });
  it.each(['strings', 'horns', 'flute', 'basses'] as OrchestralInstrument[])('%s sustains across loop boundaries without an abnormal click', instrument => {
    for (const midi of [48, 67, 84]) {
      const data = orchestralPCM(instrument, midi, RATE), start = Math.floor(RATE * 0.4), end = Math.floor(RATE * 1.5);
      let differenceEnergy = 0;
      for (let i = start + 1; i < end; i++) differenceEnergy += (data[i]! - data[i - 1]!) ** 2;
      const typicalDifference = Math.sqrt(differenceEnergy / (end - start - 1));
      const seam = Math.abs(data[start]! - data[end - 1]!);
      expect(seam).toBeLessThan(Math.max(0.025, typicalDifference * 3));
      expect(rms(data, start, end)).toBeGreaterThan(0.04);
    }
  });
  it('gives bowed strings, horns, flute and basses measurably different harmonic colors', () => {
    const fingerprints = ['strings', 'horns', 'flute', 'basses'].map(instrument => harmonicBalance(orchestralPCM(instrument as OrchestralInstrument, 60, RATE), 60));
    for (let a = 0; a < fingerprints.length; a++) for (let b = a + 1; b < fingerprints.length; b++) {
      const difference = fingerprints[a]!.reduce((sum, value, index) => sum + Math.abs(value - fingerprints[b]![index]!), 0);
      expect(difference, `instrument colors ${a} and ${b}`).toBeGreaterThan(0.035);
    }
  });
  it.each(['timpani', 'cymbal'] as OrchestralInstrument[])('%s decays naturally rather than ending in a sustained noise block', instrument => {
    const data = orchestralPCM(instrument, 45, RATE);
    const early = rms(data, Math.floor(RATE * 0.05), Math.floor(RATE * 0.45));
    const tail = rms(data, Math.floor(RATE * 1.5), Math.floor(RATE * 2));
    expect(early).toBeGreaterThan(tail * 3);
  });
  it('shares nearby sampled pitches while preserving their transposition', () => {
    let buffers = 0;
    const context = {
      createBuffer: (_channels: number, length: number, sampleRate: number) => {
        buffers++;
        return { length, sampleRate, copyToChannel: () => undefined } as unknown as AudioBuffer;
      },
    } as unknown as BaseAudioContext;
    const bank = new OrchestraBank(context), lower = bank.sample('horns', 60), upper = bank.sample('horns', 61);
    expect(lower.buffer).toBe(upper.buffer); expect(buffers).toBe(1);
    expect(upper.rate / lower.rate).toBeCloseTo(2 ** (1 / 12));
    expect(bank.sample('strings', 60).buffer).not.toBe(lower.buffer);
  });
});

describe('complete, melodic orchestral scores', () => {
  it('contains two contrasting full eight-bar melodies with long, nonoverlapping notes', () => {
    for (const section of Object.values(ORCHESTRAL_PHRASES)) {
      expect(section).toHaveLength(8);
      for (const bar of section) {
        expect(bar[0]![0]).toBe(0);
        let previousEnd = 0, occupied = 0;
        for (const [offset, degree, length] of bar) {
          expect(Number.isFinite(degree)).toBe(true); expect(offset).toBeGreaterThanOrEqual(previousEnd);
          expect(length).toBeGreaterThanOrEqual(1.5); expect(offset + length).toBeLessThanOrEqual(8);
          previousEnd = offset + length; occupied += length;
        }
        expect(occupied / 8).toBeGreaterThan(0.85);
        expect(previousEnd).toBeGreaterThanOrEqual(7.4);
      }
    }
    const melodyA = ORCHESTRAL_PHRASES.a.flatMap(bar => bar.map(note => note[1]));
    const melodyB = ORCHESTRAL_PHRASES.b.flatMap(bar => bar.map(note => note[1]));
    expect(new Set(melodyA).size).toBeGreaterThanOrEqual(8); expect(new Set(melodyB).size).toBeGreaterThanOrEqual(8);
    expect(melodyA).not.toEqual(melodyB);
  });
  it('provides complete distinct map/menu/result scores with harmonic progressions', () => {
    const unique = new Set<string>();
    for (const score of Object.values(SHOOTER_SCORES)) {
      expect(score.bpm).toBeGreaterThanOrEqual(60); expect(score.bpm).toBeLessThanOrEqual(160);
      expect(score.scale).toHaveLength(7); expect(score.progression).toHaveLength(8); expect(new Set(score.progression).size).toBeGreaterThanOrEqual(3);
      for (const section of [score.a, score.b]) {
        expect(section).toHaveLength(8);
        for (const bar of section) { expect(bar).toHaveLength(8); expect(bar.filter(degree => degree !== -99).length).toBeGreaterThanOrEqual(3); }
      }
      expect(score.a).not.toEqual(score.b);
      unique.add(JSON.stringify([score.bpm, score.root, score.progression, score.a, score.b]));
    }
    expect(unique.size).toBe(Object.keys(SHOOTER_SCORES).length);
    const fullSkybreachSeconds = 32 * 4 * 60 / SHOOTER_SCORES.aircraft.bpm;
    expect(fullSkybreachSeconds).toBeGreaterThan(60);
  });
});

describe('bounded audio lifetime', () => {
  it('prepares cold orchestral buffers before choosing clock times and keeps later bars cache-only', () => {
    let clock = 0;
    const cached = new Set<string>(), starts: { when: number; now: number }[] = [];
    const parameter = () => ({ value: 0, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined, setTargetAtTime: () => undefined });
    const node = () => ({
      gain: parameter(), frequency: parameter(), playbackRate: parameter(), pan: parameter(), onended: null,
      connect: () => undefined, disconnect: () => undefined, stop: () => undefined,
      start: (when = 0) => { starts.push({ when, now: clock }); },
    });
    const context = {
      get currentTime() { return clock; }, state: 'running', close: () => Promise.resolve(),
      createBufferSource: node, createGain: node, createBiquadFilter: node, createStereoPanner: node,
    };
    const orchestra = { sample: (instrument: OrchestralInstrument, midi: number) => {
      const key = `${instrument}:${instrument === 'cymbal' ? 60 : Math.round(midi / 5) * 5}`;
      if (!cached.has(key)) { cached.add(key); clock += 0.04; }
      return { buffer: {}, rate: 1 };
    } };
    const audio = new ShooterAudio();
    Object.assign(audio, { context, orchestra, music: node(), hall: node() });
    try {
      audio.playTheme('aircraft');
      expect(clock).toBeGreaterThan(0.5); expect(starts.length).toBeGreaterThan(0);
      expect(starts.every(start => start.when >= start.now + 0.05)).toBe(true);
      const preparedAt = clock;
      const sequence = audio as unknown as { musicStep(score: typeof SHOOTER_SCORES.aircraft, step: number, time: number, eighth: number): void };
      for (const step of [64, 128, 192, 248]) sequence.musicStep(SHOOTER_SCORES.aircraft, step, clock + 0.1, 60 / SHOOTER_SCORES.aircraft.bpm / 2);
      expect(clock).toBe(preparedAt);
      expect(starts.every(start => start.when >= start.now)).toBe(true);
    } finally { audio.destroy(); }
  });
  it('caps simultaneous music and battlefield voices, protects higher priority sounds, and disconnects ended voices', () => {
    interface TestVoice { music: boolean; sources: AudioScheduledSourceNode[] }
    const audio = new ShooterAudio() as unknown as {
      voices: Set<TestVoice>;
      register(sources: AudioScheduledSourceNode[], nodes: AudioNode[], music: boolean, priority: number, end: number): TestVoice | undefined;
    };
    let stopped = 0, disconnected = 0;
    const source = (): AudioScheduledSourceNode => ({
      onended: null, stop: () => { stopped++; }, disconnect: () => { disconnected++; },
    }) as unknown as AudioScheduledSourceNode;
    for (const music of [true, false]) for (let index = 0; index < 100; index++) audio.register([source()], [], music, music ? 2 : 4, index + 1);
    expect([...audio.voices].filter(voice => voice.music)).toHaveLength(40);
    expect([...audio.voices].filter(voice => !voice.music)).toHaveLength(24);
    expect(audio.voices.size).toBe(64); expect(stopped).toBeGreaterThan(100);
    expect(audio.register([source()], [], false, 0, 200)).toBeUndefined();
    expect(audio.voices.size).toBe(64);
    for (const voice of [...audio.voices]) for (const node of voice.sources) (node.onended as (() => void) | null)?.();
    expect(audio.voices.size).toBe(0); expect(disconnected).toBe(201);
  });
});
