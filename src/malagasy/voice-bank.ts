import type { AudioAsset, DialogueTurn } from './types';
import { DIALOGUE_RECORDINGS } from './voice-recordings';
import { SYNTHETIC_RECORDINGS } from './synthetic-voices';
import { normalizeDialogueTranscript, isPlayableDialogueAsset } from './dialogue-audio';

export const ALL_DIALOGUE_RECORDINGS: AudioAsset[] = [...SYNTHETIC_RECORDINGS, ...DIALOGUE_RECORDINGS];

/** Whole utterance matching only. No fragments, altered pitch, cross-actor voice or browser TTS. */
export function recordingForTurn(turn: DialogueTurn, assets: readonly AudioAsset[] = ALL_DIALOGUE_RECORDINGS): AudioAsset | undefined {
  const text = normalizeDialogueTranscript(turn.text);
  if (!text || /[…_]|\.{3}/u.test(turn.text)) return undefined;
  const matches = assets.filter(asset => isPlayableDialogueAsset(asset)
    && normalizeDialogueTranscript(asset.transcript) === text
    && (asset.character === turn.speaker || asset.character === 'any' || asset.character === undefined));
  if (turn.audioId) return matches.find(asset => asset.id === turn.audioId);
  return matches.find(asset => asset.character === turn.speaker)
    ?? matches.find(asset => asset.status === 'synthetic' && asset.character === 'any')
    ?? matches.find(asset => asset.character === 'any' || asset.character === undefined);
}
