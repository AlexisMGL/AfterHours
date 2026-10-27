import type { AudioAsset, DialogueTurn, Exercise } from './types';
import { DIALOGUE_RECORDINGS } from './voice-recordings';
import { SYNTHETIC_RECORDINGS } from './synthetic-voices';
import { normalizeDialogueTranscript, isPlayableDialogueAsset } from './dialogue-audio';
import { PROFILE_RECORDINGS } from './voice-profiles';
import { spokenSelectionsForExercise } from './spoken-selections';

export const ALL_DIALOGUE_RECORDINGS: AudioAsset[] = [...SYNTHETIC_RECORDINGS, ...PROFILE_RECORDINGS, ...DIALOGUE_RECORDINGS];

/** Whole utterances only; human correction overrides the model's faulty Azafady. */
export function recordingForTurn(turn: DialogueTurn, assets: readonly AudioAsset[] = ALL_DIALOGUE_RECORDINGS): AudioAsset | undefined {
  const text = normalizeDialogueTranscript(turn.text);
  if (!text || /[…_]|\.{3}/u.test(turn.text)) return undefined;
  const matches = assets.filter(asset => isPlayableDialogueAsset(asset)
    && normalizeDialogueTranscript(asset.transcript) === text
    && (asset.character === turn.speaker || asset.character === 'any' || asset.character === undefined));
  if (turn.audioId) return matches.find(asset => asset.id === turn.audioId);
  if (text === 'azafady') {
    const correction = matches.find(asset => asset.id === 'audio-commons-azafady');
    if (correction) return correction;
  }
  return matches.find(asset => asset.character === turn.speaker)
    ?? matches.find(asset => asset.status === 'synthetic' && asset.character === 'any')
    ?? matches.find(asset => asset.character === 'any' || asset.character === undefined);
}

export function recordingForSelection(exercise: Exercise, text: string, assets: readonly AudioAsset[] = ALL_DIALOGUE_RECORDINGS): AudioAsset | undefined {
  if (!spokenSelectionsForExercise(exercise).includes(text)) return undefined;
  return recordingForTurn({ speaker: 'mia', text, translation: '' }, assets);
}
