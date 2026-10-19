import type { MapId } from '../core/types';

type ThemeId = MapId | 'menu';
type Voice = 'lead' | 'bass' | 'pad' | 'arp';
interface Composition {
  bpm: number;
  wave: OscillatorType;
  bass: number[];
  chords: number[][];
  a: number[][];
  b: number[][];
  style: 'pop'|'action'|'tribal'|'industrial'|'nautical'|'menu';
}

// Original scores, in MIDI notes. Each row is one bar of eighth notes; -1 is a rest.
// A and B each contain two four-bar phrases. The arrangement is A / A variation / B / A finale.
// No sampled recordings, external assets, recognisable melodies or generated two-note loops.
export const COMPOSITIONS: Record<ThemeId, Composition> = {
  menu: {
    bpm: 112, wave: 'triangle', style: 'menu', bass: [48, 45, 41, 43, 48, 45, 41, 43],
    chords: [[60,64,67],[57,60,64],[53,57,60],[55,59,62],[60,64,67],[57,60,64],[53,57,60],[55,59,62]],
    a: [[72,-1,76,79,76,-1,74,72],[69,-1,72,76,79,76,72,-1],[77,-1,76,72,69,72,74,76],[74,71,67,-1,71,74,79,-1],[72,76,79,84,83,79,76,-1],[81,79,76,72,69,-1,72,76],[77,76,74,72,69,72,77,76],[74,-1,71,67,69,71,74,-1]],
    b: [[84,-1,79,76,79,-1,83,84],[81,-1,76,72,76,79,81,-1],[77,81,84,81,79,77,76,72],[74,-1,79,83,81,79,74,-1],[76,79,84,86,84,-1,79,76],[81,84,88,84,81,79,76,72],[77,-1,81,84,86,84,81,77],[79,77,74,71,67,-1,71,74]],
  },
  mall: {
    bpm: 128, wave: 'square', style: 'pop', bass: [38,35,31,33,38,35,31,33],
    chords: [[62,66,69],[59,62,66],[55,59,62],[57,61,64],[62,66,69],[59,62,66],[55,59,62],[57,61,64]],
    a: [[74,78,81,-1,78,76,74,-1],[71,74,78,81,83,81,78,74],[79,-1,78,74,71,74,78,79],[76,73,69,-1,73,76,81,-1],[74,78,81,86,85,81,78,76],[83,81,78,74,71,-1,74,78],[79,78,76,74,71,74,79,78],[76,-1,73,69,71,73,76,81]],
    b: [[86,-1,81,78,81,83,85,86],[83,81,78,74,78,-1,81,83],[79,83,86,88,86,83,79,-1],[81,-1,85,88,85,81,76,73],[86,85,81,78,76,78,81,-1],[83,-1,86,90,88,86,83,81],[79,78,74,71,74,78,79,83],[81,79,76,73,69,-1,73,76]],
  },
  airport: {
    bpm: 142, wave: 'sawtooth', style: 'action', bass: [40,36,43,38,40,36,45,47],
    chords: [[64,67,71],[60,64,67],[55,59,62],[62,66,69],[64,67,71],[60,64,67],[57,60,64],[59,63,66]],
    a: [[76,-1,79,83,86,83,79,76],[72,76,79,83,84,83,79,76],[79,78,74,71,74,78,79,-1],[78,-1,81,86,85,81,78,74],[76,79,83,88,86,83,79,-1],[84,83,79,76,72,76,79,83],[81,84,88,84,81,79,76,72],[83,78,75,71,75,78,83,-1]],
    b: [[88,-1,83,79,83,86,88,90],[84,88,91,88,84,-1,83,79],[86,83,79,74,79,83,86,-1],[90,86,81,78,81,-1,86,90],[88,86,83,79,76,79,83,86],[84,-1,83,79,76,72,76,79],[81,84,88,93,91,88,84,81],[83,81,78,75,71,-1,75,78]],
  },
  jungle: {
    bpm: 118, wave: 'triangle', style: 'tribal', bass: [45,41,43,40,45,41,38,40],
    chords: [[57,60,64],[53,57,60],[55,59,62],[52,55,59],[57,60,64],[53,57,60],[50,53,57],[52,56,59]],
    a: [[81,-1,88,84,86,-1,81,79],[77,84,-1,81,89,-1,84,81],[79,-1,86,83,88,86,-1,79],[76,83,-1,79,81,-1,76,-1],[81,88,84,-1,93,91,88,84],[89,-1,81,84,-1,88,84,81],[86,93,-1,89,86,-1,81,84],[83,-1,80,88,-1,83,80,76]],
    b: [[72,76,-1,81,-1,84,81,-1],[77,-1,72,81,-1,84,81,77],[74,79,-1,83,-1,86,83,79],[71,-1,76,79,83,-1,79,76],[76,81,-1,84,88,-1,86,81],[77,-1,84,81,89,88,-1,84],[74,81,77,-1,86,-1,89,86],[76,80,-1,83,88,-1,83,80]],
  },
  factory: {
    bpm: 134, wave: 'sawtooth', style: 'industrial', bass: [42,38,45,40,42,38,47,37],
    chords: [[54,57,61],[50,54,57],[57,61,64],[52,56,59],[54,57,61],[50,54,57],[59,62,66],[49,53,56]],
    a: [[66,66,-1,73,78,-1,76,73],[74,-1,69,74,-1,78,81,-1],[69,69,-1,76,81,-1,85,83],[68,-1,71,76,80,76,-1,71],[78,78,-1,85,90,-1,88,85],[86,-1,81,78,-1,74,78,81],[71,71,-1,78,83,86,-1,90],[77,-1,80,85,83,80,-1,73]],
    b: [[85,-1,-1,90,88,85,81,-1],[86,-1,90,93,-1,90,86,81],[88,85,-1,81,76,-1,85,88],[92,-1,88,83,-1,80,83,88],[90,-1,85,81,78,-1,-1,85],[86,85,-1,81,78,74,-1,81],[90,-1,86,83,-1,78,83,86],[85,-1,83,80,77,73,-1,77]],
  },
  boat: {
    bpm: 126, wave: 'square', style: 'nautical', bass: [43,39,46,41,43,39,36,38],
    chords: [[55,58,62],[51,55,58],[58,62,65],[53,57,60],[55,58,62],[51,55,58],[48,51,55],[50,54,57]],
    a: [[79,82,-1,86,84,82,79,74],[75,-1,79,82,87,-1,86,82],[82,86,-1,89,86,82,77,82],[81,-1,84,89,88,84,81,-1],[79,82,86,-1,91,89,86,82],[87,-1,86,82,79,-1,75,79],[84,87,-1,91,89,87,84,79],[86,84,81,-1,78,81,86,-1]],
    b: [[86,91,-1,94,93,91,86,-1],[87,-1,91,94,91,87,82,87],[89,94,-1,98,94,89,86,-1],[93,89,84,-1,81,84,89,93],[91,-1,86,82,86,-1,89,91],[87,86,82,79,-1,75,79,82],[84,-1,91,87,96,94,91,87],[86,-1,84,81,78,74,78,81]],
  },
};

