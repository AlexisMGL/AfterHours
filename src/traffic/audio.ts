/** Five original, deliberately gentle scores. All music and effects are synthesized locally. */
type MelodyBar = readonly (number | null)[];
type Mood = 'city' | 'coast' | 'bossa' | 'neon' | 'drift';

export interface TrafficTrack {
  readonly id: string;
  readonly name: string;
  readonly bpm: number;
  readonly root: number;
  readonly scale: readonly number[];
  readonly mood: Mood;
  readonly bars: 32;
  /** Eighth-note scale degrees; a null gives the melody room to breathe. */
  readonly melody: readonly MelodyBar[];
  readonly harmony: readonly number[];
}

const major = [0, 2, 4, 5, 7, 9, 11] as const;
const dorian = [0, 2, 3, 5, 7, 9, 10] as const;
const minor = [0, 2, 3, 5, 7, 8, 10] as const;

function score(
  id: string, name: string, bpm: number, root: number, scale: readonly number[], mood: Mood,
  harmony: readonly number[], a: readonly MelodyBar[], b: readonly MelodyBar[],
): TrafficTrack {
  // A, an answering A, a bridge B, then a varied return. The ending resolves before the next score.
  const melody = [
    ...a,
    ...a.map((bar, index) => bar.map((note, beat) => note === null ? null : (index % 4 === 3 && beat === 6 ? note + 7 : note))),
    ...b,
    ...a.map((bar, index) => index === 7 ? [7, null, null, null, null, null, null, null] : bar.map((note, beat) => note === null ? null : (index < 4 && beat === 0 ? note + 7 : note))),
  ];
  return Object.freeze({ id, name, bpm, root, scale, mood, bars: 32 as const,
    harmony: Object.freeze([...harmony, ...harmony, ...harmony.slice(4), ...harmony.slice(0, 4), ...harmony.slice(0, 7), 0]),
    melody: Object.freeze(melody.map(bar => Object.freeze(bar))),
  });
}

