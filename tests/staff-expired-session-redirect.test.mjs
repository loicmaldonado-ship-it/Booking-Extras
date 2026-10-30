import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/middleware.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

test('expired staff session redirects with the auth cookie deletion returned by Supabase', async () => {
  const response = () => {
    const values = new Map();
    return { cookies: { set: (...args) => { const cookie = typeof args[0] === 'object' ? args[0] : { name: args[0], value: args[1], ...args[2] }; values.set(cookie.name, cookie); }, delete: name => values.set(name, { name, value: '', maxAge: 0 }), getAll: () => [...values.values()] }, values };
  };
  const NextResponse = { next: () => response(), redirect: url => Object.assign(response(), { url: url.toString() }) };
  const mocks = {
    'next/server': { NextResponse },
    '@supabase/ssr': { createServerClient: (_url, _key, options) => ({ auth: { getUser: async () => ({ data: { user: { id: 'fake' } } }), signOut: async () => { options.cookies.setAll([{ name: 'sb-auth-token', value: '', options: { maxAge: 0, path: '/' } }]); } }, rpc: async () => ({ data: false, error: null }) }) },
    '@/lib/auth/session-timeout': { SESSION_STARTED_AT_COOKIE: 'session_started_at', SESSION_MAX_AGE_SECONDS: 3600 },
    '@/lib/auth/sections': { APP_SECTIONS: [] },
  };
  const exports = {};
  new Function('require', 'exports', code)(name => mocks[name], exports);
  const request = { url: 'http://localhost/projets', nextUrl: { pathname: '/projets' }, cookies: { getAll: () => [], set: () => {}, get: () => undefined } };
  const result = await exports.middleware(request);
  assert.equal(result.url, 'http://localhost/login');
  assert.equal(result.values.get('sb-auth-token')?.maxAge, 0);
  assert.equal(result.values.get('session_started_at')?.maxAge, 0);
});
