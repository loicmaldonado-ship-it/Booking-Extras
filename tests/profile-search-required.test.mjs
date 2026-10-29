import test from 'node:test';
import assert from 'node:assert/strict';
import { maySearchProfiles } from '../src/lib/figurants/search-required.ts';
test('search is required regardless of account privileges',()=>{for(const role of ['owner','chef','assistant']){assert.equal(maySearchProfiles('',false),false,role);assert.equal(maySearchProfiles('ab',false),false,role)}});
test('name or additional criteria allow search',()=>{assert.equal(maySearchProfiles('  Camille  ',false),true);assert.equal(maySearchProfiles('',true),true)});
