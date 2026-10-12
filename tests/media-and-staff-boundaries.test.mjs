import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('all reviewed form-upload actions invoke server-side byte validation (static check)', () => {
  const files = [
    'src/lib/figurants/photos.ts',
    'src/lib/auth/avatar-actions.ts',
    'src/lib/annonces/moodboard-actions.ts',
    'src/lib/essayages/actions.ts',
    'src/lib/documents/template-actions.ts',
    'src/lib/references/actions.ts',
    'src/lib/projets/annonce-photo-actions.ts',
    'src/lib/casting/actions.ts',
  ];
  for (const path of files) assert.match(src(path), /await validateImageUpload\(/, path);
  assert.match(src('src/lib/casting/actions.ts'), /await validatePdfUpload\(pdf\)/);
});

test('all reviewed figurant mutations check staff/pool and bind deletions to candidate id (static check)', () => {
  const code = src('src/lib/figurants/actions.ts');
  for (const fn of ['createFigurant', 'uploadFigurantPhoto', 'updateFigurantAgent', 'deletePhoto', 'deleteLien']) {
    const body = code.split(`export async function ${fn}(`)[1]?.split('export async function ')[0];
    assert.ok(body, fn);
    assert.match(body, /requireStaffFigurantAccess\(/, fn);
  }
  assert.match(code, /async function saveFigurantUpdate[\s\S]*?requireStaffFigurantAccess\(id\)/);
  assert.match(code, /\.eq\("id", photoId\)\.eq\("figurant_id", figurantId\)/);
  assert.match(code, /\.eq\("id", lienId\)\.eq\("figurant_id", figurantId\)/);
});
