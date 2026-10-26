import test from 'node:test';
import assert from 'node:assert/strict';
import {ageOnDate,todayInParis,readGuardians} from '../src/lib/minors/model.ts';
function form(){const fd=new FormData();for(const n of [1,2])for(const [k,v] of Object.entries({prenom:'Parent',nom:`Test ${n}`,adresse:'1 rue de Test',telephone:'+33 6 00 00 00 00',email:`parent${n}@example.test`}))fd.set(`guardian_${n}_${k}`,v);return fd;}
test('minor age uses real dates, birthdays and the Paris calendar',()=>{
 assert.equal(ageOnDate('2008-10-26','2026-10-26'),18);assert.equal(ageOnDate('2008-10-27','2026-10-26'),17);
 assert.equal(ageOnDate('2008-02-29','2026-02-28'),17);assert.equal(ageOnDate('2008-02-29','2026-03-01'),18);
 for(const d of ['2026-02-31','not-a-date','2026-10-27'])assert.equal(ageOnDate(d,'2026-10-26'),null);
 assert.equal(todayInParis(new Date('2026-10-25T23:30:00Z')),'2026-10-26');
});
test('minor application requires both complete guardians with three distinct emails',()=>{
 const fd=form();const valid=readGuardians(fd,'2010-01-01','child@example.test','2026-10-26');assert.ok(valid.data);
 fd.set('guardian_1_email',' CHILD@EXAMPLE.TEST ');assert.ok(readGuardians(fd,'2010-01-01','child@example.test','2026-10-26').error);
 fd.set('guardian_1_email','PARENT2@example.test');assert.ok(readGuardians(fd,'2010-01-01','child@example.test','2026-10-26').error);
 for(const field of ['prenom','nom','adresse','telephone','email']){const broken=form();broken.delete('guardian_2_'+field);assert.ok(readGuardians(broken,'2010-01-01','child@example.test','2026-10-26').error);}
});
test('only documented second-guardian exceptions are accepted and stale contact fields are omitted',()=>{
 for(const reason of ['decede','sans_autorite']){const fd=form();fd.set('guardian_2_absence_reason',reason);const value=readGuardians(fd,'2010-01-01','child@example.test','2026-10-26');assert.deepEqual(value.data.second,{absence_reason:reason});}
 const bad=form();bad.set('guardian_2_absence_reason','absent');assert.ok(readGuardians(bad,'2010-01-01','child@example.test','2026-10-26').error);
});
test('invalid contact formats are refused and adults do not submit guardian PII',()=>{
 for(const [key,value] of [['email','invalid'],['telephone','not a phone'],['prenom','x'.repeat(121)]]){const fd=form();fd.set('guardian_1_'+key,value);assert.ok(readGuardians(fd,'2010-01-01','child@example.test','2026-10-26').error);}
 assert.deepEqual(readGuardians(form(),'1995-01-01','adult@example.test','2026-10-26'),{data:null});
});
