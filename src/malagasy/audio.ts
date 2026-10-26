import type { AudioAsset } from './types';

/** Linguistic audio is accepted only via the verified manifest; never fallback to browser TTS. */
export class MalagasyAudio {
  private player: HTMLAudioElement | null = null;
  private currentId: string | null = null;
  private isMuted = false;
  onStatus?: (status: 'loading' | 'playing' | 'paused' | 'ended' | 'error', message?: string) => void;
  constructor(private assets: AudioAsset[]) {}
  async play(id: string, rate = 1): Promise<void> {
    const asset = this.assets.find(item => item.id === id && item.status === 'verified');
    if (!asset) throw new Error('Aucun enregistrement vérifié disponible pour cette expression.');
    if (this.currentId !== id || !this.player) {
      this.stop();
      this.currentId = id;
      this.player = new Audio(asset.url);
      this.player.addEventListener('ended', () => this.onStatus?.('ended'));
      this.player.addEventListener('error', () => this.onStatus?.('error', 'Cet enregistrement ne peut pas être lu. Réessayez.'));
    }
    this.player.muted = this.isMuted;
    this.player.playbackRate = Math.max(.5, Math.min(1.5, rate));
    this.onStatus?.('loading');
    try { await this.player.play(); this.onStatus?.('playing'); }
    catch (error) { this.onStatus?.('error', 'La lecture a échoué. Touchez Écouter pour réessayer.'); throw error; }
  }
  pause(): void { this.player?.pause(); this.onStatus?.('paused'); }
  stop(): void { if (this.player) { this.player.pause(); this.player.removeAttribute('src'); this.player.load(); this.player = null; } this.currentId = null; }
  set muted(value: boolean) { this.isMuted = value; if (this.player) this.player.muted = value; }
}

let context: AudioContext | undefined;
function feedbackContext(): AudioContext | undefined {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    return context;
  } catch { return undefined; }
}

/** A bell has its own attack and decaying partials, rather than a frequency glide. */
function bell(audio: BaseAudioContext, frequency: number, when: number, length: number, strength: number): void {
  const partials: [number, number, OscillatorType][] = [[1, 1, 'sine'], [2.01, .18, 'sine'], [1, .2, 'triangle']];
  for (const [ratio, volume, type] of partials) {
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency * ratio, when);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(strength * volume, when + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, when + length);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(when); oscillator.stop(when + length + .015);
  }
}

/** Original UI motif: two crisp ascending bells; never used as language audio. */
export function feedbackSound(correct: boolean, muted: boolean, combo = 1): void {
  if (muted) return;
  const audio = feedbackContext();
  if (!audio) return;
  try {
    const start = audio.currentTime + .006;
    if (correct) {
      // F5 → C6: the second note arrives with a fresh, brighter bell attack.
      const lift = Math.min(3, Math.max(0, combo - 1)) * .003;
      bell(audio, 698.456, start, .22, .055 + lift);
      bell(audio, 1046.502, start + .125, .34, .069 + lift);
    } else {
      // A quiet, rounded falling pair signals a correction without a harsh buzzer.
      bell(audio, 349.228, start, .16, .029);
      bell(audio, 293.665, start + .085, .22, .024);
    }
  } catch { /* Audio restrictions never prevent answering an exercise. */ }
}

/** A distinct closing cadence makes the end of a lesson or whole unit audible. */
export function completionSound(muted: boolean, unitComplete = false): void {
  if (muted) return;
  const audio = feedbackContext();
  if (!audio) return;
  try {
    const notes = unitComplete ? [523.251, 659.255, 783.991, 1046.502, 1318.51] : [523.251, 659.255, 1046.502];
    const step = unitComplete ? .115 : .12;
    for (const [index, frequency] of notes.entries()) {
      bell(audio, frequency, audio.currentTime + .008 + index * step,
        index === notes.length - 1 ? .4 : .2, index === notes.length - 1 ? .074 : .043);
    }
  } catch { /* Completing a lesson must remain possible on devices without Web Audio. */ }
}
