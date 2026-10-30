import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

test('storage errors do not disclose a signed URL in the interface or event log', async () => {
  const old = { xhr: globalThis.XMLHttpRequest, url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  const events = [];
  class FakeXHR { upload = {}; status = 400; responseText = JSON.stringify({message: 'bad https://local/private?token=secret-value'}); open() {} setRequestHeader() {} send() { this.onload(); } abort() {} }
  globalThis.XMLHttpRequest = FakeXHR;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake';
  try {
    const helpers = {}; new Function('require', 'exports', compile('../src/lib/media/upload-error.ts'))(() => ({}), helpers);
    const exports = {}; new Function('require', 'exports', compile('../src/lib/media/upload-video.ts'))(name => name === '@/lib/casting/upload-actions' ? { logCastingUploadEvent: async event => events.push(event) } : helpers, exports);
    let message = '';
    try { await exports.envoyerVideo({ file: { size: 10, type: 'video/mp4' }, signal: new AbortController().signal, onProgress() {}, createSlot: async () => ({ bucket: 'fake', path: 'test', token: 'fake' }), logContext: { source: 'equipe' } }); } catch (error) { message = error.message; }
    assert.ok(message); assert.doesNotMatch(message, /secret-value|https:\/\//); assert.equal(events.length, 1); assert.doesNotMatch(events[0].errorMessage, /secret-value|https:\/\//);
  } finally {
    globalThis.XMLHttpRequest = old.xhr;
    if (old.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = old.url;
    if (old.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = old.key;
  }
});