/** A small original music sequencer. Audio is created only after a trusted interaction. */
export class AudioManager {
  private context?: AudioContext;
  private musicGain?: GainNode;
  private sfxGain?: GainNode;
  private delay?: DelayNode;
  private noise?: AudioBuffer;
  private musicVolume = 0.55;
  private sfxVolume = 0.7;
  private muted = false;
  private theme: ThemeId = 'menu';
  private playing = false;
  private intense = false;
  private step = 0;
  private nextNote = 0;
  private timer?: ReturnType<typeof setInterval>;
  private musicSources = new Set<AudioScheduledSourceNode>();
  private countdownAt = -1;

  async unlock(): Promise<void> {
    if (!this.context) {
      const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return;
      const context = new Constructor(); this.context = context;
      this.musicGain = context.createGain(); this.sfxGain = context.createGain();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -16; compressor.knee.value = 20; compressor.ratio.value = 3;
      compressor.attack.value = 0.004; compressor.release.value = 0.18;
      this.musicGain.connect(compressor); this.sfxGain.connect(compressor); compressor.connect(context.destination);
      this.delay = context.createDelay(1); this.delay.delayTime.value = 0.23;
      const feedback = context.createGain(); feedback.gain.value = 0.2;
      const wet = context.createGain(); wet.gain.value = 0.12;
      this.delay.connect(feedback); feedback.connect(this.delay); this.delay.connect(wet); wet.connect(this.musicGain);
      this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = this.noise.getChannelData(0); let random = 0x72ec453a;
      for (let i = 0; i < data.length; i++) { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; data[i] = ((random >>> 0) / 0xffffffff) * 2 - 1; }
      this.setVolumes(this.musicVolume, this.sfxVolume, this.muted);
    }
    try { if (this.context.state === 'suspended') await this.context.resume(); } catch { return; }
    if (this.playing && !this.timer) this.startScheduler();
  }

