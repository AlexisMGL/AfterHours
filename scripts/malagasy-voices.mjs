#!/usr/bin/env node
/** Offline voice authoring. Never import credentials or generated drafts into the browser app. */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const DEFAULT_PLAN = 'src/malagasy/voice-plan.json';
const DEFAULT_MODEL = 'gemini-2.5-pro-tts';
const VOICES = Object.freeze({ lova: 'Puck', mia: 'Kore' });
const MAX_PLAN_BYTES = 1_000_000;
const MAX_AUDIO_BYTES = 12_000_000;
const SUPPORTED_MODELS = new Set(['gemini-2.5-pro-tts', 'gemini-2.5-flash-tts', 'gemini-2.5-flash-lite-preview-tts', 'gemini-3.1-flash-tts-preview']);
export const PROVIDER_SOURCE = 'https://docs.cloud.google.com/text-to-speech/docs/gemini-tts';

function invalid(message) { throw new Error(message); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }

/** File paths are identifiers chosen by authors, never provider-supplied output paths. */
export function safeTarget(directory, filename) {
  if (typeof filename !== 'string' || filename.length > 160 || !/^[a-z0-9][a-z0-9._/-]*\.wav$/i.test(filename)
    || filename.split('/').some(part => part === '..' || part === '.' || part === '') || isAbsolute(filename)) {
    invalid('Nom de fichier audio invalide : utiliser un chemin relatif .wav sans remontée de dossier.');
  }
  const root = resolve(directory), target = resolve(root, filename), inside = relative(root, target);
  if (!inside || inside.startsWith('..') || isAbsolute(inside)) invalid('Le fichier audio sort du dossier de brouillons.');
  return target;
}

export function parsePlan(json) {
  if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_PLAN_BYTES) invalid('Plan trop volumineux.');
  let data;
  try { data = JSON.parse(json); } catch { invalid('Le plan de voix doit être un JSON valide.'); }
  if (!plain(data) || data.schemaVersion !== 1 || !Array.isArray(data.recordings)
    || data.recordings.length === 0 || data.recordings.length > 500) invalid('Plan de voix v1 invalide.');
  const ids = new Set(), filenames = new Set();
  const recordings = data.recordings.map(entry => {
    if (!plain(entry) || typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(entry.id)
      || ids.has(entry.id) || !['lova', 'mia'].includes(entry.character) || typeof entry.text !== 'string'
      || !entry.text.trim() || Buffer.byteLength(entry.text) > 1000 || /[\u0000-\u001f<>]/u.test(entry.text)
      || /[«»…]|\.{3}|https?:\/\//u.test(entry.text) || !/\p{L}/u.test(entry.text)) {
      invalid('Entrée invalide : ID unique, personnage connu et réplique complète sans ellipse requis.');
    }
    safeTarget('.', entry.filename);
    const filename = entry.filename.toLocaleLowerCase('en');
    if (filenames.has(filename)) invalid('Deux répliques utilisent le même fichier.');
    if (entry.voice !== undefined && (typeof entry.voice !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(entry.voice))) {
      invalid('Identifiant de voix invalide.');
    }
    ids.add(entry.id); filenames.add(filename);
    return { id: entry.id, character: entry.character, text: entry.text.normalize('NFC').trim(), filename: entry.filename,
      voice: entry.voice ?? VOICES[entry.character] };
  });
  return { schemaVersion: 1, recordings };
}

/** Provider support is a generation capability, not a pronunciation review. */
export function createInventory(plan, model = DEFAULT_MODEL) {
  return { schemaVersion: 1, provider: 'google-cloud', model, languageCode: 'mg-MG',
    source: PROVIDER_SOURCE, status: 'pending',
    reviewRequired: 'Écoute de chaque fichier par une personne malgachophone ; aucun brouillon ne vaut validation.',
    recordings: plan.recordings.map(entry => ({ ...entry, status: 'pending', generated: false,
      textSha256: sha256(entry.text), fileSha256: null, reviewedBy: null, reviewedAt: null })) };
}

