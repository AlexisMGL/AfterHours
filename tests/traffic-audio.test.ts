import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACKS, TrafficAudio } from '../src/traffic/audio';

class Parameter {
  value = 0;
  events: { value: number; at: number }[] = [];
  setValueAtTime(value: number, at: number) { this.value = value; this.events.push({ value, at }); }
  linearRampToValueAtTime(value: number, at: number) { this.value = value; this.events.push({ value, at }); }
  exponentialRampToValueAtTime(value: number, at: number) { this.value = value; this.events.push({ value, at }); }
  setTargetAtTime(value: number, at: number) { this.value = value; this.events.push({ value, at }); }
  cancelScheduledValues(at: number) { this.events = this.events.filter(event => event.at < at); }
}

class Node {
  gain = new Parameter(); frequency = new Parameter(); pan = new Parameter();
  type = 'sine'; buffer?: AudioBuffer;
  disconnected = false;
  connections: Node[] = [];
  connect(node: Node) { this.connections.push(node); }
  disconnect() { this.disconnected = true; this.connections = []; }
}

class Source extends Node {
  onended: (() => void) | null = null;
  starts: number[] = [];
  stops: number[] = [];
  private endTimer?: ReturnType<typeof setTimeout>;
  constructor(private owner: Context) { super(); }
  start(at: number) { this.starts.push(at); }
  stop(at: number) {
    this.stops.push(at);
    if (this.endTimer !== undefined) clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => { this.endTimer = undefined; this.onended?.(); }, Math.max(0, (at - this.owner.currentTime) * 1000));
  }
  cleanup() { if (this.endTimer !== undefined) clearTimeout(this.endTimer); }
}

class Context {
  static instances: Context[] = [];
  state: AudioContextState = 'running';
  sampleRate = 8000;
  destination = new Node();
  sources: Source[] = [];
  nodes: Node[] = [];
  extraTime = 0;
  private origin = Date.now();
  get currentTime() { return (Date.now() - this.origin) / 1000 + this.extraTime; }
  constructor() { Context.instances.push(this); }
  createGain() { const node = new Node(); this.nodes.push(node); return node; }
  createStereoPanner() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createOscillator() { const source = new Source(this); this.sources.push(source); return source; }
  createBufferSource() { return this.createOscillator(); }
  createBuffer(_channels: number, length: number) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; for (const source of this.sources) source.cleanup(); }
}

const active = (context: Context) => context.sources.filter(source => !source.disconnected && source.starts.length > 0);
const duration = (track: typeof TRACKS[number]) => 32 * 4 * 60 / track.bpm;

describe('five complete original traffic scores', () => {
  it('offers a minute or more of arranged, harmonized music per track', () => {
    expect(TRACKS).toHaveLength(5);
    expect(new Set(TRACKS.map(track => track.id)).size).toBe(5);
    for (const track of TRACKS) {
      expect(duration(track)).toBeGreaterThanOrEqual(60); expect(duration(track)).toBeLessThanOrEqual(90);
      expect(track.bars).toBe(32); expect(track.melody).toHaveLength(32); expect(track.harmony).toHaveLength(32);
      expect(new Set(track.harmony).size).toBeGreaterThanOrEqual(4);
      expect(track.melody.slice(0, 8)).not.toEqual(track.melody.slice(16, 24));
      expect(track.melody.slice(0, 8)).not.toEqual(track.melody.slice(24));
      for (const bar of track.melody) {
        expect(bar).toHaveLength(8);
        const notes = bar.filter(note => note !== null);
        expect(notes.length).toBeGreaterThan(0);
        expect(notes.every(note => Number.isInteger(note) && note >= 0 && note <= 20)).toBe(true);
      }
    }
  });

  it('changes melodic intervals, phrasing, harmony, groove and tempo rather than transposing one tune', () => {
    const intervals = TRACKS.map(track => {
      const degrees = track.melody.slice(0, 8).flat().filter(note => note !== null);
      return degrees.slice(1).map((note, index) => note - degrees[index]!);
    });
    const rhythms = TRACKS.map(track => track.melody.slice(0, 8).map(bar => bar.map(note => Number(note !== null)).join('')).join('|'));
    expect(new Set(intervals.map(value => value.join(','))).size).toBe(5);
    expect(new Set(rhythms).size).toBe(5);
    expect(new Set(TRACKS.map(track => track.mood)).size).toBe(5);
    expect(new Set(TRACKS.map(track => track.bpm)).size).toBe(5);
    expect(new Set(TRACKS.map(track => track.harmony.join(','))).size).toBe(5);
  });
});