  setVolumes(music: number, sfx: number, muted = false): void {
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.sfxVolume = Math.max(0, Math.min(1, sfx)); this.muted = muted;
    if (!this.context) return;
    this.musicGain?.gain.setTargetAtTime(muted ? 0 : this.musicVolume * 0.75, this.context.currentTime, 0.025);
    this.sfxGain?.gain.setTargetAtTime(muted ? 0 : this.sfxVolume * 0.8, this.context.currentTime, 0.025);
  }

  playTheme(mapId: ThemeId): void {
    if (this.theme === mapId && this.playing) return;
    this.stopMusic(); this.theme = mapId; this.playing = true; this.step = 0;
    if (this.context && this.context.state === 'running') this.startScheduler();
  }

  stopMusic(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined; this.playing = false;
    for (const source of this.musicSources) { try { source.stop(); } catch { /* Already completed. */ } }
    this.musicSources.clear();
  }

  setIntensity(sudden: boolean): void { this.intense = sudden; }

  destroy(): void { this.stopMusic(); void this.context?.close(); this.context = undefined; }

  sfx(type: string): void {
    const context = this.context;
    if (!context || context.state !== 'running' || this.muted || this.sfxVolume === 0) return;
    const t = context.currentTime;
    switch (type) {
      case 'hover': this.effectTone(740, 900, t, 0.035, 'sine', 0.035); break;
      case 'button': case 'select': this.effectTone(440, 880, t, 0.09, 'triangle', 0.1); this.effectTone(1100, 1300, t + 0.04, 0.06, 'sine', 0.05); break;
      case 'bomb': case 'place': this.effectTone(240, 85, t, 0.1, 'triangle', 0.19); this.noiseHit(t, 0.035, 1700, 0.035, false); break;
      case 'countdown': case 'tick':
        if (t - this.countdownAt > 0.18) { this.effectTone(1200, 1400, t, 0.025, 'sine', 0.045); this.countdownAt = t; } break;
      case 'explosion': this.noiseHit(t, 0.38, 1250, 0.26, false); this.effectTone(105, 29, t, 0.4, 'sine', 0.4); this.effectTone(61, 21, t, 0.3, 'triangle', 0.15); break;
      case 'block': this.noiseHit(t, 0.1, 1900, 0.08, false); break;
      case 'pickup': this.effectArpeggio([76, 79, 83, 88], t, 0.055, 'triangle', 0.095); break;
      case 'teleport': this.effectTone(220, 1600, t, 0.18, 'sine', 0.12); this.effectTone(1400, 380, t + 0.12, 0.22, 'triangle', 0.08); break;
      case 'shield': this.effectArpeggio([91, 86, 79], t, 0.04, 'sine', 0.12); this.noiseHit(t, 0.18, 4200, 0.06, true); break;
      case 'kick': this.effectTone(150, 500, t, 0.09, 'triangle', 0.2); this.noiseHit(t, 0.045, 2200, 0.08, false); break;
      case 'death': this.effectArpeggio([76, 72, 67, 60, 48], t, 0.08, 'sawtooth', 0.07); break;
      case 'victory': this.effectArpeggio([72, 76, 79, 84, 79, 84, 88, 91], t, 0.12, 'triangle', 0.14); this.effectArpeggio([60, 64, 67, 72], t + 0.48, 0.24, 'square', 0.035); break;
      case 'defeat': this.effectArpeggio([72, 67, 63, 60, 55, 48], t, 0.17, 'triangle', 0.12); break;
      case 'warning': case 'suddenDeath': this.effectTone(330, 660, t, 0.3, 'sawtooth', 0.065); this.effectTone(330, 660, t + 0.38, 0.3, 'sawtooth', 0.065); this.effectTone(440, 880, t + 0.76, 0.4, 'sawtooth', 0.065); break;
      case 'combo': this.effectArpeggio([79, 83, 86, 91], t, 0.04, 'square', 0.06); break;
    }
  }

