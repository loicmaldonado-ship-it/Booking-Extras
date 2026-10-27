import {spawnSync, spawn} from 'node:child_process';
import {readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, chmodSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes, createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const cliVersion='2.122.0';
const local=join(root,'.recette');
const projectPrefix='BOOKING_EXTRAS_RECETTE';
// Services absents des parcours de recette ; Auth, REST et Storage restent contrôlés.
const startArgs=['--yes',`supabase@${cliVersion}`,'start','--exclude','studio,realtime,postgres-meta,edge-runtime,logflare,vector,supavisor,imgproxy'];
function fail(message){console.error('\n'+message);process.exit(1);}
function command(name,args,options={}){
 const program=process.platform==='win32'&&['npm','npx'].includes(name)?name+'.cmd':name;
 const result=spawnSync(program,args,{cwd:root,stdio:options.capture?'pipe':'inherit',encoding:'utf8',shell:process.platform==='win32'&&['npm','npx'].includes(name),...options});
 if(result.error||result.status!==0){
  if(options.diagnostic){
   let cliMessage='';
   try{const payload=JSON.parse(result.stdout??'');cliMessage=typeof payload.message==='string'?payload.message:typeof payload.error?.message==='string'?payload.error.message:'';}catch{}
   const message=[result.stderr,result.error?.message,cliMessage].filter(Boolean).join('\n').split('\n').filter(line=>!/(key|token|secret|password|postgres(?:ql)?:\/\/)/i.test(line)).join('\n').replace(/eyJ[A-Za-z0-9_.-]+/g,'[clé masquée]');
   writeFileSync(join(local,'demarrage-base.log'),message.slice(-12000),{mode:0o600});
  }
  if(options.allowFailure)return null;
  fail(options.failure??`L’étape ${name} a échoué. Gardez cette fenêtre et transmettez une capture du message d’erreur à Éléa.`);
 }
 return result.stdout;
}
if(Number(process.versions.node.split('.')[0])<22)fail('Installez Node.js 22 ou 24 depuis nodejs.org, puis relancez ce fichier.');
console.log('Booking Extras — recette locale, uniquement avec des données fictives.');
if(process.argv.includes('--stop')){
 const configPath=join(local,'supabase/config.toml');
 if(!existsSync(configPath)){console.log('Aucune base de recette à arrêter dans ce dossier.');process.exit(0);}
 const id=readFileSync(configPath,'utf8').match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
 if(!id||!/^BOOKING_EXTRAS_RECETTE(?:_[a-f0-9]{12})?$/.test(id))fail('Arrêt refusé : ce dossier ne désigne pas une base de recette gérée par ce lanceur.');
 command('npx',['--yes',`supabase@${cliVersion}`,'stop'],{cwd:local,capture:true});
 console.log('Base de cette copie arrêtée. Vos essais sont conservés.');process.exit(0);
}
command('docker',['info'],{capture:true,failure:'Ouvrez Docker Desktop, attendez que le moteur soit démarré, puis relancez ce fichier.'});
// Cette installation ne lit aucun lien Supabase distant et ne lance aucun reset.
const migrationNames=readdirSync(join(root,'supabase/migrations')).filter(n=>n.endsWith('.sql')).sort();
const digest=createHash('sha256');
for(const n of migrationNames)digest.update(n).update(readFileSync(join(root,'supabase/migrations',n)));
digest.update(readFileSync(join(root,'supabase/seed.sql')));
const fingerprint=digest.digest('hex');
const marker=join(local,'schema.sha256');
if(existsSync(marker)&&readFileSync(marker,'utf8').trim()!==fingerprint)fail('Cette copie contient une nouvelle version du schéma. Gardez votre dossier de test actuel et demandez à Éléa une nouvelle copie isolée ; aucune donnée n’a été réinitialisée.');
const envPath=join(root,'.env.local');
const managed='# BOOKING_EXTRAS_RECETTE — généré localement';
if(existsSync(envPath)&&!readFileSync(envPath,'utf8').startsWith(managed))fail('Ce dossier possède déjà une configuration personnelle. Décompressez l’archive de recette dans un nouveau dossier, puis recommencez.');
mkdirSync(join(local,'supabase/migrations'),{recursive:true});
for(const n of migrationNames)copyFileSync(join(root,'supabase/migrations',n),join(local,'supabase/migrations',n));
copyFileSync(join(root,'supabase/seed.sql'),join(local,'supabase/seed.sql'));
let config=readFileSync(join(root,'supabase/config.toml'),'utf8').replace(/^project_id\s*=.*$/m,`project_id = "${projectPrefix}_${fingerprint.slice(0,12)}"`);
for(const [a,b] of [['54321','29194'],['54322','29242'],['54320','29240'],['54323','29243'],['54324','29244'],['54327','29247'],['54329','29249']])config=config.replaceAll(a,b);
writeFileSync(join(local,'supabase/config.toml'),config);
console.log('Préparation de la base de démonstration. Le premier démarrage peut prendre plusieurs minutes.');
const started=command('npx',startArgs,{cwd:local,capture:true,allowFailure:true,diagnostic:true});
if(started===null){
 console.log('Le premier démarrage n’a pas abouti ; une reprise locale est tentée.');
 command('npx',startArgs,{cwd:local,capture:true,diagnostic:true,failure:'La base locale ne démarre pas. Transmettez le fichier .recette/demarrage-base.log à Éléa.'});
}
const raw=command('npx',['--yes',`supabase@${cliVersion}`,'status','-o','json'],{cwd:local,capture:true});
let status;try{status=JSON.parse(raw);}catch{fail('Impossible de lire la configuration de la base locale. Transmettez le message à Éléa ; ne renseignez aucune clé de production.');}
const api=status.API_URL??status.api_url;
let url;try{url=new URL(api);}catch{fail('Adresse locale de la base manquante.');}
if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))fail('Arrêt de sécurité : la base indiquée n’est pas locale.');
const anon=status.ANON_KEY??status.anon_key, service=status.SERVICE_ROLE_KEY??status.service_role_key;
if(!anon||!service)fail('Les clés de démonstration locales sont manquantes.');
// Conserver la clé locale entre deux démarrages pour les données chiffrées.
const old=existsSync(envPath)?readFileSync(envPath,'utf8'):'';
const secret=old.match(/^SECRETS_ENCRYPTION_KEY=(.+)$/m)?.[1]??randomBytes(32).toString('base64');
const authSecret=old.match(/^AUTH_RATE_LIMIT_SECRET=(.+)$/m)?.[1]??randomBytes(32).toString('hex');
const values={BOOKING_TEST_MODE:'1',NEXT_PUBLIC_SUPABASE_URL:url.origin,NEXT_PUBLIC_SUPABASE_ANON_KEY:anon,SUPABASE_SERVICE_ROLE_KEY:service,NEXT_PUBLIC_SITE_URL:'http://localhost:3100',SECRETS_ENCRYPTION_KEY:secret,AUTH_RATE_LIMIT_SECRET:authSecret};
writeFileSync(envPath,managed+'\n'+Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
if(process.platform!=='win32')chmodSync(envPath,0o600);
writeFileSync(marker,fingerprint+'\n');
const lockHash=createHash('sha256').update(readFileSync(join(root,'package-lock.json'))).digest('hex');
const dependenciesMarker=join(local,'dependencies.sha256');
if(!existsSync(join(root,'node_modules/next'))||!existsSync(dependenciesMarker)||readFileSync(dependenciesMarker,'utf8')!==lockHash){
 console.log('Installation des composants du projet…');command('npm',['ci']);writeFileSync(dependenciesMarker,lockHash);
}
console.log('\nOuvrez http://localhost:3100 dans votre navigateur.\nGardez cette fenêtre ouverte. Pour arrêter : Ctrl+C.\nLes emails, SMS, notifications et accès Gmail réels sont désactivés.\n');
const next=spawn(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3100'],{cwd:root,stdio:'inherit',env:{...process.env,...values}});
next.on('error',()=>fail('Le site n’a pas démarré. Vérifiez qu’aucun autre test n’utilise le port 3100.'));
next.on('exit',code=>process.exit(code??1));
process.on('SIGINT',()=>next.kill('SIGINT'));
