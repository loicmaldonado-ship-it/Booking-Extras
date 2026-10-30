import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/casting/casting-upload-form.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  async function uploadOnePhoto(');
const end = source.indexOf('\n  function majVideo(', start);
assert.ok(start >= 0 && end > start);
const code = ts.transpileModule(`${source.slice(start, end)}\nreturn uploadOnePhoto;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

test('cancel while preparing a photo prevents a later upload', async () => {
  let finishSlot, uploads = 0;
  const createSlot = () => new Promise(resolve => { finishSlot = resolve; });
  const client = () => ({ storage: { from: () => ({ uploadToSignedUrl: async () => { uploads++; return { error: null }; } }) } });
  const upload = new Function('token', 'createCastingUploadSlot', 'createBrowserSupabaseClient', 'translateUploadErrorMessage', code)('fake', createSlot, client, x => x);
  const controller = new AbortController();
  const pending = upload('Portrait', { type: 'image/jpeg' }, controller.signal);
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  finishSlot({ bucket: 'fake', path: 'fake', token: 'fake' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(uploads, 0);
});

test('successful photo upload returns its path once', async () => {
  let uploads = 0;
  const createSlot = async () => ({ bucket: 'fake', path: 'path', token: 'fake' });
  const client = () => ({ storage: { from: () => ({ uploadToSignedUrl: async () => { uploads++; return { error: null }; } }) } });
  const upload = new Function('token', 'createCastingUploadSlot', 'createBrowserSupabaseClient', 'translateUploadErrorMessage', code)('fake', createSlot, client, x => x);
  assert.equal(await upload('Portrait', { type: 'image/jpeg' }, new AbortController().signal), 'path');
  assert.equal(uploads, 1);
});