export const TRACKS: readonly TrafficTrack[] = Object.freeze([
  score('city', 'Café au carrefour', 104, 60, major, 'city', [0, 5, 1, 4, 2, 5, 1, 4], [
    [7, null, 9, 8, null, 7, 5, null], [4, null, 7, null, 9, 8, 7, null],
    [8, null, 10, 9, null, 8, 6, null], [6, 8, null, 10, 9, null, 8, null],
    [9, null, 11, null, 10, 9, 7, 6], [7, null, 5, null, 4, 5, 7, null],
    [8, null, 6, 5, null, 6, 8, 10], [9, null, 8, null, 7, null, 4, null],
  ], [
    [11, null, 10, 9, null, 7, 9, null], [12, 11, null, 9, 7, null, 9, null],
    [10, null, 8, null, 6, 8, 10, 11], [10, null, 8, 6, null, 4, 6, null],
    [9, null, 7, 6, null, 4, 6, 7], [9, null, 7, null, 5, null, 4, null],
    [6, 8, null, 10, 8, null, 6, 5], [4, null, 6, null, 8, 6, 7, null],
  ]),
  score('coast', 'La route des embruns', 96, 62, major, 'coast', [0, 3, 4, 0, 5, 1, 4, 0], [
    [7, null, null, 9, 11, null, 9, null], [10, null, 9, null, 7, null, null, 5],
    [8, null, null, 10, 11, null, 10, null], [9, null, 7, null, null, 4, 7, null],
    [9, null, null, 7, 5, null, 7, null], [8, null, 6, null, null, 3, 6, null],
    [6, null, 8, null, 10, null, 8, null], [7, null, null, null, 4, null, 7, null],
  ], [
    [11, null, null, 12, 14, null, 12, null], [12, null, 10, null, 9, null, 7, null],
    [11, null, 10, null, null, 8, 6, null], [7, null, null, 9, 11, null, 7, null],
    [12, null, 11, null, 9, null, 7, null], [10, null, null, 8, 6, null, 8, null],
    [11, null, 10, null, 8, null, 6, null], [7, null, null, null, 9, null, 7, null],
  ]),
  score('bossa', 'Bossa sous les palmiers', 108, 65, major, 'bossa', [0, 0, 1, 4, 2, 5, 1, 4], [
    [9, null, 7, 4, null, 7, null, 9], [11, null, 9, null, 7, null, 4, 5],
    [6, null, 8, null, 10, 9, null, 8], [8, null, 6, 4, null, 6, null, 8],
    [9, null, 7, 6, null, 7, null, 9], [7, null, 5, null, 4, null, 5, 7],
    [8, null, 6, 3, null, 6, null, 8], [6, null, 4, null, 6, 8, null, 7],
  ], [
    [11, null, 12, null, 14, 12, null, 11], [9, null, 11, 9, null, 7, null, 4],
    [10, null, 11, null, 13, 11, null, 10], [8, null, 10, 8, null, 6, null, 4],
    [9, null, 11, 9, null, 7, null, 6], [7, null, 9, null, 12, null, 11, 9],
    [10, null, 8, 6, null, 3, null, 6], [8, null, 6, null, 4, 6, null, 7],
  ]),
  score('neon', 'Les néons du soir', 100, 57, dorian, 'neon', [0, 5, 3, 6, 0, 5, 1, 4], [
    [7, null, 11, null, 9, null, 8, null], [9, 11, null, 12, null, 11, 9, null],
    [10, null, 7, null, 5, null, 7, 8], [6, null, 9, null, 11, null, 9, null],
    [7, null, 9, null, 11, 12, null, 11], [12, null, 9, null, 7, null, 5, null],
    [8, null, 11, null, 10, null, 8, 6], [8, null, 6, null, 4, null, 7, null],
  ], [
    [14, null, 11, null, 12, null, 11, 9], [12, null, 14, null, 16, null, 14, null],
    [12, null, 10, null, 7, 10, null, 12], [13, null, 11, null, 9, null, 6, null],
    [11, null, 9, null, 7, null, 9, 11], [12, null, 11, null, 9, null, 7, null],
    [10, null, 8, null, 6, null, 8, 10], [11, null, 8, null, 6, null, 7, null],
  ]),
  score('drift', 'Dernier virage, au calme', 90, 60, minor, 'drift', [0, 3, 5, 4, 0, 2, 3, 4], [
    [7, null, null, null, 9, null, 11, null], [10, null, null, 9, null, null, 7, null],
    [12, null, null, null, 11, null, 9, null], [8, null, null, 6, null, null, 4, null],
    [7, null, null, 9, null, null, 11, null], [9, null, null, null, 7, null, 6, null],
    [7, null, null, 5, null, null, 3, null], [6, null, null, null, 8, null, 7, null],
  ], [
    [11, null, null, null, 14, null, 12, null], [12, null, null, 10, null, null, 9, null],
    [12, null, null, null, 9, null, 7, null], [11, null, null, 8, null, null, 6, null],
    [9, null, null, null, 7, null, 4, null], [11, null, null, 9, null, null, 7, null],
    [10, null, null, null, 7, null, 5, null], [8, null, null, 6, null, null, 7, null],
  ]),
]);

type SoundKind = 'move' | 'undo' | 'win' | 'select';
interface Voice { source: AudioScheduledSourceNode; nodes: AudioNode[]; music: boolean; }
const frequency = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
const degreePitch = (track: TrafficTrack, degree: number): number => track.root + track.scale[((degree % 7) + 7) % 7]! + Math.floor(degree / 7) * 12;
const clamp = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** A small look-ahead transport: level changes never recreate or restart it. */
export class TrafficAudio {
  public onTrackChange?: (track: TrafficTrack, index: number) => void;
  private context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private musicGate?: GainNode;
  private effectsBus?: GainNode;
  private noise?: AudioBuffer;
  private timer?: ReturnType<typeof setInterval>;
  private voices = new Set<Voice>();
  private trackIndex = 0;
  private trackStartAt = 0;
  private offset = 0;
  private cursorIndex = 0;
  private cursorStep = 0;
  private cursorAt = 0;
  private playing = false;
  private requested = false;
  private destroyed = false;
  private volume = 0.6;
  private sfxVolume = 0.7;
  private muted = false;
  private unlockPromise?: Promise<void>;

