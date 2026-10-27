#!/usr/bin/env node
/** Whole-utterance Malagasy synthesis for the static site. No service key or backend. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
// The same explicit language contract drives authoring and browser selection playback.

const MODEL = 'elloza/mms-tts-mlg-onnx';
const MODEL_REVISION = 'd7a0998aec609849544bbd5813db358948f5b0f0';
const MODEL_HASH = 'a256cb95f9a22f859ec13e402e6849e76de9da539c140e5c9ebdd9c653446a2c';
const OUTPUT = resolve('public/malagasy/voices/mms');
const MANIFEST = resolve(OUTPUT, 'manifest.json');
const hash = data => createHash('sha256').update(data).digest('hex');
export function normalizeTranscript(text) {
  return text.normalize('NFC').toLocaleLowerCase('fr').replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ').replace(/[.!?…]+$/u, '').trim();
}
export function utteranceInventory(content) {
  const turns = [...content.lessons.flatMap(lesson => (lesson.scenes ?? []).flatMap(scene => scene.turns)),
    ...content.exercises.flatMap(exercise => exercise.dialogue ?? []),
    ...content.exercises.flatMap(exercise => {
      const selections = exercise.spokenSelections ?? (exercise.selectionLanguage === 'mg'
        ? exercise.choices ?? exercise.tokens ?? exercise.pairs?.map(pair => pair.left) ?? [] : []);
      return selections.map(text => ({ text }));
    })];
  const unique = new Map();
  for (const turn of turns) {
    if (!turn.text.trim() || /[…_]|\.{3}/u.test(turn.text)) continue;
    const normalized = normalizeTranscript(turn.text);
    const spokenText = turn.text.replace(/[«»]/gu, '').trim();
    if (!unique.has(normalized)) unique.set(normalized, {
      id: `audio-mms-${hash(normalized).slice(0, 16)}`, transcript: turn.text, spokenText,
    });
  }
  return [...unique.values()];
}
export function encodeWave(samples, sampleRate) {
  if (!(samples instanceof Float32Array) || !samples.length || !samples.every(Number.isFinite)
    || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 48000) throw new Error('Sortie de synthèse invalide.');
  const duration = samples.length / sampleRate;
  let peak = 0, energy = 0;
  for (const value of samples) { peak = Math.max(peak, Math.abs(value)); energy += value * value; }
  if (duration < .12 || duration > 30 || peak < .01 || Math.sqrt(energy / samples.length) < .001) throw new Error('Le modèle a produit un fichier silencieux ou de durée anormale.');
  const gain = Math.min(3, .75 / peak), tail = Math.round(sampleRate * .09), length = samples.length + tail;
  const wave = Buffer.alloc(44 + length * 2);
  wave.write('RIFF'); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVE', 8); wave.write('fmt ', 12);
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(sampleRate, 24); wave.writeUInt32LE(sampleRate * 2, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34);
  wave.write('data', 36); wave.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < samples.length; i++) wave.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * gain)) * 32767), 44 + i * 2);
  return { wave, duration: length / sampleRate, peak: peak * gain, gain, sampleRate };
}

async function main() {
  const force = process.argv.includes('--force');
  const moduleFile = resolve('.tools/mms-runtime/node_modules/@huggingface/transformers/dist/transformers.node.mjs');
  let runtime;
  try { runtime = await import(pathToFileURL(moduleFile).href); }
  catch { throw new Error('Installer le runtime auteur isolé : npm install --prefix .tools/mms-runtime @huggingface/transformers@3.8.1. Le modèle est téléchargé une fois, hors du build Netlify.'); }
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  let content;
  try { content = (await server.ssrLoadModule('/src/malagasy/content.ts')).CONTENT; }
  finally { await server.close(); }
  const inventory = utteranceInventory(content);
  const sourceFile = resolve('src/malagasy/synthetic-voices.ts');
  const currentModule = await readFile(sourceFile, 'utf8');
  const sourceStart = currentModule.indexOf('export const SYNTHETIC_VOICE_SOURCES:');
  if (sourceStart < 0) throw new Error('Registre de sources de synthèse absent.');
  const sources = currentModule.slice(sourceStart);
  let previous = { recordings: [] };
  try { previous = JSON.parse(await readFile(MANIFEST, 'utf8')); } catch { /* First authoring run. */ }
  runtime.env.cacheDir = resolve('.tools/mms-cache');
  console.log(`Chargement du modèle malgache FP32 ; ${inventory.length} répliques complètes.`);
  const synthesizer = await runtime.pipeline('text-to-speech', MODEL, { device: 'cpu', dtype: 'fp32', revision: MODEL_REVISION });
  const modelFile = await readFile(resolve('.tools/mms-cache', MODEL, 'onnx/model.onnx'));
  if (hash(modelFile) !== MODEL_HASH) throw new Error('Le modèle téléchargé diffère de la version auditée. Vérifier sa provenance avant génération.');
  await mkdir(OUTPUT, { recursive: true });
  const recordings = [];
  for (const [index, utterance] of inventory.entries()) {
    const filename = `${utterance.id}.wav`, url = `/malagasy/voices/mms/${filename}`;
    const cached = previous.recordings.find(entry => entry.id === utterance.id && entry.transcript === utterance.transcript);
    if (!force && cached) {
      try { if (hash(await readFile(resolve(OUTPUT, filename))) === cached.sha256) { recordings.push(cached); console.log(`${index + 1}/${inventory.length} conservé : ${utterance.transcript}`); continue; } } catch { /* Regenerate missing file. */ }
    }
    const audio = await synthesizer(utterance.spokenText), encoded = encodeWave(audio.audio, audio.sampling_rate);
    await writeFile(resolve(OUTPUT, filename), encoded.wave);
    recordings.push({ ...utterance, url, bytes: encoded.wave.length, sha256: hash(encoded.wave),
      duration: encoded.duration, peak: encoded.peak, appliedGain: encoded.gain, sampleRate: encoded.sampleRate,
      status: 'synthetic', verification: 'model-generated', character: 'any', model: MODEL, sourceId: 'mms-malagasy' });
    console.log(`${index + 1}/${inventory.length} généré (${encoded.duration.toFixed(2)} s) : ${utterance.transcript}`);
  }
  await synthesizer.dispose();
  const manifest = { schemaVersion: 1, model: MODEL, modelRevision: MODEL_REVISION, modelSha256: MODEL_HASH,
    originalModel: 'facebook/mms-tts-mlg', license: 'CC BY-NC 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
    library: '@huggingface/transformers@3.8.1', precision: 'fp32', speakers: 1,
    nativeSpeakerReviewed: false, generatedAt: new Date().toISOString(), recordings };
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  const assets = recordings.map(({ id, url, sourceId, transcript, status, verification, character, model }) => ({ id, url, sourceId, transcript, status, verification, character, model }));
  await writeFile(sourceFile, `import type { AudioAsset, Source } from './types';\n\n/** Generated whole utterances; never relabel as a native-speaker review. */\nexport const SYNTHETIC_RECORDINGS: AudioAsset[] = ${JSON.stringify(assets, null, 2)};\n\n${sources}`);
  console.log(JSON.stringify({ completeUtterances: recordings.length, bytes: recordings.reduce((total, entry) => total + entry.bytes, 0), speakers: 1, nativeSpeakerReviewed: false }));
}

const invoked = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invoked) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
