import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { recordingForTurn } from '../src/malagasy/voice-bank';
import { DIALOGUE_RECORDINGS, VOICE_SOURCES } from '../src/malagasy/voice-recordings';
import { CONTENT } from '../src/malagasy/content';
import type { AudioAsset, DialogueTurn } from '../src/malagasy/types';

interface Reference {
  id: string; word: string; file: string; sourceUrl: string; author: string; performer: string;
  license: string; licenseUrl: string; downloadUrl: string; duration: number; bytes: number; sha256: string;
}
const references = JSON.parse(readFileSync(resolve('src/malagasy/recording-references.json'), 'utf8')) as Reference[];
const turn = (text: string, speaker: DialogueTurn['speaker'] = 'lova', audioId?: string): DialogueTurn => ({ text, speaker, translation: '', ...(audioId ? { audioId } : {}) });

describe('Auditable Malagasy pronunciation recordings', () => {
  it('ships the original files with matching byte counts, audio signatures and provenance hashes', () => {
    expect(references).toHaveLength(8);
    expect(DIALOGUE_RECORDINGS).toHaveLength(references.length);
    for (const reference of references) {
      const asset = DIALOGUE_RECORDINGS.find(item => item.id === reference.id)!;
      expect(asset, reference.id).toBeDefined();
      const filename = resolve('public', reference.file.replace(/^\//, ''));
      expect(filename.startsWith(resolve('public') + '\\') || filename.startsWith(resolve('public') + '/')).toBe(true);
      const data = readFileSync(filename);
      expect(data.byteLength, reference.word).toBe(reference.bytes);
      expect(createHash('sha256').update(data).digest('hex'), reference.word).toBe(reference.sha256);
      expect(data.subarray(0, 4).toString('ascii')).toBe(reference.file.endsWith('.ogg') ? 'OggS' : 'RIFF');
      if (reference.file.endsWith('.wav')) expect(data.subarray(8, 12).toString('ascii')).toBe('WAVE');
      expect(reference.duration).toBeGreaterThan(.1);
      expect(reference.duration).toBeLessThan(5);
      expect(asset.url).toBe(reference.file);
      expect(asset.transcript).toBe(reference.word);
      expect(asset.status).toBe('verified');
      expect(asset.verification).toBe('published-pronunciation');
      expect(asset.performer).toBe(reference.performer);
    }
  });

  it('retains redistribution attribution and the actual pronunciation sources in the credits registry', () => {
    const portable = JSON.parse(readFileSync(resolve('public/malagasy/voices/attributions.json'), 'utf8'));
    expect(portable).toEqual(references);
    for (const reference of references) {
      expect(reference.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(reference.downloadUrl).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
      expect(reference.license).toMatch(/^CC BY-SA (3|4)\.0$/);
      expect(reference.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\/licenses\/by-sa\/(3|4)\.0$/);
      expect(reference.author).not.toBe('');
      const source = VOICE_SOURCES.find(item => item.id === reference.id)!;
      expect(source.url).toBe(reference.sourceUrl);
      expect(source.license).toContain(reference.licenseUrl);
      expect(source.author).toContain(reference.author);
      expect(CONTENT.sources.find(item => item.id === assetSource(reference.id))).toEqual(source);
    }
  });

  it('matches complete known phrases for either character without fabricating two speaker genders', () => {
    for (const speaker of ['lova', 'mia'] as const) {
      expect(recordingForTurn(turn('  SALAMA ! ', speaker), DIALOGUE_RECORDINGS)?.id).toBe('audio-commons-salama');
      expect(recordingForTurn(turn('Tonga soa!', speaker), DIALOGUE_RECORDINGS)?.id).toBe('audio-commons-tonga-soa');
      expect(recordingForTurn(turn('Tsia.', speaker), DIALOGUE_RECORDINGS)?.id).toBe('audio-commons-tsia');
    }
    expect(DIALOGUE_RECORDINGS.every(asset => asset.character === 'any')).toBe(true);
  });

  it('never stitches fragments, reads a gap or substitutes another phrase for an explicit recording', () => {
    for (const text of ['Salama! Tonga soa!', 'Misaotra, tompoko.', 'Eny, mpiofana aho.', 'Aza fady', 'Salama…', '« salama »', 'Mia no anarako.', '…']) {
      expect(recordingForTurn(turn(text), DIALOGUE_RECORDINGS), text).toBeUndefined();
    }
    expect(recordingForTurn(turn('Salama!', 'lova', 'audio-commons-misaotra'), DIALOGUE_RECORDINGS)).toBeUndefined();
    expect(recordingForTurn(turn('Sàlama'), DIALOGUE_RECORDINGS)).toBeUndefined();
  });

  it('prefers a reviewed character-specific file and refuses pending or wrong-character overrides', () => {
    const common = DIALOGUE_RECORDINGS[0];
    const male: AudioAsset = { ...common, id: 'voice.lova.salama', character: 'lova' };
    const female: AudioAsset = { ...common, id: 'voice.mia.salama', character: 'mia' };
    const pending: AudioAsset = { ...common, id: 'voice.pending', status: 'pending', character: 'mia' };
    const bank = [common, male, female, pending];
    expect(recordingForTurn(turn('Salama', 'lova'), bank)?.id).toBe(male.id);
    expect(recordingForTurn(turn('Salama', 'mia'), bank)?.id).toBe(female.id);
    expect(recordingForTurn(turn('Salama', 'mia', male.id), bank)).toBeUndefined();
    expect(recordingForTurn(turn('Salama', 'mia', pending.id), bank)).toBeUndefined();
    expect(recordingForTurn(turn('Salama', 'mia'), [male])).toBeUndefined();
  });
});

function assetSource(id: string): string { return DIALOGUE_RECORDINGS.find(asset => asset.id === id)!.sourceId; }
