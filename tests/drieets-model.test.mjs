import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {ageOnDate} from '../src/lib/minors/model.ts';
const source=readFileSync(new URL('../src/lib/drieets/model.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('require','exports',code)(()=>({ageOnDate}),exports);
const build=exports.buildMinorPreparation;
function fixture(){return{
 project:{id:'project',nom:'Été & <scène>',societe_production:'Production Démo',realisateur:'Réalisateur',lieu:'Paris'},
 child:{id:'child',prenom:'Zoé',nom:"D’Hiver",email:'child@example.test',date_naissance:'2012-10-30',adresse:'1 rue de Test',code_postal:'75011',ville:'Paris'},
 dossier:{id:'dossier',projet_id:'project',figurant_id:'child',tournage_debut:'2026-10-30',tournage_fin:'2026-11-10',commission_date:'2026-10-20',role_label:'Silhouette',cachet_info:'Conditions fictives à valider'},
 guardians:{first:{prenom:'Parent',nom:'Un',adresse:'2 rue de Test',telephone:'0600000001',email:'parent1@example.test'},second:{absence_reason:'decede'}},
 bookings:[{projet_id:'project',figurant_id:'child',date:'2026-11-02',fonction:'Silhouette',cachet:'Démo'},{projet_id:'project',figurant_id:'child',date:'2026-10-30',fonction:'Silhouette',cachet:'Démo'}],complete:false,documents:[]};}
test('DRIEETS preparation keeps accented names, sorts dates and remains explicitly incomplete without validated documents',()=>{
 const input=fixture(),result=build(input);assert.deepEqual(result.errors,[]);assert.equal(result.data.age,14);assert.equal(result.data.project.nom,'Été & <scène>');assert.equal(result.data.child.nom,"D’Hiver");assert.equal(result.data.complete,false);assert.equal(result.data.bookings[0].date,'2026-10-30');assert.equal(input.bookings[0].date,'2026-11-02');
});
test('DRIEETS preparation refuses another project or child in its dataset',()=>{
 for(const mutate of [x=>x.dossier.projet_id='foreign',x=>x.dossier.figurant_id='foreign',x=>x.bookings[0].projet_id='foreign',x=>x.bookings[0].figurant_id='foreign']){const x=fixture();mutate(x);assert.equal(build(x).data,null);assert.match(build(x).errors.join(' '),/seul enfant/);}
});
test('missing identity, production, guardians, dates and remuneration are named before generation',()=>{
 const x=fixture();x.child.adresse=null;x.project.societe_production=null;x.dossier.tournage_fin='2026-10-01';x.dossier.cachet_info=null;x.guardians=undefined;const result=build(x);assert.equal(result.data,null);assert.equal(result.errors.length,5);
});
test('commission is required under 16, and the eighteenth birthday is excluded from minor preparation',()=>{
 const x=fixture();x.dossier.commission_date=null;assert.equal(build(x).data,null);x.child.date_naissance='2010-10-30';assert.equal(build(x).data.age,16);x.child.date_naissance='2008-10-30';assert.equal(build(x).data,null);
});
test('invalid calendar dates, duplicate guardian emails and undocumented exceptions are refused',()=>{
 const x=fixture();x.dossier.tournage_debut='2026-02-30';assert.equal(build(x).data,null);
 const y=fixture();y.guardians.first.email='CHILD@example.test';assert.equal(build(y).data,null);
 const z=fixture();z.guardians.second.absence_reason='autre';assert.equal(build(z).data,null);
});
