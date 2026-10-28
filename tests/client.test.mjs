import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {randomBytes} from 'node:crypto';
import {Wallet} from 'ethers';
import {run} from '../agent/cli.mjs';
import {normalizeRobName} from '../shared/launch-authorization.mjs';

test('name normalization rejects unsafe and invalid labels',()=>{
  assert.equal(normalizeRobName(' Ranger.ROB '),'ranger');
  for(const value of ['ab','-abc','abc-','a.b','rаnger','a'.repeat(25),undefined])assert.throws(()=>normalizeRobName(value));
});

test('encrypted wallet never overwrites, and closed service never prepares a transaction',{timeout:60000},async()=>{
  const folder=await mkdtemp(resolve(tmpdir(),'rogue-public-kit-')),file=resolve(folder,'wallet.json'),password=randomBytes(24).toString('hex');
  const env={ROGUE_WALLET_FILE:file,ROGUE_WALLET_PASSWORD:password};
  try{
    const created=await run(['wallet-init'],env);assert.equal(created.encrypted,true);assert.notEqual(created.account,created.agentSigner);
    const encrypted=JSON.parse(await readFile(file,'utf8'));assert.ok(encrypted.wallet.crypto||encrypted.wallet.Crypto);assert.ok(encrypted.agent.crypto||encrypted.agent.Crypto);
    const recovered=await Wallet.fromEncryptedJson(JSON.stringify(encrypted.wallet),password);assert.equal(recovered.address,created.account);
    await assert.rejects(run(['wallet-init'],env),/EEXIST/);
    let posts=0;const fetcher=async(url,options)=>{if(options?.method==='POST')posts++;assert.equal(new URL(url).pathname,'/api/config');return new Response(JSON.stringify({configured:false,executionEnabled:false,chainId:4663}));};
    await assert.rejects(run(['register','--name','ranger.rob'],env,fetcher),/No verified deployment/);assert.equal(posts,0);
  }finally{
    assert.equal(dirname(folder),resolve(tmpdir()));assert.ok(folder.startsWith(resolve(tmpdir(),'rogue-public-kit-')));await rm(folder,{recursive:true,force:true});
  }
});