export function buildCloudRequest(entry, model = DEFAULT_MODEL) {
  if (!SUPPORTED_MODELS.has(model)) invalid('Modèle non documenté pour ce workflow Cloud TTS. Vérifier la documentation avant de l’ajouter.');
  return {
    input: { text: entry.text, prompt: 'Speak only the supplied text in clear standard Malagasy as used in Antananarivo. Use a calm natural conversational pace. Do not translate, add words, spell out the text, or read these instructions aloud.' },
    // model_name follows the current Cloud Gemini-TTS REST guide, not the newer Gemini API.
    voice: { languageCode: 'mg-MG', name: entry.voice, model_name: model },
    audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000 },
  };
}

/** Cloud LINEAR16 output includes a WAV header. Reject other formats instead of relabelling them. */
export function decodeCloudWave(payload) {
  if (!plain(payload) || typeof payload.audioContent !== 'string' || payload.audioContent.length > MAX_AUDIO_BYTES * 1.4
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.audioContent)) invalid('Réponse audio Cloud invalide.');
  const wave = Buffer.from(payload.audioContent, 'base64');
  if (wave.length < 46 || wave.length > MAX_AUDIO_BYTES || wave.toString('ascii', 0, 4) !== 'RIFF'
    || wave.toString('ascii', 8, 12) !== 'WAVE' || wave.readUInt32LE(4) + 8 !== wave.length) {
    invalid('Le fournisseur n’a pas renvoyé un fichier WAV complet.');
  }
  let position = 12, format = null, sampleBytes = 0;
  while (position + 8 <= wave.length) {
    const name = wave.toString('ascii', position, position + 4), length = wave.readUInt32LE(position + 4);
    const start = position + 8;
    if (start + length > wave.length) invalid('Le fichier WAV est tronqué.');
    if (name === 'fmt ' && length >= 16) {
      format = { encoding: wave.readUInt16LE(start), channels: wave.readUInt16LE(start + 2),
        sampleRate: wave.readUInt32LE(start + 4), bits: wave.readUInt16LE(start + 14) };
    }
    if (name === 'data') sampleBytes += length;
    position = start + length + (length % 2);
  }
  if (!format || format.encoding !== 1 || format.channels !== 1 || format.bits !== 16
    || format.sampleRate !== 24000 || sampleBytes < 2400) invalid('WAV attendu : PCM mono 16 bits à 24 kHz, avec un contenu sonore.');
  return wave;
}

export async function synthesizeDraft(entry, { token, project, model = DEFAULT_MODEL, request = fetch, wait = ms => new Promise(done => setTimeout(done, ms)) }) {
  if (!token || /[\r\n]/u.test(token) || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project ?? '')) {
    invalid('Définir GOOGLE_CLOUD_ACCESS_TOKEN et GOOGLE_CLOUD_PROJECT pour générer les brouillons.');
  }
  const body = JSON.stringify(buildCloudRequest(entry, model));
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await request('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000),
        headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': project, 'Content-Type': 'application/json' }, body,
      });
    } catch { invalid('La requête Cloud TTS a échoué ou expiré. Aucun secret n’est affiché.'); }
    if ((response.status === 429 || response.status === 503) && attempt === 0) { await wait(1500); continue; }
    if (!response.ok) invalid(`Cloud TTS a refusé la génération (HTTP ${response.status}). Vérifier API, modèle, droits et facturation.`);
    let payload;
    try { payload = await response.json(); } catch { invalid('Réponse Cloud TTS illisible.'); }
    return decodeCloudWave(payload);
  }
  invalid('Génération Cloud TTS impossible.');
}

