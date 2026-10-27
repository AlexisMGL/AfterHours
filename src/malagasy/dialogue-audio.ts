import type { AudioAsset } from './types';

/** A complete utterance, never a collection of words stitched into a sentence. */
export interface DialogueAudioCue { key: string; audioId: string; text: string }
export type DialogueAudioState = 'idle' | 'loading' | 'playing' | 'ended' | 'blocked' | 'error';
export interface DialogueAudioEvent {
  state: DialogueAudioState; turnKey?: string; assetId?: string; message?: string;
}
export type DialogueAudioResult = 'ended' | 'cancelled' | 'muted' | 'blocked' | 'error' | 'unavailable';

/** Small injectable surface keeps browser policy and cancellation behavior testable. */
export interface DialogueAudioMedia {
  playbackRate: number; muted: boolean; preservesPitch?: boolean;
  play(): Promise<void>; pause(): void; load(): void; removeAttribute(name: string): void;
  addEventListener(type: 'ended' | 'error', listener: EventListener): void;
  removeEventListener(type: 'ended' | 'error', listener: EventListener): void;
}
export interface DialogueAudioOptions {
  createAudio?: (url: string) => DialogueAudioMedia;
  onStatus?: (event: DialogueAudioEvent) => void;
}

/** Ignore presentation only; do not turn a different phrase or isolated quote into a match. */
export function normalizeDialogueTranscript(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('fr').replace(/[’‘]/g, "'")
    .trim().replace(/\s+/g, ' ').replace(/[.!?…]+$/u, '').trim();
}

/** Synthetic speech is an explicit, technically generated asset, never a native review. */
export function isPlayableDialogueAsset(asset: AudioAsset): boolean {
  return asset.status === 'verified' || asset.status === 'synthetic'
    && asset.verification === 'model-generated' && !!asset.model?.trim();
}

/**
 * Owns one voice at a time and plays complete, attributed recordings or explicitly synthetic files.
 * It never relabels synthetic speech as native-reviewed, changes pitch or awards learning progress.
 */
export class DialogueAudioPlayer {
  private readonly assets: Map<string, AudioAsset>;
  private readonly createAudio: (url: string) => DialogueAudioMedia;
  private contextKey: string | null = null;
  private seen = new Map<string, string>();
  private queue: DialogueAudioCue[] = [];
  private epoch = 0;
  private drainingEpoch: number | null = null;
  private active: { media: DialogueAudioMedia; cancel(): void } | null = null;
  private isMuted = false;
  private playbackRate = 1;
  onStatus?: (event: DialogueAudioEvent) => void;

  constructor(assets: readonly AudioAsset[], options: DialogueAudioOptions = {}) {
    this.assets = new Map(assets.map(asset => [asset.id, { ...asset }]));
    this.createAudio = options.createAudio ?? (url => new Audio(url));
    this.onStatus = options.onStatus;
  }

  hasPlayable(cue: DialogueAudioCue): boolean {
    const asset = this.assets.get(cue.audioId);
    return !!asset && isPlayableDialogueAsset(asset) && !!asset.url.trim() && !!asset.sourceId.trim()
      && !!normalizeDialogueTranscript(cue.text)
      && normalizeDialogueTranscript(asset.transcript) === normalizeDialogueTranscript(cue.text);
  }

  /**
   * Call after rendering a scene/question. Root supplies autoplay:true only after learner input.
   * Even a muted/disabled sync consumes visible keys, so unmute or re-render cannot speak them again.
   */
  sync(contextKey: string, cues: readonly DialogueAudioCue[], options: { autoplay?: boolean } = {}): void {
    if (contextKey !== this.contextKey) {
      this.cancelPlayback(); this.contextKey = contextKey; this.seen.clear();
    }
    for (const cue of cues) {
      const signature = `${cue.audioId}\u0000${normalizeDialogueTranscript(cue.text)}`;
      if (this.seen.get(cue.key) === signature) continue;
      this.seen.set(cue.key, signature);
      if (options.autoplay && !this.isMuted && this.hasPlayable(cue)) this.queue.push({ ...cue });
    }
    this.drain();
  }

  /** Manual replay interrupts any dialogue queue and never starts another voice over it. */
  replay(cue: DialogueAudioCue, rate?: number): Promise<DialogueAudioResult> {
    this.cancelPlayback();
    if (rate !== undefined) this.rate = rate;
    if (this.isMuted) return Promise.resolve('muted');
    const epoch = this.epoch;
    this.drainingEpoch = epoch;
    return this.playOne(cue, epoch).then(result => {
      if (this.drainingEpoch === epoch) { this.drainingEpoch = null; this.drain(); }
      return result;
    });
  }

