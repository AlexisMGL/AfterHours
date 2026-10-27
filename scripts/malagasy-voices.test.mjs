import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, createInventory, safeTarget, decodeCloudWave, synthesizeDraft, buildCloudRequest } from './malagasy-voices.mjs';

const phrase = { id: 'voice.lova.salama', character: 'lova', text: 'Salama!', filename: 'lova/salama.wav' };
const plan = () => parsePlan(JSON.stringify({ schemaVersion: 1, recordings: [phrase] }));
function wave() {
  const result = Buffer.alloc(44 + 4800);
  result.write('RIFF', 0); result.writeUInt32LE(result.length - 8, 4); result.write('WAVEfmt ', 8);
  result.writeUInt32LE(16, 16); result.writeUInt16LE(1, 20); result.writeUInt16LE(1, 22);
  result.writeUInt32LE(24000, 24); result.writeUInt32LE(48000, 28); result.writeUInt16LE(2, 32); result.writeUInt16LE(16, 34);
  result.write('data', 36); result.writeUInt32LE(4800, 40); return result;
}

test('inventory remains pending and separates the two documented studio voices', () => {
  const input = parsePlan(JSON.stringify({ schemaVersion: 1, recordings: [phrase, { ...phrase, id: 'voice.mia.salama', character: 'mia', filename: 'mia/salama.wav' }] }));
  const result = createInventory(input);
  assert.deepEqual(result.recordings.map(entry => entry.voice), ['Puck', 'Kore']);
  assert.ok(result.recordings.every(entry => entry.status === 'pending' && entry.reviewedBy === null && !entry.generated));
  assert.equal(buildCloudRequest(input.recordings[0]).voice.languageCode, 'mg-MG');
});

test('the plan rejects path traversal, duplicate IDs/files and incomplete spoken turns', () => {
  for (const filename of ['../escape.wav', 'C:/escape.wav', '/escape.wav', 'lova\\escape.wav']) assert.throws(() => safeTarget('.', filename));
  for (const text of ['…', 'Salama...', '« aho »', '<script>bad</script>']) {
    assert.throws(() => parsePlan(JSON.stringify({ schemaVersion: 1, recordings: [{ ...phrase, text }] })));
  }
  assert.throws(() => parsePlan(JSON.stringify({ schemaVersion: 1, recordings: [phrase, phrase] })));
  assert.throws(() => parsePlan(JSON.stringify({ schemaVersion: 1, recordings: [phrase, { ...phrase, id: 'second' }] })));
});

test('Cloud output must be complete mono PCM WAV at the requested rate', () => {
  const valid = wave();
  assert.deepEqual(decodeCloudWave({ audioContent: valid.toString('base64') }), valid);
  assert.throws(() => decodeCloudWave({ audioContent: Buffer.from('not audio').toString('base64') }));
  const wrongRate = wave(); wrongRate.writeUInt32LE(44100, 24);
  assert.throws(() => decodeCloudWave({ audioContent: wrongRate.toString('base64') }));
  assert.throws(() => decodeCloudWave({ audioContent: valid.subarray(0, 49).toString('base64') }));
});

test('rate limiting is retried once, then valid audio is decoded without changing its review status', async () => {
  let requests = 0, waits = 0;
  const output = await synthesizeDraft(plan().recordings[0], { token: 'fixture-secret', project: 'fixture-project',
    wait: async () => { waits++; }, request: async (_url, init) => {
      requests++;
      assert.equal(init.headers.Authorization, 'Bearer fixture-secret');
      if (requests === 1) return { status: 429, ok: false };
      return { status: 200, ok: true, json: async () => ({ audioContent: wave().toString('base64') }) };
    } });
  assert.equal(requests, 2); assert.equal(waits, 1); assert.ok(Buffer.isBuffer(output));
});

test('provider errors never echo response bodies or transport credentials', async () => {
  const phrase_ = plan().recordings[0], credentials = { token: 'fixture-secret', project: 'fixture-project' };
  await assert.rejects(synthesizeDraft(phrase_, { ...credentials, request: async () => { throw new Error('fixture-secret'); } }), error => !error.message.includes('fixture-secret'));
  await assert.rejects(synthesizeDraft(phrase_, { ...credentials, request: async () => ({ status: 403, ok: false, text: async () => 'fixture-secret' }) }), error => error.message.includes('403') && !error.message.includes('fixture-secret'));
});