  constructor(onTrackChange?: (track: TrafficTrack, index: number) => void) {
    this.onTrackChange = onTrackChange;
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibilityChanged);
  }

  getTrack(): TrafficTrack { return TRACKS[this.trackIndex]!; }

  /** Call from a pointer/keyboard interaction. Construction never starts an AudioContext. */
  async unlock(): Promise<void> {
    if (this.destroyed) return;
    if (this.unlockPromise) return this.unlockPromise;
    this.unlockPromise = this.prepare().finally(() => { this.unlockPromise = undefined; });
    return this.unlockPromise;
  }

  private async prepare(): Promise<void> {
    try {
      if (!this.context) {
        const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
        const Context = scope.AudioContext ?? scope.webkitAudioContext;
        if (!Context) return;
        const context = new Context();
        this.context = context;
        this.master = context.createGain(); this.master.gain.value = this.muted ? 0 : 1;
        this.musicBus = context.createGain(); this.musicBus.gain.value = this.volume * 0.36;
        this.musicGate = context.createGain(); this.musicGate.gain.value = 0;
        this.effectsBus = context.createGain(); this.effectsBus.gain.value = this.sfxVolume * 0.32;
        this.musicGate.connect(this.musicBus); this.musicBus.connect(this.master);
        this.effectsBus.connect(this.master); this.master.connect(context.destination);
        this.noise = context.createBuffer(1, Math.floor(context.sampleRate * 0.3), context.sampleRate);
        const data = this.noise.getChannelData(0);
        let seed = 42719;
        for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 0x80000000 - 1; }
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (!this.destroyed && this.requested && !this.hidden()) this.startTransport();
    } catch {
      // Unsupported/blocked audio leaves the puzzle fully playable, with no retry timer.
    }
  }

  play(): void { this.requested = true; this.startTransport(); }
  resume(): void { this.play(); }
  pause(): void { this.requested = false; this.stopTransport(); }

  next(): void {
    if (this.destroyed) return;
    this.stopTransport();
    this.trackIndex = (this.trackIndex + 1) % TRACKS.length; this.offset = 0;
    this.onTrackChange?.(this.getTrack(), this.trackIndex);
    this.startTransport();
  }

  setVolume(value: number): void {
    this.volume = clamp(value);
    this.changeGain(this.musicBus, this.volume * 0.36);
  }

  setSfxVolume(value: number): void { this.sfxVolume = clamp(value); this.changeGain(this.effectsBus, this.sfxVolume * 0.32); }
  setMuted(value: boolean): void { this.muted = value; this.changeGain(this.master, value ? 0 : 1); }

  private hidden(): boolean { return typeof document !== 'undefined' && document.visibilityState === 'hidden'; }
  private visibilityChanged = (): void => {
    if (this.hidden()) {
      this.stopTransport();
      this.stopVoices(false);
    } else if (this.requested) this.startTransport();
  };

  private changeGain(node: GainNode | undefined, value: number): void {
    if (!node || !this.context) return;
    const now = this.context.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setTargetAtTime(value, now, 0.015);
  }

  private duration(index: number): number { return 32 * 4 * 60 / TRACKS[index]!.bpm; }

  private startTransport(): void {
    const context = this.context;
    if (!this.requested || this.playing || this.destroyed || this.hidden() || !context || context.state !== 'running') return;
    const eighth = 30 / this.getTrack().bpm;
    this.trackStartAt = context.currentTime + 0.055 - this.offset;
    this.cursorIndex = this.trackIndex;
    this.cursorStep = Math.ceil(this.offset / eighth - 0.000001);
    this.cursorAt = this.trackStartAt + this.cursorStep * eighth;
    this.playing = true;
    this.changeGain(this.musicGate, 1);
    this.tick();
    this.timer = setInterval(() => this.tick(), 75);
  }

  private syncTrack(now: number): void {
    while (now >= this.trackStartAt + this.duration(this.trackIndex)) {
      this.trackStartAt += this.duration(this.trackIndex);
      this.trackIndex = (this.trackIndex + 1) % TRACKS.length;
      this.onTrackChange?.(this.getTrack(), this.trackIndex);
    }
  }

  private tick(): void {
    const context = this.context;
    if (!context || !this.playing) return;
    const now = context.currentTime;
    this.syncTrack(now);
    // Tab throttling must never produce a burst of all the notes missed while backgrounded.
    if (this.cursorAt < now - 0.2) {
      const eighth = 30 / this.getTrack().bpm;
      this.cursorIndex = this.trackIndex;
      this.cursorStep = Math.ceil((now - this.trackStartAt + 0.025) / eighth);
      this.cursorAt = this.trackStartAt + this.cursorStep * eighth;
    }
    let scheduled = 0;
    while (this.cursorAt < now + 0.19 && scheduled++ < 12) {
      if (this.cursorStep >= 256) { this.cursorStep = 0; this.cursorIndex = (this.cursorIndex + 1) % TRACKS.length; }
      const track = TRACKS[this.cursorIndex]!, eighth = 30 / track.bpm;
      this.musicStep(track, this.cursorStep, Math.max(now + 0.005, this.cursorAt), eighth);
      this.cursorAt += eighth; this.cursorStep++;
    }
  }

  private stopTransport(): void {
    if (this.timer !== undefined) { clearInterval(this.timer); this.timer = undefined; }
    if (this.playing && this.context) {
      this.syncTrack(this.context.currentTime);
      this.offset = Math.max(0, this.context.currentTime - this.trackStartAt);
    }
    this.playing = false;
    this.changeGain(this.musicGate, 0);
    this.stopVoices(true);
  }

  private musicStep(track: TrafficTrack, step: number, at: number, eighth: number): void {
    const bar = Math.floor(step / 8), beat = step % 8, section = Math.floor(bar / 8);
    const chord = track.harmony[bar]!, melody = track.melody[bar]![beat];
    const swing = track.mood === 'city' && beat % 2 === 1 ? eighth * 0.15 : 0;
    const time = at + swing;
    const sparse = bar < 2 || bar === 31;
    const leadShape: OscillatorType = track.mood === 'bossa' ? 'triangle' : 'sine';
    if (melody !== null && melody !== undefined) {
      let held = 1;
      while (beat + held < 8 && track.melody[bar]![beat + held] === null) held++;
      const duration = Math.min(held * eighth * 0.88, eighth * (track.mood === 'drift' ? 3.2 : 2.4));
      this.tone(degreePitch(track, melody), time, duration, track.mood === 'drift' ? 0.11 : 0.14, leadShape, true, 0.16);
      if (track.mood === 'coast' || track.mood === 'neon') this.tone(degreePitch(track, melody) + 12, time, duration * 0.65, 0.018, 'sine', true, -0.2);
    }
    // Bass lines change with the harmony and leave space around the melody.
    const bassBeats = track.mood === 'bossa' ? [0, 3, 4, 7] : track.mood === 'drift' ? [0, 4] : [0, 3, 4, 6];
    if (bassBeats.includes(beat) && (!sparse || beat === 0 || beat === 4)) {
      const bassDegree = chord + (beat >= 4 ? 4 : 0);
      this.tone(degreePitch(track, bassDegree) - 24, time, eighth * 1.35, 0.2, 'triangle', true, -0.08);
    }
    const chordBeats = track.mood === 'bossa' ? [0, 3, 6] : track.mood === 'city' ? [0, 5] : [0];
    if (chordBeats.includes(beat)) {
      const pad = track.mood === 'neon' || track.mood === 'drift';
      const length = pad ? eighth * 7.5 : eighth * (track.mood === 'bossa' ? 1.3 : 2.4);
      for (const [index, interval] of [0, 2, 4, 6].entries()) {
        this.tone(degreePitch(track, chord + interval) - 12, time + index * 0.011, length,
          pad ? 0.035 : 0.047, pad ? 'sine' : 'triangle', true, -0.42 + index * 0.24, pad);
      }
    }
    if (sparse) return;
    if (beat === 0 || beat === 4 || (track.mood === 'neon' && beat === 6)) this.kick(time, track.mood === 'drift' ? 0.12 : 0.17);
    if (beat === 2 || beat === 6) this.percussion(time, track.mood === 'bossa' ? 0.025 : 0.045, 1400, 0.09, -0.25);
    if (track.mood !== 'drift' || beat % 2 === 1) {
      const hat = section === 2 ? 0.022 : 0.015;
      this.percussion(time, beat % 2 ? hat : hat * 0.65, 6500, 0.035, 0.35);
    }
  }

  private register(source: AudioScheduledSourceNode, nodes: AudioNode[], music: boolean): boolean {
    if ([...this.voices].filter(voice => voice.music === music).length >= (music ? 48 : 12)) {
      for (const node of [source, ...nodes]) node.disconnect();
      return false;
    }
    const voice = { source, nodes, music };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
    return true;
  }

  private tone(midi: number, at: number, duration: number, volume: number, shape: OscillatorType, music: boolean, pan = 0, pad = false): void {
    const context = this.context, bus = music ? this.musicGate : this.effectsBus;
    if (!context || !bus || this.destroyed) return;
    const oscillator = context.createOscillator(), envelope = context.createGain(), panner = context.createStereoPanner();
    oscillator.type = shape; oscillator.frequency.value = frequency(midi); panner.pan.value = pan;
    const attack = pad ? 0.12 : 0.008, end = at + Math.max(duration, attack + 0.02);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(volume, at + attack);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * (pad ? 0.65 : 0.22)), end);
    envelope.gain.linearRampToValueAtTime(0, end + 0.08);
    oscillator.connect(envelope); envelope.connect(panner); panner.connect(bus);
    if (!this.register(oscillator, [envelope, panner], music)) return;
    oscillator.start(at); oscillator.stop(end + 0.09);
  }

  private kick(at: number, volume: number): void {
    const context = this.context;
    if (!context || !this.musicGate) return;
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.frequency.setValueAtTime(105, at); oscillator.frequency.exponentialRampToValueAtTime(43, at + 0.13);
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(volume, at + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.18); envelope.gain.linearRampToValueAtTime(0, at + 0.2);
    oscillator.connect(envelope); envelope.connect(this.musicGate);
    if (!this.register(oscillator, [envelope], true)) return;
    oscillator.start(at); oscillator.stop(at + 0.21);
  }

  private percussion(at: number, volume: number, cutoff: number, length: number, pan: number): void {
    const context = this.context;
    if (!context || !this.noise || !this.musicGate) return;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain(), panner = context.createStereoPanner();
    source.buffer = this.noise; filter.type = 'highpass'; filter.frequency.value = cutoff; panner.pan.value = pan;
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(volume, at + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + length); envelope.gain.linearRampToValueAtTime(0, at + length + 0.015);
    source.connect(filter); filter.connect(envelope); envelope.connect(panner); panner.connect(this.musicGate);
    if (!this.register(source, [filter, envelope, panner], true)) return;
    source.start(at); source.stop(at + length + 0.025);
  }

  sfx(kind: SoundKind): void {
    const context = this.context;
    if (!context || context.state !== 'running' || this.destroyed || this.hidden() || this.muted || this.sfxVolume === 0) return;
    const at = context.currentTime + 0.008;
    if (kind === 'win') {
      for (const [index, note] of [72, 76, 79, 84].entries()) this.tone(note, at + index * 0.11, index === 3 ? 0.6 : 0.19, 0.27, 'sine', false, index * 0.1 - 0.15);
    } else if (kind === 'move') {
      this.tone(55, at, 0.06, 0.18, 'triangle', false);
      this.tone(62, at + 0.035, 0.065, 0.13, 'sine', false);
    } else if (kind === 'undo') {
      this.tone(69, at, 0.08, 0.15, 'sine', false); this.tone(62, at + 0.07, 0.1, 0.13, 'sine', false);
    } else this.tone(76, at, 0.06, 0.12, 'sine', false);
  }

  private stopVoices(music: boolean): void {
    const now = this.context?.currentTime ?? 0;
    for (const voice of [...this.voices]) {
      if (voice.music !== music) continue;
      // Individual release envelopes avoid a discontinuity when skipping or leaving the page.
      const gain = voice.nodes.find(node => 'gain' in node) as GainNode | undefined;
      if (gain) {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, 0.006);
      }
      try { voice.source.stop(now + 0.025); } catch { /* An already-ended source is harmless. */ }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.requested = false; this.stopTransport(); this.stopVoices(false); this.destroyed = true;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibilityChanged);
    for (const voice of this.voices) { voice.source.onended = null; voice.source.disconnect(); for (const node of voice.nodes) node.disconnect(); }
    this.voices.clear();
    for (const node of [this.musicGate, this.musicBus, this.effectsBus, this.master]) node?.disconnect();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => undefined);
  }
}