  private startScheduler(): void {
    if (!this.context) return;
    this.nextNote = this.context.currentTime + 0.07;
    const schedule = (): void => {
      if (!this.context || this.context.state !== 'running') return;
      // Discard elapsed notes after a background tab resumes, retaining musical position.
      if (this.nextNote < this.context.currentTime - 0.2) this.nextNote = this.context.currentTime + 0.03;
      while (this.nextNote < this.context.currentTime + 0.16) {
        const composition = COMPOSITIONS[this.theme];
        const duration = 60 / composition.bpm / 2 / (this.intense ? 1.06 : 1);
        this.scheduleStep(composition, this.step, this.nextNote, duration);
        this.step = (this.step + 1) % 256; this.nextNote += duration;
      }
    };
    schedule(); this.timer = setInterval(schedule, 25);
  }

  private scheduleStep(c: Composition, step: number, t: number, eighth: number): void {
    const bar = Math.floor(step / 8), beat = step % 8;
    const section = Math.floor(bar / 8), phraseBar = bar % 8;
    const notes = section === 2 ? c.b[phraseBar]! : c.a[phraseBar]!;
    const note = notes[beat]!;
    const chord = c.chords[phraseBar]!;
    if (note >= 0) {
      const length = notes[(beat + 1) % 8] === -1 ? 1.7 : 0.82;
      this.musicNote(note, t, eighth * length, 'lead', c, 0.083);
      // The return phrase grows a quiet high octave, giving the finale its own orchestration.
      if (section === 3 && beat % 2 === 0) this.musicNote(note + 12, t + 0.008, eighth * 0.6, 'arp', c, 0.016);
    }
    const bass = c.bass[phraseBar]! + (beat === 3 || beat === 7 ? 12 : beat === 6 ? 7 : 0);
    if (c.style !== 'menu' || beat % 2 === 0) this.musicNote(bass, t, eighth * 0.75, 'bass', c, c.style === 'industrial' ? 0.16 : 0.12);
    if (beat === 0) for (const pitch of chord) this.musicNote(pitch, t, eighth * 7.6, 'pad', c, 0.023);
    if (section > 0 && beat % 2 === 1) this.musicNote(chord[(beat + phraseBar) % chord.length]! + 12, t, eighth * 0.4, 'arp', c, 0.027);
    const menu = c.style === 'menu';
    if (beat === 0 || beat === 4 || ((c.style === 'action' || c.style === 'industrial') && beat === 6)) this.kick(t, menu ? 0.12 : 0.27);
    if (beat === 2 || beat === 6) {
      this.noiseHit(t, 0.13, c.style === 'industrial' ? 2200 : 3300, menu ? 0.035 : 0.09, true, true);
      this.musicPercussion(175, 120, t, 0.07, menu ? 0.025 : 0.07);
    }
    this.noiseHit(t, beat === 7 ? 0.07 : 0.025, 6700, menu ? 0.012 : beat % 2 ? 0.028 : 0.04, true, true);
    if (c.style === 'tribal' && [1, 3, 5, 7].includes(beat)) this.musicPercussion(beat === 3 ? 290 : 210, 95, t, 0.12, 0.10);
    if (c.style === 'nautical' && beat === 5) this.musicPercussion(320, 180, t, 0.085, 0.06);
    if (c.style === 'industrial' && beat % 2) this.musicNote(66 + (beat % 3) * 7, t, 0.025, 'arp', c, 0.021);
    if (phraseBar === 7 && beat >= 6) {
      this.musicPercussion(230 - beat * 10, 70, t + eighth / 2, 0.10, 0.10);
      this.noiseHit(t + eighth / 2, 0.06, 3400, 0.05, true, true);
    }
    if (this.intense && beat % 2 === 1) this.kick(t + eighth / 2, 0.13);
  }

