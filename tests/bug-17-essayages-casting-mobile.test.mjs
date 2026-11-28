import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('BUG-17: essayages shared link keeps a responsive mobile view and all published columns', () => {
  const page = read('src/app/partage/essayages/[token]/page.tsx');
  assert.match(page, /grid gap-3 md:hidden/);
  assert.match(page, /hidden max-w-full overflow-x-auto md:block/);
  assert.match(page, /min-w-\[980px\]/);
  for (const key of ['col_fonction', 'col_cachet', 'col_costume', 'col_dates_tournage', 'col_lieu', 'col_statut', 'col_notes']) {
    assert.match(page, new RegExp(key));
  }
  assert.match(page, /<Fragment key=\{e\.id\}>/);
});

test('BUG-17: public share still displays only confirmed or completed fittings', () => {
  const page = read('src/app/partage/essayages/[token]/page.tsx');
  assert.match(page, /\.in\("statut", \["confirmé", "fait"\]\)/);
  assert.match(page, /resolvePartageToken\(token, "essayages"\)/);
});

test('BUG-17: both print/PDF toolbar areas wrap on smaller viewports', () => {
  const p1 = read('src/app/partage/essayages/[token]/planning/page.tsx');
  const p2 = read('src/app/casting/presentiel/journee/planning/page.tsx');
  for (const content of [p1, p2]) {
    assert.match(content, /print-hide flex flex-wrap items-center justify-between gap-3/);
    assert.match(content, /flex flex-wrap items-center gap-3/);
    assert.match(content, /<PrintSheet/);
  }
});

test('BUG-17: casting candidate cards are one-column on very narrow screens', () => {
  const page = read('src/components/casting-presentiel/presentiel-journee-table.tsx');
  assert.match(page, /grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5/);
  assert.match(page, /toggleSelect\(r\.id\)/);
});
