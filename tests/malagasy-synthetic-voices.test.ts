import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/malagasy/content';
import { SYNTHETIC_RECORDINGS, SYNTHETIC_VOICE_SOURCES } from '../src/malagasy/synthetic-voices';
import { recordingForTurn, recordingForSelection } from '../src/malagasy/voice-bank';
import { PROFILE_RECORDINGS, PROFILE_VOICE_SOURCES } from '../src/malagasy/voice-profiles';
import { spokenSelectionsForExercise } from '../src/malagasy/spoken-selections';
import { normalizeDialogueTranscript } from '../src/malagasy/dialogue-audio';
import { createProgress, introduceLesson, selectMixedExercises } from '../src/malagasy/engine';
import type { AudioAsset, DialogueTurn, Exercise } from '../src/malagasy/types';

interface GeneratedRecording {
  id: string; transcript: string; spokenText: string; url: string; bytes: number; sha256: string;
  duration: number; peak: number; appliedGain: number; sampleRate: number;
  status: string; verification: string; character: string; model: string; sourceId: string;
}
interface GeneratedManifest {
  schemaVersion: number; model: string; modelRevision: string; modelSha256: string;
  originalModel: string; license: string; licenseUrl: string; library: string; precision: string;
  speakers: number; nativeSpeakerReviewed: boolean; generatedAt: string; recordings: GeneratedRecording[];
}
const manifest = JSON.parse(readFileSync(resolve('public/malagasy/voices/mms/manifest.json'), 'utf8')) as GeneratedManifest;
const allTurns = (): DialogueTurn[] => [
  ...CONTENT.lessons.flatMap(lesson => (lesson.scenes ?? []).flatMap(scene => scene.turns)),
  ...CONTENT.exercises.flatMap(exercise => exercise.dialogue ?? []),
];
const complete = (turn: DialogueTurn): boolean => !!turn.text.trim() && !/[…_]|\.{3}/u.test(turn.text);

function waveContent(data: Buffer): { sampleRate: number; samples: number[] } {
  expect(data.toString('ascii', 0, 4)).toBe('RIFF');
  expect(data.toString('ascii', 8, 12)).toBe('WAVE');
  expect(data.readUInt32LE(4) + 8).toBe(data.length);
  let offset = 12, sampleRate = 0, sampleData: Buffer | undefined;
  while (offset + 8 <= data.length) {
    const chunk = data.toString('ascii', offset, offset + 4), size = data.readUInt32LE(offset + 4), start = offset + 8;
    expect(start + size).toBeLessThanOrEqual(data.length);
    if (chunk === 'fmt ') {
      expect(size).toBeGreaterThanOrEqual(16);
      expect(data.readUInt16LE(start)).toBe(1); // PCM, not bytes relabelled as a WAV.
      expect(data.readUInt16LE(start + 2)).toBe(1);
      sampleRate = data.readUInt32LE(start + 4);
      expect(data.readUInt16LE(start + 14)).toBe(16);
    }
    if (chunk === 'data') sampleData = data.subarray(start, start + size);
    offset = start + size + size % 2;
  }
  expect(sampleData).toBeDefined();
  expect(sampleData!.length % 2).toBe(0);
  const samples: number[] = [];
  for (let index = 0; index < sampleData!.length; index += 2) samples.push(sampleData!.readInt16LE(index) / 32767);
  return { sampleRate, samples };
}

