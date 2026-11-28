import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const dir = new URL('../supabase/migrations/', import.meta.url);
const version = '20261026101717_droits_api_explicites_octobre_30.sql';
const read = name => readFileSync(new URL(name,dir),'utf8');
test('October 30 reconciliation explicitly covers every historical public table', () => {
  const reconciliation=read(version);
  const names=new Set();
  for(const file of readdirSync(dir).filter(n=>n.endsWith('.sql')&&n<version)) {
    const sql=read(file).replace(/--[^\n]*/g,'');
    for(const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)/gi)) names.add(match[1]);
  }
  assert.equal(names.size,69);
  for(const name of names) assert.ok(reconciliation.includes(`on table public.${name} to service_role;`),name);
  assert.doesNotMatch(reconciliation,/grant[^;]*to\s+anon/i);
  assert.doesNotMatch(reconciliation,/grant[^;]*on\s+all\s+tables/i);
});
test('future table migrations must include explicit grants and RLS',()=>{
  for(const file of readdirSync(dir).filter(n=>n.endsWith('.sql')&&n>version)) {
    const sql=read(file).replace(/--[^\n]*/g,'');
    for(const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_]+)/gi)) {
      const name=match[1];
      assert.match(sql,new RegExp(`alter\\s+table\\s+public\\.${name}\\s+enable\\s+row\\s+level\\s+security`,'i'),file);
      assert.match(sql,new RegExp(`grant[^;]*public\\.${name}[^;]*to\\s+service_role`,'i'),file);
    }
  }
});
