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
/** UI feedback is a locally synthesized sound, not a Malagasy pronunciation. */
export function feedbackSound(correct: boolean, muted: boolean): void {
  if (muted) return;
  try {
    context ??= new AudioContext();
    void context.resume();
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(correct ? 660 : 220, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(correct ? 880 : 180, context.currentTime + .12);
    gain.gain.setValueAtTime(.045, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .2);
    oscillator.start(); oscillator.stop(context.currentTime + .22);
  } catch { /* Audio restrictions never prevent answering an exercise. */ }
}