function cliOptions(arguments_) {
  const command = arguments_.shift() ?? 'inventory', result = { command, plan: DEFAULT_PLAN, model: DEFAULT_MODEL, provider: 'google-cloud', limit: 500 };
  const keys = { '--plan': 'plan', '--out-dir': 'out', '--provider': 'provider', '--model': 'model', '--id': 'id', '--limit': 'limit' };
  if (command === '--help' || command === 'help') return { command: 'help' };
  if (!['inventory', 'generate'].includes(command)) invalid('Commande attendue : inventory ou generate.');
  while (arguments_.length) {
    const flag = arguments_.shift(), key = keys[flag], value = arguments_.shift();
    if (!key || !value || value.startsWith('--')) invalid(`Argument invalide : ${flag}.`);
    result[key] = key === 'limit' ? Number(value) : value;
  }
  if (result.provider !== 'google-cloud' || !SUPPORTED_MODELS.has(result.model)) invalid('Utiliser le provider google-cloud et un modèle Cloud TTS documenté.');
  if (!Number.isInteger(result.limit) || result.limit < 1 || result.limit > 500) invalid('La limite doit être comprise entre 1 et 500.');
  return result;
}

async function emptyOutput(directory) {
  const target = resolve(directory);
  await mkdir(target, { recursive: true });
  if ((await readdir(target)).length > 0) invalid('Choisir un dossier de sortie vide : aucun enregistrement existant ne sera remplacé.');
  return target;
}

export async function main(arguments_ = process.argv.slice(2)) {
  const options = cliOptions([...arguments_]);
  if (options.command === 'help') {
    process.stdout.write('Voix malgaches — préparation hors ligne\n\n  node scripts/malagasy-voices.mjs inventory [--plan chemin.json] [--out-dir dossier-vide]\n  node scripts/malagasy-voices.mjs generate --out-dir dossier-vide [--id ID] [--limit 2]\n\nProvider : google-cloud ; modèle : gemini-2.5-pro-tts (configurable --model).\nAuthentification : GOOGLE_CLOUD_ACCESS_TOKEN et GOOGLE_CLOUD_PROJECT, uniquement dans l’environnement.\nChaque fichier généré reste pending jusqu’à une relecture malgachophone et une vérification des droits.\n');
    return;
  }
  let json;
  try { json = await readFile(resolve(options.plan), 'utf8'); } catch { invalid('Plan de voix introuvable. Vérifier --plan.'); }
  const plan = parsePlan(json);
  if (options.id) plan.recordings = plan.recordings.filter(entry => entry.id === options.id);
  plan.recordings = plan.recordings.slice(0, options.limit);
  if (!plan.recordings.length) invalid('Aucune réplique sélectionnée.');
  const inventory = createInventory(plan, options.model);
  if (options.command === 'inventory' && !options.out) { process.stdout.write(JSON.stringify(inventory, null, 2) + '\n'); return; }
  if (!options.out) invalid('Définir un dossier de brouillons avec --out-dir.');
  // Validate credentials before creating files or making any billable request.
  const token = process.env.GOOGLE_CLOUD_ACCESS_TOKEN, project = process.env.GOOGLE_CLOUD_PROJECT;
  if (options.command === 'generate' && (!token || !project)) invalid('Définir GOOGLE_CLOUD_ACCESS_TOKEN et GOOGLE_CLOUD_PROJECT dans l’environnement local.');
  const output = await emptyOutput(options.out), manifestPath = resolve(output, 'manifest.pending.json');
  inventory.createdAt = new Date().toISOString();
  await writeFile(manifestPath, JSON.stringify(inventory, null, 2) + '\n', { flag: 'wx' });
  if (options.command === 'inventory') { process.stdout.write(`${inventory.recordings.length} répliques à enregistrer. Manifeste pending créé.\n`); return; }
  for (const [index, entry] of inventory.recordings.entries()) {
    const wave = await synthesizeDraft(entry, { token, project, model: options.model });
    const target = safeTarget(output, entry.filename);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, wave, { flag: 'wx' });
    entry.generated = true; entry.fileSha256 = sha256(wave);
    await writeFile(manifestPath, JSON.stringify(inventory, null, 2) + '\n');
    process.stdout.write(`${index + 1}/${inventory.recordings.length} : ${entry.id} — brouillon à relire.\n`);
  }
  process.stdout.write('Génération terminée. Aucun fichier n’est déclaré vérifié ni activé dans l’app.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : 'Échec du workflow de voix.'}\n`); process.exitCode = 1; });
}
