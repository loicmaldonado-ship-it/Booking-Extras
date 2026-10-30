import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../src/lib/media/upload-video.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

test('a logging failure does not retry or fail a completed video upload', async () => {
  const old = { xhr: globalThis.XMLHttpRequest, url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  let sent = 0, slots = 0;
  class FakeXHR { upload = {}; status = 200; open() {} setRequestHeader() {} send() { sent++; this.onload(); } abort() {} }
  globalThis.XMLHttpRequest = FakeXHR;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake';
  try {
    const exports = {};
    new Function('require', 'exports', code)(name => name === '@/lib/casting/upload-actions' ? { logCastingUploadEvent: async () => { throw new Error('offline'); } } : {}, exports);
    const path = await exports.envoyerVideo({ file: { size: 10, type: 'video/mp4' }, signal: new AbortController().signal, onProgress() {}, createSlot: async () => { slots++; return { bucket: 'fake', path: 'test.mp4', token: 'fake' }; }, logContext: { source: 'equipe' } });
    assert.equal(path, 'test.mp4');
    assert.equal(sent, 1);
    assert.equal(slots, 1);
  } finally {
    globalThis.XMLHttpRequest = old.xhr;
    if (old.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = old.url;
    if (old.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = old.key;
  }
});