describe('Complete generated Malagasy dialogue voices', () => {
  it('covers every complete current dialogue utterance, including quoted coaching words', () => {
    const completeTurns = allTurns().filter(complete);
    const unique = new Set(completeTurns.map(turn => normalizeDialogueTranscript(turn.text)));
    expect(SYNTHETIC_RECORDINGS.length).toBeGreaterThan(20);
    for (const exercise of CONTENT.exercises) for (const text of spokenSelectionsForExercise(exercise)) unique.add(normalizeDialogueTranscript(text));
    expect(SYNTHETIC_RECORDINGS).toHaveLength(unique.size);
    expect(manifest.recordings).toHaveLength(unique.size);
    for (const turn of completeTurns) {
      const asset = recordingForTurn(turn);
      expect(asset, `${turn.speaker}: ${turn.text}`).toBeDefined();
      const corrected = normalizeDialogueTranscript(turn.text) === 'azafady';
      expect(asset!.status, turn.text).toBe(corrected ? 'verified' : 'synthetic');
      expect(asset!.verification).toBe(corrected ? 'published-pronunciation' : 'model-generated');
      expect(normalizeDialogueTranscript(asset!.transcript)).toBe(normalizeDialogueTranscript(turn.text));
    }
    const quotes = completeTurns.filter(turn => /[«»]/u.test(turn.text));
    expect(quotes.length).toBeGreaterThan(0);
    for (const turn of quotes) expect(recordingForTurn(turn)?.status).toBe('synthetic');
    for (const turn of allTurns().filter(turn => !complete(turn))) expect(recordingForTurn(turn), turn.text).toBeUndefined();
  });

  it('pronounces all authored Malagasy selections, including distractors, but never guesses French or missing text', () => {
    let spoken = 0, silent = 0;
    for (const exercise of CONTENT.exercises) {
      const authored = spokenSelectionsForExercise(exercise);
      const visible = [...exercise.choices ?? [], ...exercise.tokens ?? [], ...exercise.pairs?.flatMap(pair => [pair.left, pair.right]) ?? []];
      for (const text of visible) {
        const asset = recordingForSelection(exercise, text);
        if (authored.includes(text)) {
          spoken++;
          expect(asset, `${exercise.id}: ${text}`).toBeDefined();
          expect(normalizeDialogueTranscript(asset!.transcript)).toBe(normalizeDialogueTranscript(text));
        } else { silent++; expect(asset, `${exercise.id}: ${text}`).toBeUndefined(); }
      }
      expect(recordingForSelection(exercise, 'un texte non proposé')).toBeUndefined();
    }
    expect(spoken).toBeGreaterThan(80); expect(silent).toBeGreaterThan(40);
    const mixed = CONTENT.exercises.find(exercise => exercise.id === 'exercise-03-01-b')!;
    expect(recordingForSelection(mixed, 'mpiofana')).toBeDefined();
    expect(recordingForSelection(mixed, 'Un verbe être écrit')).toBeUndefined();
  });

  it('uses the unmodified human Azafady correction in both characters and selected answers', () => {
    for (const speaker of ['lova', 'mia'] as const) {
      const corrected = recordingForTurn({ speaker, text: 'AZAFADY!', translation: '' });
      expect(corrected?.id).toBe('audio-commons-azafady');
      expect(corrected?.url).toBe('/malagasy/voices/commons-azafady.ogg');
      expect(corrected?.processing).toBeUndefined();
    }
    const exercise = CONTENT.exercises.find(item => item.id === 'exercise-01-01-c')!;
    expect(recordingForSelection(exercise, 'Azafady')?.id).toBe('audio-commons-azafady');
    expect(recordingForTurn({ speaker: 'mia', text: 'Azafady, …', translation: '' })).toBeUndefined();
  });

  it('ships a higher Mia timbre with actual different audio, unchanged duration and honest model provenance', () => {
    const profiles = JSON.parse(readFileSync(resolve('public/malagasy/voices/profiles/manifest.json'), 'utf8')) as {
      pitchSemitones: number; tempo: number; nativeSpeakerReviewed: boolean;
      recordings: (AudioAsset & { sha256: string; bytes: number; duration: number; sourceSha256: string })[];
    };
    expect(PROFILE_RECORDINGS).toHaveLength(SYNTHETIC_RECORDINGS.length - 1);
    expect(profiles.recordings).toHaveLength(PROFILE_RECORDINGS.length);
    expect(profiles.nativeSpeakerReviewed).toBe(false);
    for (const asset of PROFILE_RECORDINGS) {
      expect(asset.character).toBe('mia');
      expect(asset.status).toBe('synthetic'); expect(asset.verification).toBe('model-generated');
      expect(asset.processing?.pitchSemitones).toBe(2); expect(asset.processing?.tempo).toBe(1);
      const original = manifest.recordings.find(entry => entry.id === asset.processing?.originalAssetId)!;
      const profile = profiles.recordings.find(entry => entry.id === asset.id)!;
      expect(profile.sourceSha256).toBe(original.sha256);
      const bytes = readFileSync(resolve('public', asset.url.slice(1)));
      expect(bytes.length).toBe(profile.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(profile.sha256);
      expect(profile.sha256).not.toBe(original.sha256);
      const decoded = waveContent(bytes);
      expect(decoded.sampleRate).toBe(16000);
      expect(decoded.samples.length / decoded.sampleRate).toBeCloseTo(original.duration, 5);
      let energy = 0, peak = 0;
      for (const sample of decoded.samples) { energy += sample * sample; peak = Math.max(peak, Math.abs(sample)); }
      expect(peak).toBeLessThan(.99); expect(Math.sqrt(energy / decoded.samples.length)).toBeGreaterThan(.001);
      const mia = recordingForTurn({ speaker: 'mia', text: asset.transcript, translation: '' });
      const lova = recordingForTurn({ speaker: 'lova', text: asset.transcript, translation: '' });
      expect(mia?.id).toBe(asset.id); expect(lova?.id).toBe(original.id);
      expect(CONTENT.audio.find(entry => entry.id === asset.id)).toEqual(asset);
      expect(PROFILE_VOICE_SOURCES.some(source => source.id === asset.sourceId)).toBe(true);
    }
  });

  it('ships playable non-silent PCM audio whose actual bytes and samples match the generation manifest', () => {
    const publicRoot = resolve('public');
    for (const recording of manifest.recordings) {
      const file = resolve(publicRoot, recording.url.replace(/^\//, ''));
      expect(file.startsWith(publicRoot + sep)).toBe(true);
      const bytes = readFileSync(file);
      expect(bytes.length, recording.transcript).toBe(recording.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(recording.sha256);
      const { sampleRate, samples } = waveContent(bytes);
      expect(sampleRate).toBe(16000);
      expect(sampleRate).toBe(recording.sampleRate);
      expect(samples.every(Number.isFinite)).toBe(true);
      const duration = samples.length / sampleRate;
      expect(duration).toBeGreaterThan(.12);
      expect(duration).toBeLessThan(30);
      expect(duration).toBeCloseTo(recording.duration, 5);
      let peak = 0, energy = 0;
      for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
      expect(peak).toBeGreaterThan(.01);
      expect(peak).toBeLessThan(.99);
      expect(Math.sqrt(energy / samples.length)).toBeGreaterThan(.001);
      expect(peak).toBeCloseTo(recording.peak, 3);
      expect(recording.appliedGain).toBeGreaterThan(0);
      expect(recording.appliedGain).toBeLessThanOrEqual(3);
      expect(recording.spokenText).not.toMatch(/[«»]/u);
      expect(recording.spokenText).toBe(recording.transcript.replace(/[«»]/gu, '').trim());
    }
  });

  it('keeps the exact model provenance, noncommercial restriction and single-voice limitation explicit', () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.model).toBe('elloza/mms-tts-mlg-onnx');
    expect(manifest.modelRevision).toBe('d7a0998aec609849544bbd5813db358948f5b0f0');
    expect(manifest.modelSha256).toBe('a256cb95f9a22f859ec13e402e6849e76de9da539c140e5c9ebdd9c653446a2c');
    expect(manifest.originalModel).toBe('facebook/mms-tts-mlg');
    expect(manifest.library).toBe('@huggingface/transformers@3.8.1');
    expect(manifest.precision).toBe('fp32');
    expect(manifest.speakers).toBe(1);
    expect(manifest.nativeSpeakerReviewed).toBe(false);
    expect(new Date(manifest.generatedAt).toISOString()).toBe(manifest.generatedAt);
    expect(manifest.license).toBe('CC BY-NC 4.0');
    expect(manifest.licenseUrl).toBe('https://creativecommons.org/licenses/by-nc/4.0/');
    expect(SYNTHETIC_VOICE_SOURCES.map(source => source.url)).toEqual(expect.arrayContaining([
      'https://huggingface.co/facebook/mms-tts-mlg', 'https://huggingface.co/elloza/mms-tts-mlg-onnx',
    ]));
    expect(SYNTHETIC_VOICE_SOURCES.some(source => source.license.includes(manifest.licenseUrl))).toBe(true);
    for (const asset of SYNTHETIC_RECORDINGS) {
      expect(asset.character).toBe('any');
      expect(asset.model).toBe(manifest.model);
      expect(asset.status).toBe('synthetic');
      expect(asset.verification).toBe('model-generated');
      expect(CONTENT.sources.some(source => source.id === asset.sourceId)).toBe(true);
      expect(CONTENT.audio.find(recording => recording.id === asset.id)).toEqual(asset);
    }
  });

  it('never promotes synthetic dialogue playback to verified listening assessment material', () => {
    const first = CONTENT.lessons[0];
    const progress = introduceLesson(createProgress('2026-10-27T12:00:00.000Z'), first, CONTENT);
    const synthetic = SYNTHETIC_RECORDINGS[0];
    const exercise: Exercise = { ...CONTENT.exercises.find(item => item.id === first.exerciseIds[0])!,
      type: 'listening', audioId: synthetic.id };
    const testing = { ...CONTENT, audio: [synthetic], exercises: [exercise] };
    expect(selectMixedExercises(testing, progress, null, 1)).toEqual([]);
    const reviewed: AudioAsset = { ...synthetic, status: 'verified', verification: 'native-speaker-reviewed' };
    expect(selectMixedExercises({ ...testing, audio: [reviewed] }, progress, null, 1)).toEqual([exercise]);
  });
});