  private musicNote(midi: number, t: number, duration: number, voice: Voice, c: Composition, volume: number): void {
    const context = this.context!;
    const oscillator = context.createOscillator(), gain = context.createGain(), filter = context.createBiquadFilter();
    oscillator.type = voice === 'bass' ? 'sawtooth' : voice === 'pad' ? 'triangle' : voice === 'arp' ? 'triangle' : c.wave;
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    filter.type = 'lowpass'; filter.frequency.value = voice === 'bass' ? 700 : voice === 'pad' ? 1700 : c.style === 'industrial' ? 2100 : 3500;
    filter.Q.value = voice === 'bass' ? 1.8 : 0.5;
    const attack = voice === 'pad' ? 0.15 : voice === 'lead' ? 0.009 : 0.003;
    gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t + attack);
    gain.gain.exponentialRampToValueAtTime(volume * (voice === 'pad' ? 0.8 : 0.55), t + Math.max(attack + 0.01, duration * 0.6));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.07);
    oscillator.connect(filter); filter.connect(gain); gain.connect(this.musicGain!);
    if (voice === 'lead' || voice === 'arp') gain.connect(this.delay!);
    this.track(oscillator, true, [filter, gain]); oscillator.start(t); oscillator.stop(t + duration + 0.09);
  }

  private kick(t: number, volume: number): void { this.musicPercussion(145, 38, t, 0.17, volume); }

  private musicPercussion(start: number, end: number, t: number, duration: number, volume: number): void {
    const context = this.context!, osc = context.createOscillator(), gain = context.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(start, t); osc.frequency.exponentialRampToValueAtTime(end, t + duration);
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain); gain.connect(this.musicGain!); this.track(osc, true, [gain]); osc.start(t); osc.stop(t + duration + 0.01);
  }

  private noiseHit(t: number, duration: number, frequency: number, volume: number, highpass: boolean, music = false): void {
    const context = this.context!;
    if (!this.noise) return;
    const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
    source.buffer = this.noise; filter.type = highpass ? 'highpass' : 'lowpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter); filter.connect(gain); gain.connect(music ? this.musicGain! : this.sfxGain!);
    this.track(source, music, [filter, gain]); source.start(t, (t * 0.37) % 0.5); source.stop(t + duration + 0.01);
  }

  private effectTone(start: number, end: number, t: number, duration: number, wave: OscillatorType, volume: number): void {
    const context = this.context!, oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = wave; oscillator.frequency.setValueAtTime(start, t); oscillator.frequency.exponentialRampToValueAtTime(end, t + duration);
    gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(volume, t + 0.004); gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    oscillator.connect(gain); gain.connect(this.sfxGain!); this.track(oscillator, false, [gain]); oscillator.start(t); oscillator.stop(t + duration + 0.02);
  }

  private effectArpeggio(notes: number[], t: number, spacing: number, wave: OscillatorType, volume: number): void {
    notes.forEach((note, i) => { const hz = 440 * 2 ** ((note - 69) / 12); this.effectTone(hz, hz * 0.997, t + i * spacing, spacing * 1.7, wave, volume); });
  }

  private track(source: AudioScheduledSourceNode, music: boolean, nodes: AudioNode[]): void {
    if (music) this.musicSources.add(source);
    source.onended = () => { source.disconnect(); for (const node of nodes) node.disconnect(); this.musicSources.delete(source); };
  }
}
