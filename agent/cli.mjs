#!/usr/bin/env node
import{pathToFileURL}from'node:url';
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{dirname,resolve,join}from'node:path';
import{homedir}from'node:os';
import{Wallet,getAddress}from'ethers';
import{launchTypedData,launchHash,normalizeRobName}from'../shared/launch-authorization.mjs';
import{walletPath,readWallet,publicWallet,initWallet,localAgent,configureWallet,walletStatus,rememberIntent,executeWallet}from'./wallet.mjs';

export async function run(argv=process.argv.slice(2),env=process.env,fetcher=fetch){
  const[command,...args]=argv;
  if(!command||command==='help')return{commands:['config','platform','wallet-init','wallet-status','wallet-configure --max-fee-eth DECIMAL [--valid-hours 24]','name --name ranger.rob','identity','register --name ranger.rob','metadata --name NAME [--description TEXT]','launch --name NAME --symbol SYMBOL --metadata-uri URI','wallet-execute --intent ID --approve HASH','intent ID'],identity:'A .rob identity and its Agent signature are required for every launch. Registration is not proof of AI inference.',signing:'The local encrypted Agent wallet signs and broadcasts registration and launch transactions after the user confirms the exact action in conversation. No browser wallet is required.'};
  const options={};for(let i=0;i<args.length;i++)if(args[i].startsWith('--')){const key=args[i].slice(2);if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`Missing value for --${key}`);options[key]=args[++i];}
  const walletFile=walletPath(options,env);
  if(command==='wallet-init')return initWallet(walletFile,env);
  let local=null;try{local=publicWallet(await readWallet(walletFile));}catch(e){if(e.code!=='ENOENT')throw e;}
  const account=options.account?getAddress(options.account):local?.account;
  const usesLocal=!!local&&account===local.account;
  const agentFile=resolve(options['agent-file']||env.ROGUE_AGENT_FILE||join(homedir(),'.rogue','agent-keystore.json'));
  const password=()=>{const value=env.ROGUE_AGENT_PASSWORD;if(!value||value.length<12)throw Error('Set ROGUE_AGENT_PASSWORD in the local Agent process environment (12+ characters); never send it to ROGUE');return value;};
  if(command==='agent-init'){const secret=password(),wallet=Wallet.createRandom();await mkdir(dirname(agentFile),{recursive:true,mode:0o700});const encrypted=await wallet.encrypt(secret);await writeFile(agentFile,encrypted,{flag:'wx',mode:0o600});return{agentSigner:wallet.address,agentFile,encrypted:true,purpose:'Launch authorization only; this key never signs asset-wallet transactions'};}
  const publicSigner=async()=>{if(options['agent-signer'])return getAddress(options['agent-signer']);let data;try{data=JSON.parse(await readFile(agentFile,'utf8'));}catch{throw Error('Run agent-init first, or provide the public --agent-signer address');}if(!data.Crypto&&!data.crypto)throw Error('Expected an encrypted Agent keystore');return getAddress(`0x${String(data.address).replace(/^0x/,'')}`);};
  if(command==='agent-address')return{agentSigner:await publicSigner(),agentFile};
  const origin=new URL(env.ROGUE_ORIGIN||'https://45.76.202.123:8443');if(!['https:','http:'].includes(origin.protocol)||origin.username||origin.password)throw Error('Invalid ROGUE origin');if(origin.protocol==='http:'&&!['127.0.0.1','localhost'].includes(origin.hostname))throw Error('Use HTTPS outside localhost');
  const request=async(path,body)=>{const response=await fetcher(new URL(path,origin),{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(30_000)});const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data;};
  if(['wallet-configure','wallet-status','wallet-execute'].includes(command)){
    if(!local)throw Error('Run wallet-init to create a dedicated local Agent wallet first');
    const config=await request('/api/config');
    if(command==='wallet-configure')return configureWallet(walletFile,env,options,config,origin);
    if(command==='wallet-status')return walletStatus(walletFile,env,config,request);
    return executeWallet(walletFile,env,options,config,origin,request);
  }
  if(command==='config')return request('/api/config');if(command==='markets')return request('/api/markets');if(command==='platform')return request('/api/platform-token');
  if(command==='name')return request(`/api/names/${encodeURIComponent(`${normalizeRobName(options.name)}.rob`)}`);
  if(command==='identity')return request(`/api/identity/${getAddress(account)}`);
  if(command==='intent'){if(!/^[a-f0-9]{48}$/.test(args[0]||''))throw Error('Invalid intent ID');return request(`/api/intents/${args[0]}`);}
  if(command==='metadata')return request('/api/metadata',{name:options.name,description:options.description||''});
  if(!['register','rotate-agent','launch','buy','sell','graduate'].includes(command))throw Error('Unknown command');
  const config=await request('/api/config');if(!config.configured||!config.executionEnabled)throw Error('No verified deployment is enabled for transaction preparation');
  if(command==='register'){
    const expected={kind:'register_rob',account,robName:`${normalizeRobName(options.name)}.rob`,agentSigner:usesLocal?local.agentSigner:await publicSigner(),...(usesLocal?{executionMode:'agent_wallet'}:{})};
    const intent=await request('/api/intents',expected);return usesLocal?rememberIntent(walletFile,intent,expected):intent;
  }
  if(command==='rotate-agent')return request('/api/intents',{kind:'rotate_agent',account,agentSigner:getAddress(options['agent-signer'])});
  if(command==='launch'){
    const input={account:getAddress(account),name:String(options.name||'').trim(),symbol:options.symbol,metadataURI:options['metadata-uri']};
    const challenge=await request('/api/launch-authorization',input);
    if(challenge.account!==input.account||!challenge.identity?.registered||challenge.identity.account!==input.account||!/^\d+$/.test(challenge.nonce)||!Number.isSafeInteger(challenge.deadline)||challenge.deadline<Math.floor(Date.now()/1000)||challenge.deadline>Math.floor(Date.now()/1000)+600)throw Error('Invalid launch authorization challenge');
    const local=launchTypedData({chainId:config.chainId,factory:config.factory,creator:input.account,identityId:challenge.identity.identityId,...input,nonce:challenge.nonce,deadline:challenge.deadline});
    if(launchHash(local)!==challenge.digest||launchHash(challenge.typedData)!==challenge.digest||challenge.name!==input.name||challenge.symbol!==input.symbol||challenge.metadataURI!==input.metadataURI)throw Error('Server challenge differs from the requested launch');
    const wallet=usesLocal?await localAgent(walletFile,env):await Wallet.fromEncryptedJson(await readFile(agentFile,'utf8'),password());
    if(wallet.address!==getAddress(challenge.identity.agentSigner))throw Error('Agent key does not match the key bound to this .rob identity');
    const signature=await wallet.signTypedData(local.domain,local.types,local.message);
    const intent=await request('/api/intents',{kind:'launch',...input,nonce:challenge.nonce,deadline:challenge.deadline,agentSignature:signature,...(usesLocal?{executionMode:'agent_wallet'}:{})});
    return usesLocal?rememberIntent(walletFile,intent,{kind:'launch',...input}):intent;
  }
  return request('/api/intents',{kind:command,account,token:options.token,...command!=='graduate'?{amount:options.amount,slippageBps:Number(options['slippage-bps']||100)}:{}});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await run(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
