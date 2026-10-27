import { describe, expect, it } from 'vitest';
import { DialogueAudioPlayer, normalizeDialogueTranscript, type DialogueAudioCue, type DialogueAudioEvent, type DialogueAudioMedia } from '../src/malagasy/dialogue-audio';
import type { AudioAsset } from '../src/malagasy/types';

const assets: AudioAsset[] = [
  { id: 'voice.salama', url: '/audio/salama.ogg', sourceId: 'native-source', transcript: 'Salama', status: 'verified' },
  { id: 'voice.misaotra', url: '/audio/misaotra.ogg', sourceId: 'native-source', transcript: 'Misaotra!', status: 'verified' },
  { id: 'voice.pending', url: '/audio/pending.ogg', sourceId: 'native-source', transcript: 'Veloma', status: 'pending' },
];
const hello: DialogueAudioCue = { key: 'scene-1:0', audioId: 'voice.salama', text: 'Salama!' };
const thanks: DialogueAudioCue = { key: 'scene-1:1', audioId: 'voice.misaotra', text: 'Misaotra!' };
class FakeMedia implements DialogueAudioMedia {
  playbackRate = 1; muted = false; preservesPitch = true;
  plays = 0; pauses = 0; cleared = false; loads = 0;
  readonly listeners = new Map<string, Set<EventListener>>();
  constructor(readonly url: string, private result: () => Promise<void>) {}
  play(): Promise<void> { this.plays++; return this.result(); }
  pause(): void { this.pauses++; }
  load(): void { this.loads++; }
  removeAttribute(name: string): void { if (name === 'src') this.cleared = true; }
  addEventListener(type: 'ended' | 'error', listener: EventListener): void {
    const handlers = this.listeners.get(type) ?? new Set(); handlers.add(listener); this.listeners.set(type, handlers);
  }
  removeEventListener(type: 'ended' | 'error', listener: EventListener): void { this.listeners.get(type)?.delete(listener); }
  fire(type: 'ended' | 'error'): void { for (const listener of this.listeners.get(type) ?? []) listener(new Event(type)); }
}
const tick = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function fixture(play: () => Promise<void> = () => Promise.resolve()) {
  const media: FakeMedia[] = [], events: DialogueAudioEvent[] = [];
  const player = new DialogueAudioPlayer(assets, {
    createAudio: url => { const value = new FakeMedia(url, play); media.push(value); return value; },
    onStatus: event => events.push(event),
  });
  return { player, media, events };
}

