import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(path) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const entry = { id: 'entry', figurant_id: 'candidate', projet_id: 'project', statut: 'nouveau', submitted_at: null, casting_roles: { nb_videos: 1, photo_labels: ['Portrait'], date_limite_envoi: null } };
  const client = { from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: entry }) }), storage: { from: () => ({ createSignedUploadUrl: async () => ({ data: null, error: { message: 'private https://storage.test?token=secret-value' } }) }) } };
  const mocks = { '@/lib/supabase/admin': { createAdminClient: () => client }, '@/lib/auth/session': { checkProjetAccess: async () => null }, './upload-paths': { isCastingSubmissionLocked: () => false } };
  const exports = {}; new Function('require', 'exports', code)(name => mocks[name] ?? {}, exports); return exports;
}
for (const [name, path, run] of [
  ['candidate photo', '../src/lib/casting/upload-actions.ts', x => x.createCastingUploadSlot('00000000-0000-4000-8000-000000000000', 'photo', 'Portrait')],
  ['staff video', '../src/lib/casting/actions.ts', x => x.createStaffCastingVideoSlot('entry')],
]) test(`${name} slot hides storage secrets on failure`, async () => { const result = await run(load(path)); assert.ok(result.error); assert.doesNotMatch(result.error, /secret-value|https:\/\//); });