describe('traffic audio transport and lifetime', () => {
  const players: TrafficAudio[] = [];
  let visibility: EventTarget & { visibilityState: string };
  const player = (callback?: ConstructorParameters<typeof TrafficAudio>[0]) => {
    const audio = new TrafficAudio(callback); players.push(audio); return audio;
  };
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(0); Context.instances = [];
    vi.stubGlobal('AudioContext', Context);
    visibility = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    vi.stubGlobal('document', visibility);
  });
  afterEach(() => {
    for (const audio of players.splice(0)) audio.destroy();
    vi.unstubAllGlobals(); vi.useRealTimers();
  });

  it('waits for explicit unlock and remains usable when browser audio is unavailable', async () => {
    const audio = player(); audio.play();
    expect(Context.instances).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
    await audio.unlock();
    expect(Context.instances).toHaveLength(1); expect(Context.instances[0]!.sources.length).toBeGreaterThan(0);
    await audio.unlock(); expect(Context.instances).toHaveLength(1);
    audio.destroy();
    vi.stubGlobal('AudioContext', undefined);
    const silent = player(); await silent.unlock(); silent.play(); silent.next(); silent.sfx('win'); silent.pause();
    expect(silent.getTrack()).toBe(TRACKS[1]); expect(vi.getTimerCount()).toBe(0);
  });

  it('rotates through all five tracks at full track boundaries without immediate repeats', async () => {
    const changes: string[] = [], audio = player(track => changes.push(track.id));
    await audio.unlock(); audio.play();
    for (let index = 0; index < 5; index++) {
      expect(audio.getTrack()).toBe(TRACKS[index]);
      vi.advanceTimersByTime(duration(TRACKS[index]!) * 1000 + 160);
    }
    expect(changes).toEqual([...TRACKS.slice(1).map(track => track.id), TRACKS[0]!.id]);
    expect(audio.getTrack()).toBe(TRACKS[0]);
    const context = Context.instances[0]!;
    expect(active(context).length).toBeLessThanOrEqual(48);
    expect(context.sources.every(source => source.starts.every(at => at >= 0) && source.stops.length > 0)).toBe(true);
  });

  it('keeps the playback position across long pauses and visibility changes', async () => {
    const audio = player(); await audio.unlock(); audio.play();
    vi.advanceTimersByTime(10000); audio.pause(); vi.advanceTimersByTime(50);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(120000); audio.resume();
    vi.advanceTimersByTime(5000);
    visibility.visibilityState = 'hidden'; visibility.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(50); expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(120000); expect(audio.getTrack()).toBe(TRACKS[0]);
    visibility.visibilityState = 'visible'; visibility.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime((duration(TRACKS[0]!) - 15) * 1000 + 300);
    expect(audio.getTrack()).toBe(TRACKS[1]);
  });

  it('respects zero volume and mute without creating a new context or restarting the song', async () => {
    const audio = player(); audio.setVolume(0); audio.setMuted(true);
    await audio.unlock(); audio.play();
    const context = Context.instances[0]!;
    expect(context.nodes[0]!.gain.value).toBe(0); expect(context.nodes[1]!.gain.value).toBe(0);
    vi.advanceTimersByTime(10000);
    audio.setMuted(false); expect(context.nodes[1]!.gain.value).toBe(0);
    audio.setVolume(0.4); audio.setMuted(true); audio.setMuted(false);
    expect(Context.instances).toHaveLength(1); expect(context.nodes[1]!.gain.value).toBeCloseTo(0.4 * 0.36);
    vi.advanceTimersByTime((duration(TRACKS[0]!) - 10) * 1000 + 150);
    expect(audio.getTrack()).toBe(TRACKS[1]);
  });

  it('skips immediately and bounds effect bursts while releasing every source on destruction', async () => {
    const changes: number[] = [], audio = player((_track, index) => changes.push(index));
    await audio.unlock(); audio.play();
    for (let i = 0; i < 50; i++) audio.sfx('win');
    expect(active(Context.instances[0]!).length).toBeLessThanOrEqual(60);
    audio.next(); expect(audio.getTrack()).toBe(TRACKS[1]); expect(changes).toEqual([1]);
    vi.advanceTimersByTime(100);
    const context = Context.instances[0]!;
    audio.destroy(); audio.destroy(); audio.play(); audio.next(); audio.sfx('select');
    visibility.dispatchEvent(new Event('visibilitychange'));
    expect(context.state).toBe('closed'); expect(vi.getTimerCount()).toBe(0);
    expect(active(context)).toHaveLength(0);
    expect(context.sources.every(source => source.disconnected)).toBe(true);
  });

  it('does not replay a backlog of notes after an interrupted audio clock', async () => {
    const audio = player(); await audio.unlock(); audio.play();
    const context = Context.instances[0]!, before = context.sources.length;
    context.extraTime = 200;
    vi.advanceTimersByTime(75);
    expect(context.sources.length - before).toBeLessThan(24);
    expect(audio.getTrack()).toBe(TRACKS[2]);
    const recent = context.sources.slice(before).flatMap(source => source.starts);
    expect(recent.every(at => at >= context.currentTime)).toBe(true);
  });
});
