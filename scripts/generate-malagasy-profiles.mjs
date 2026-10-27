#!/usr/bin/env node
/** Offline pitch differentiation. This is one model with processed timbres, not two native voices. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const root = resolve('public');
const output = resolve(root, 'malagasy/voices/profiles');
const semitones = 2;
const pitch = 2 ** (semitones / 12);

function inspectWave(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('WAV attendu.');
  let rate = 0, samples;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > bytes.length) throw new Error('WAV tronqué.');
    const type = bytes.toString('ascii', offset, offset + 4);
    if (type === 'fmt ') {
      if (bytes.readUInt16LE(start) !== 1 || bytes.readUInt16LE(start + 2) !== 1 || bytes.readUInt16LE(start + 14) !== 16) throw new Error('PCM mono 16 bits attendu.');
      rate = bytes.readUInt32LE(start + 4);
    }
    if (type === 'data') samples = bytes.subarray(start, start + size);
    offset = start + size + size % 2;
  }
  if (rate !== 16000 || !samples?.length) throw new Error('Échantillons 16 kHz absents.');
  let peak = 0, energy = 0;
  for (let i = 0; i < samples.length; i += 2) {
    const value = samples.readInt16LE(i) / 32767;
    peak = Math.max(peak, Math.abs(value)); energy += value * value;
  }
  if (peak < .01 || peak > .99 || Math.sqrt(energy / (samples.length / 2)) < .001) throw new Error('Signal silencieux ou saturé.');
  return { duration: samples.length / 2 / rate, sampleRate: rate, peak };
}

async function main() {
  let ffmpeg;
  try { ffmpeg = require(resolve('.tools/voice-processing/node_modules/ffmpeg-static')); }
  catch { throw new Error('Installer l’outil auteur : npm install --prefix .tools/voice-processing ffmpeg-static@5.3.0'); }
  const version = execFileSync(ffmpeg, ['-version'], { encoding: 'utf8' }).split(/\r?\n/)[0];
  const source = JSON.parse(await readFile(resolve(root, 'malagasy/voices/mms/manifest.json'), 'utf8'));
  const sourceModule = resolve('src/malagasy/voice-profiles.ts');
  const current = await readFile(sourceModule, 'utf8');
  const suffix = current.slice(current.indexOf('export const PROFILE_VOICE_SOURCES:'));
  if (!suffix.startsWith('export')) throw new Error('Sources des profils absentes.');
  let previous = { recordings: [] };
  try { previous = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8')); } catch { /* First generation. */ }
  await mkdir(output, { recursive: true });
  const recordings = [];
  for (const entry of source.recordings) {
    // User-reported model error: keep the human Azafady intact for both characters.
    if (entry.transcript.toLocaleLowerCase('fr').replace(/[.!?]+$/u, '') === 'azafady') continue;
    const input = resolve(root, entry.url.replace(/^\//, ''));
    if (!input.startsWith(root + sep)) throw new Error('Entrée hors du dossier public.');
    const inputBytes = await readFile(input);
    if (hash(inputBytes) !== entry.sha256) throw new Error(`Empreinte source incorrecte : ${entry.id}`);
    const id = `${entry.id}-mia`, url = `/malagasy/voices/profiles/${id}.wav`;
    const file = resolve(output, `${id}.wav`);
    const filter = `rubberband=pitch=${pitch}:tempo=1:formant=preserved:pitchq=quality,alimiter=limit=0.95:level=false,apad,atrim=duration=${entry.duration}`;
    const cached = previous.recordings.find(record => record.id === id && record.sourceSha256 === entry.sha256 && record.filter === filter);
    if (cached && !process.argv.includes('--force')) {
      try { if (hash(await readFile(file)) === cached.sha256) { recordings.push(cached); continue; } } catch { /* Regenerate. */ }
    }
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-af', filter, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-map_metadata', '-1', file], { stdio: 'pipe' });
    const bytes = await readFile(file), signal = inspectWave(bytes);
    if (Math.abs(signal.duration - entry.duration) > 1 / 16000) throw new Error('Le traitement a changé la durée de la réplique.');
    recordings.push({ id, url, transcript: entry.transcript, character: 'mia', sourceId: 'mms-malagasy-mia',
      status: 'synthetic', verification: 'model-generated', model: source.model,
      processing: { originalAssetId: entry.id, pitchSemitones: semitones, tempo: 1 },
      sourceSha256: entry.sha256, filter, bytes: bytes.length, sha256: hash(bytes), ...signal });
  }
  const manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), tool: version,
    documentation: 'https://ffmpeg.org/ffmpeg-filters.html#rubberband', pitchSemitones: semitones, tempo: 1,
    model: source.model, modelRevision: source.modelRevision, license: source.license, nativeSpeakerReviewed: false, recordings };
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const assets = recordings.map(({ id, url, transcript, character, sourceId, status, verification, model, processing }) => ({ id, url, transcript, character, sourceId, status, verification, model, processing }));
  await writeFile(sourceModule, `import type { AudioAsset, Source } from './types';\n\n/** Generated Mia timbre: same model, +2 semitones, original tempo. */\nexport const PROFILE_RECORDINGS: AudioAsset[] = ${JSON.stringify(assets, null, 2)};\n\n${suffix}`);
  console.log(JSON.stringify({ profiles: recordings.length, pitchSemitones: semitones, tempo: 1, bytes: recordings.reduce((total, entry) => total + entry.bytes, 0) }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
