import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const folder of ['agent','shared','scripts','tests'])for(const file of readdirSync(folder).filter(name=>name.endsWith('.mjs'))){const result=spawnSync(process.execPath,['--check',folder+'/'+file],{encoding:'utf8'});if(result.status){console.error(result.stderr);process.exit(result.status)}}
console.log('Public Agent kit JavaScript syntax checks passed.');