describe('Verified full-phrase dialogue playback', () => {
  it('matches only complete reviewed transcripts, preserving meaningful wording and letters', async () => {
    const { player, media } = fixture();
    expect(normalizeDialogueTranscript('  SALAMA!  ')).toBe('salama');
    expect(player.hasPlayable(hello)).toBe(true);
    expect(player.hasPlayable({ ...hello, text: 'Salama, tompoko.' })).toBe(false);
    expect(player.hasPlayable({ ...hello, text: '« Salama »' })).toBe(false);
    expect(player.hasPlayable({ ...hello, text: 'Sàlama' })).toBe(false);
    expect(player.hasPlayable({ key: 'pending', audioId: 'voice.pending', text: 'Veloma!' })).toBe(false);
    expect(await player.replay({ ...hello, text: 'Bonjour' })).toBe('unavailable');
    expect(media).toHaveLength(0);
  });

  it('speaks newly revealed turns once, in sequence, without re-speaking earlier bubbles', async () => {
    const { player, media, events } = fixture();
    player.sync('scene-1', [hello], { autoplay: true }); await tick();
    expect(media).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ state: 'playing', turnKey: hello.key });
    player.sync('scene-1', [hello, thanks], { autoplay: true }); await tick();
    expect(media).toHaveLength(1); // No second voice until the first phrase has ended.
    media[0].fire('ended'); await tick();
    expect(media).toHaveLength(2);
    expect(media[1].url).toBe('/audio/misaotra.ogg');
    media[1].fire('ended'); await tick();
    player.sync('scene-1', [hello, thanks], { autoplay: true }); await tick();
    expect(media).toHaveLength(2);
    expect(events.filter(event => event.state === 'ended').map(event => event.turnKey)).toEqual([hello.key, thanks.key]);
  });

  it('does not start audio before autoplay is explicitly allowed, including repeated renders', async () => {
    const { player, media } = fixture();
    player.sync('scene-1', [hello]);
    player.sync('scene-1', [hello], { autoplay: true }); await tick();
    expect(media).toHaveLength(0);
    const replay = player.replay(hello); await tick();
    expect(media).toHaveLength(1);
    media[0].fire('ended'); expect(await replay).toBe('ended');
  });

  it('cancels the active clip and queued lines on context changes; stale events cannot progress a new scene', async () => {
    const { player, media, events } = fixture();
    player.sync('scene-1', [hello, thanks], { autoplay: true }); await tick();
    player.sync('scene-2', [{ ...hello, key: 'scene-2:0' }], { autoplay: true }); await tick();
    expect(media).toHaveLength(2);
    expect(media[0].cleared).toBe(true);
    media[0].fire('ended'); media[0].fire('error'); await tick();
    expect(media).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ state: 'playing', turnKey: 'scene-2:0' });
    player.stop();
    expect(media[1].cleared).toBe(true);
    media[1].fire('ended'); await tick();
    expect(events.at(-1)).toEqual({ state: 'idle' });
  });

  it('interrupts automatic playback for manual replay, and never overlaps a new revealed phrase', async () => {
    const { player, media } = fixture();
    player.sync('scene-1', [hello, thanks], { autoplay: true }); await tick();
    const replay = player.replay(hello, .75); await tick();
    expect(media).toHaveLength(2);
    expect(media[0].cleared).toBe(true);
    expect(media[1].playbackRate).toBe(.75);
    const third = { ...thanks, key: 'scene-1:2' };
    player.sync('scene-1', [hello, thanks, third], { autoplay: true }); await tick();
    expect(media).toHaveLength(2);
    media[1].fire('ended'); expect(await replay).toBe('ended'); await tick();
    expect(media).toHaveLength(3);
    expect(media[2].playbackRate).toBe(.75);
    player.stop();
  });

  it('silences a play promise that resolves after navigation, without stopping the new voice', async () => {
    const resolvers: (() => void)[] = [];
    const { player, media, events } = fixture(() => new Promise(resolve => resolvers.push(resolve)));
    const old = player.replay(hello); await tick();
    const current = player.replay(thanks); await tick();
    expect(await old).toBe('cancelled');
    resolvers[0](); await tick();
    expect(media[0].pauses).toBeGreaterThanOrEqual(2);
    expect(media[1].pauses).toBe(0);
    expect(events.filter(event => event.state === 'playing')).toHaveLength(0);
    resolvers[1](); await tick();
    expect(events.at(-1)).toMatchObject({ state: 'playing', turnKey: thanks.key });
    media[1].fire('ended'); expect(await current).toBe('ended');
  });

  it('treats autoplay rejection as a recoverable manual-play state, without starting the remaining queue', async () => {
    let blocked = true;
    const { player, media, events } = fixture(() => blocked ? Promise.reject(Object.assign(new Error('Policy'), { name: 'NotAllowedError' })) : Promise.resolve());
    player.sync('scene-1', [hello, thanks], { autoplay: true }); await tick();
    expect(media).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ state: 'blocked', assetId: hello.audioId });
    blocked = false;
    const replay = player.replay(hello); await tick();
    expect(events.at(-1)).toMatchObject({ state: 'playing' });
    media[1].fire('ended'); expect(await replay).toBe('ended');
  });

  it('honors mute immediately and does not replay consumed lines on unmute', async () => {
    const { player, media } = fixture();
    player.sync('scene-1', [hello, thanks], { autoplay: true }); await tick();
    player.muted = true;
    expect(media[0].cleared).toBe(true);
    expect(await player.replay(thanks)).toBe('muted');
    player.muted = false;
    player.sync('scene-1', [hello, thanks], { autoplay: true }); await tick();
    expect(media).toHaveLength(1);
    player.rate = Infinity; expect(player.rate).toBe(1);
    player.rate = .1; expect(player.rate).toBe(.5);
    player.rate = 5; expect(player.rate).toBe(1.5);
  });

  it('reports missing media as an error and releases listeners and queue safely', async () => {
    const { player, media, events } = fixture();
    player.sync('scene-1', [hello, thanks], { autoplay: true }); await tick();
    media[0].fire('error'); await tick();
    expect(events.at(-1)).toMatchObject({ state: 'error', turnKey: hello.key });
    expect(media).toHaveLength(1);
    expect(media[0].listeners.get('ended')?.size).toBe(0);
    expect(media[0].listeners.get('error')?.size).toBe(0);
  });
});
