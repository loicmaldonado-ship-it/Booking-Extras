import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const [file, action] of [['essayage-lieu-projet-panel.tsx','updateEssayageLieuProjet'],['essayage-journee-table.tsx','updateEssayageLieu']]) {
 test(`${file} shows a failed location save and keeps the editor open`,()=>{
  const source=readFileSync(new URL(`../src/components/essayages/${file}`,import.meta.url),'utf8');
  const start=source.indexOf(`await ${action}(`);assert.ok(start>=0);
  const after=source.slice(start,start+400);
  assert.match(after,/result\?\.error/);assert.match(after,/return/);
  assert.ok(after.indexOf('return')<after.indexOf('router.refresh()'));
 });
}
