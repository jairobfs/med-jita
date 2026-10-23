import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const source=resolve('site-v51/source'), target=resolve(process.argv[2]||'_site/previsao');
if(!existsSync(join(source,'index.html')))throw Error('Fonte ausente');
mkdirSync(target,{recursive:true});
for(const name of readdirSync(source))cpSync(join(source,name),join(target,name),{recursive:true});
let html=readFileSync(join(target,'index.html'),'utf8');
function replace(a,b){if(!html.includes(a))throw Error('Trecho ausente: '+a.slice(0,40));html=html.replace(a,b)}
replace("KEY='med_jita_state_v3'","KEY='med_jita_preview_state_v3'");
replace("LEGACY_KEY='med_grade_suite_v2'","LEGACY_KEY='med_jita_preview_legacy_v2'");
replace("HISTORY_KEY='med_jita_history_v1'","HISTORY_KEY='med_jita_preview_history_v1'");
replace('window.MED_JITA_ACCOUNTS_ENABLED=true;','window.MED_JITA_ACCOUNTS_ENABLED=false;');
for(const name of ['sync-ui','profiles-ui','editorial-live']){const re=new RegExp('<script src="./integrations/'+name+'\\.js\\?v=\\d+" defer></script>');if(!re.test(html))throw Error('Script ausente '+name);html=html.replace(re,'');}
replace("if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});}","/* Sem service worker na previa */");
replace('<link rel="manifest" href="./manifest.webmanifest">','');
replace('</head>','<script>document.documentElement.dataset.profileReady="yes";</script></head>');
replace('<body>','<body><div style="padding:12px;background:#102d3c;color:white;font:700 13px system-ui;position:relative;z-index:999">PRÉVIA VISUAL · dados locais separados · sem login ou sincronização <a style="color:#8de4d3" href="../">Voltar</a></div>');
writeFileSync(join(target,'index.html'),html);
console.log('Prévia isolada criada');