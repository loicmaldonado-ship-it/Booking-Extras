import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../src/lib/auth/actions.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function setup(failure) {
  const deleted = [], redirects = [];
  const mocks = {
    'next/headers': { cookies: async () => ({ delete: name => deleted.push(name) }) },
    'next/navigation': { redirect: url => redirects.push(url) },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ auth: { signOut: async () => { if (failure === 'throw') throw new Error('offline'); return { error: failure === 'error' ? { message: 'offline' } : null }; } } }) },
    '@/lib/auth/session-timeout': { SESSION_STARTED_AT_COOKIE: 'session_started_at' },
  };
  const exports = {};
  new Function('require', 'exports', code)(name => mocks[name] ?? {}, exports);
  return { run: () => exports.signOut(), deleted, redirects };
}
test('successful logout redirects after clearing the session marker', async () => { const x = setup(); await x.run(); assert.deepEqual(x.deleted, ['session_started_at']); assert.deepEqual(x.redirects, ['/login']); });
for (const failure of ['error', 'throw']) test(`logout ${failure} reports failure without presenting success`, async () => { const x = setup(failure); assert.match((await x.run()).error, /déconnexion/i); assert.deepEqual(x.deleted, []); assert.deepEqual(x.redirects, []); });