  stop(): void {
    this.cancelPlayback(); this.contextKey = null; this.seen.clear();
    this.emit({ state: 'idle' });
  }
  set muted(value: boolean) {
    this.isMuted = value;
    if (value) { this.cancelPlayback(); this.emit({ state: 'idle' }); }
  }
  get muted(): boolean { return this.isMuted; }
  set rate(value: number) {
    this.playbackRate = Number.isFinite(value) ? Math.max(.5, Math.min(1.5, value)) : 1;
    if (this.active) this.active.media.playbackRate = this.playbackRate;
  }
  get rate(): number { return this.playbackRate; }

  private emit(event: DialogueAudioEvent): void { this.onStatus?.(event); }
  private cancelPlayback(): void {
    this.epoch++; this.queue = []; this.drainingEpoch = null;
    this.active?.cancel(); this.active = null;
  }
  private dispose(media: DialogueAudioMedia): void {
    try { media.pause(); media.removeAttribute('src'); media.load(); }
    catch { /* A detached or failed media element still must release its queue slot. */ }
  }

  private drain(): void {
    const epoch = this.epoch;
    if (this.drainingEpoch === epoch || this.isMuted || !this.queue.length) return;
    this.drainingEpoch = epoch;
    void (async () => {
      while (this.epoch === epoch && !this.isMuted && this.queue.length) {
        const result = await this.playOne(this.queue.shift()!, epoch);
        if (result === 'blocked' || result === 'error') { if (this.epoch === epoch) this.queue = []; break; }
      }
      if (this.drainingEpoch === epoch) this.drainingEpoch = null;
    })();
  }

  private playOne(cue: DialogueAudioCue, epoch: number): Promise<DialogueAudioResult> {
    if (epoch !== this.epoch) return Promise.resolve('cancelled');
    if (this.isMuted) return Promise.resolve('muted');
    const event = (state: DialogueAudioState, message?: string): DialogueAudioEvent => ({ state, turnKey: cue.key, assetId: cue.audioId, ...(message ? { message } : {}) });
    if (!this.hasPlayable(cue)) {
      this.emit(event('error', 'Aucun enregistrement vérifié ne correspond à cette phrase.'));
      return Promise.resolve('unavailable');
    }
    let media: DialogueAudioMedia;
    try { media = this.createAudio(this.assets.get(cue.audioId)!.url); }
    catch {
      this.emit(event('error', 'Le lecteur vocal est indisponible sur cet appareil.'));
      return Promise.resolve('error');
    }
    media.playbackRate = this.playbackRate; media.muted = false; media.preservesPitch = true;
    return new Promise(resolve => {
      let finished = false;
      const cleanup = (): void => {
        media.removeEventListener('ended', ended); media.removeEventListener('error', failed);
      };
      const finish = (result: DialogueAudioResult, status?: DialogueAudioState, message?: string): void => {
        if (finished) return;
        finished = true; cleanup();
        if (this.active?.media === media) this.active = null;
        this.dispose(media);
        if (status && epoch === this.epoch) this.emit(event(status, message));
        resolve(result);
      };
      const ended: EventListener = () => finish('ended', 'ended');
      const failed: EventListener = () => finish('error', 'error', 'Cet enregistrement ne peut pas être chargé. Touchez le haut-parleur pour réessayer.');
      media.addEventListener('ended', ended); media.addEventListener('error', failed);
      this.active = { media, cancel: () => finish('cancelled') };
      this.emit(event('loading'));
      if (finished || epoch !== this.epoch) { finish('cancelled'); return; }
      // Browsers normally reject a stopped pending play. Also silence a late fulfilled promise.
      try {
        void Promise.resolve(media.play()).then(() => {
          if (finished || epoch !== this.epoch || this.isMuted) { this.dispose(media); return; }
          this.emit(event('playing'));
        }).catch((error: unknown) => {
          const blocked = !!error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError';
          finish(blocked ? 'blocked' : 'error', blocked ? 'blocked' : 'error', blocked
            ? 'La lecture automatique est bloquée. Touchez le haut-parleur pour écouter.'
            : 'La lecture a échoué. Touchez le haut-parleur pour réessayer.');
        });
      } catch (error) {
        const blocked = !!error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError';
        finish(blocked ? 'blocked' : 'error', blocked ? 'blocked' : 'error', blocked
          ? 'La lecture automatique est bloquée. Touchez le haut-parleur pour écouter.'
          : 'La lecture a échoué. Touchez le haut-parleur pour réessayer.');
      }
    });
  }
}
