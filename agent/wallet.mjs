import {readFile,writeFile,mkdir,rename,open,unlink} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {homedir} from 'node:os';
import {Wallet,JsonRpcProvider,Contract,Interface,AbiCoder,keccak256,toUtf8Bytes,getAddress,parseEther,formatEther,Transaction,verifyTypedData} from 'ethers';
import {launchTypedData} from '../shared/launch-authorization.mjs';
import {DEPLOYMENT_KEYS,DEPLOYMENT_CONTRACTS} from '../shared/deployment.mjs';

const identityABI=['function commit(bytes32)','function register(string,address,bytes32)','function makeCommitment(string,address,address,bytes32) view returns(bytes32)','function agentSignerOf(address) view returns(address)','function tokenIdOf(address) view returns(uint256)'];
const factoryABI=['function identity() view returns(address)','function locker() view returns(address)','function graduationTarget() view returns(uint256)','function feeBps() view returns(uint256)','function treasury() view returns(address)','function createToken(string,string,string,uint256,uint256,bytes)','event TokenLaunched(address indexed token,address indexed curve,address indexed creator,string name,string symbol,string metadataURI)'];
const registry=new Interface(identityABI),factory=new Interface(factoryABI);
const keys=DEPLOYMENT_KEYS;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const walletPath=(options={},env=process.env)=>resolve(options['wallet-file']||env.ROGUE_WALLET_FILE||join(homedir(),'.rogue','agent-wallet.json'));
const canonical=value=>JSON.stringify(sort(value));
function sort(value){return Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])])):value;}
const snapshot=i=>({id:i.id,summary:i.summary,steps:i.steps,expiresAt:i.expiresAt});
const fingerprint=i=>keccak256(toUtf8Bytes(canonical(snapshot(i))));
const password=env=>{if(!env.ROGUE_WALLET_PASSWORD||env.ROGUE_WALLET_PASSWORD.length<12)throw Error('Set ROGUE_WALLET_PASSWORD locally (12+ characters); never send it in chat or to ROGUE');return env.ROGUE_WALLET_PASSWORD;};
async function json(file){return JSON.parse(await readFile(file,'utf8'));}
async function atomic(file,value){await mkdir(dirname(file),{recursive:true,mode:0o700});const temp=`${file}.${process.pid}.${Date.now()}.tmp`;await writeFile(temp,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});await rename(temp,file);}
export async function readWallet(file){const v=await json(file);if(v.version!==1||!v.wallet?.address||!v.agent?.address)throw Error('Invalid ROGUE Agent wallet');return v;}
export function publicWallet(v){return{account:getAddress('0x'+v.wallet.address.replace(/^0x/,'')),agentSigner:getAddress('0x'+v.agent.address.replace(/^0x/,'')),encrypted:true,custody:'Local encrypted EOA wallet, not MPC or an official Robinhood wallet'};}
export async function initWallet(file,env){const secret=password(env);const txWallet=Wallet.createRandom(),agent=Wallet.createRandom();await mkdir(dirname(file),{recursive:true,mode:0o700});const v={version:1,wallet:JSON.parse(await txWallet.encrypt(secret)),agent:JSON.parse(await agent.encrypt(secret))};await writeFile(file,JSON.stringify(v,null,2),{flag:'wx',mode:0o600});return{...publicWallet(v),walletFile:file,next:'Back up the encrypted file and password separately. Fund this address with ETH on the selected Robinhood network, then configure the execution limits.'};}
export async function localAgent(file,env){const v=await readWallet(file);return Wallet.fromEncryptedJson(JSON.stringify(v.agent),password(env));}
function rpcFor(config,env){
  const url=new URL(env.ROGUE_WALLET_RPC_URL||(config.chainId===4663?'https://rpc.mainnet.chain.robinhood.com':config.chainId===46630?'https://rpc.testnet.chain.robinhood.com':'http://127.0.0.1:8547'));
  if(url.username||url.password||!['http:','https:'].includes(url.protocol))throw Error('Invalid wallet RPC URL');
  if(config.chainId===31337){if(env.ROGUE_LOCAL_DEV!=='true'||url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Local chain execution requires explicit ROGUE_LOCAL_DEV and a loopback RPC');}
  else if(![4663,46630].includes(config.chainId)||url.protocol!=='https:')throw Error('Wallet execution requires a Robinhood network and HTTPS RPC');
  return url.href;
}
async function verifyDeployment(p,c){
  if(!c.configured||!c.executionEnabled)throw Error('No verified deployment is enabled');
  if(Number(await p.send('eth_chainId',[]))!==c.chainId)throw Error('Wallet RPC chain mismatch');
  for(const key of DEPLOYMENT_CONTRACTS)if(!c[key]||keccak256(await p.getCode(c[key]))!==c[key+'CodeHash'])throw Error('Wallet contract runtime mismatch');
  const f=new Contract(c.factory,factoryABI,p),l=new Contract(c.locker,['function factory() view returns(address)'],p);
  if(getAddress(await f.identity())!==getAddress(c.identity)||getAddress(await f.locker())!==getAddress(c.locker)||getAddress(await l.factory())!==getAddress(c.factory))throw Error('Wallet deployment binding mismatch');
  const v=new Contract(c.revenueVault,['function factory() view returns(address)','function platformToken() view returns(address)','function BUYBACK_BPS() view returns(uint256)'],p);
  if(getAddress(await f.treasury())!==getAddress(c.revenueVault)||getAddress(await v.factory())!==getAddress(c.factory)||getAddress(await v.platformToken())!==getAddress(c.platformToken)||await v.BUYBACK_BPS()!==8000n)throw Error('Wallet revenue configuration mismatch');
}
export async function configureWallet(file,env,options,config,origin){
  const v=await readWallet(file);password(env);
  if(!/^\d+(\.\d{1,18})?$/.test(options['max-fee-eth']||''))throw Error('Specify the user-approved --max-fee-eth budget per action');
  const maxFee=parseEther(options['max-fee-eth']);if(maxFee<=0n)throw Error('The gas budget must be positive');
  const hours=Number(options['valid-hours']||24);if(!Number.isFinite(hours)||hours<=0||hours>168)throw Error('Policy validity must be 0–168 hours');
  const rpcUrl=rpcFor(config,env),p=new JsonRpcProvider(rpcUrl,undefined,{cacheTimeout:-1});
  try{await verifyDeployment(p,config);const policy={version:1,origin:new URL(origin).origin,rpcUrl,...Object.fromEntries(keys.map(k=>[k,config[k]])),account:publicWallet(v).account,maxFeeWei:maxFee.toString(),maxValueWei:'0',validUntil:Math.floor(Date.now()/1000+hours*3600),actions:['register_rob','launch'],confirmation:'Exact locally stored plan hash required for each action'};await atomic(file+'.policy.json',policy);return{policy,gasBudgetEth:formatEther(maxFee),scope:'Agent registration and token launch only. No arbitrary transfer, approval, buy or sell is enabled in this wallet executor.'};}finally{p.destroy();}
}
export async function walletStatus(file,env,config,request){const v=await readWallet(file),pub=publicWallet(v);let policy=null;try{policy=await json(file+'.policy.json');}catch(e){if(e.code!=='ENOENT')throw e;}const p=new JsonRpcProvider(rpcFor(config,env),undefined,{cacheTimeout:-1});try{if(Number(await p.send('eth_chainId',[]))!==config.chainId)throw Error('Wallet RPC chain mismatch');return{...pub,chainId:config.chainId,balanceEth:formatEther(await p.getBalance(pub.account)),identity:await request('/api/identity/'+pub.account),policy,ready:!!policy&&policy.validUntil>Date.now()/1000};}finally{p.destroy();}}

export async function rememberIntent(file,intent,expected){
  if(!/^[a-f0-9]{48}$/.test(intent.id||''))throw Error('Invalid intent ID');
  const pub=publicWallet(await readWallet(file));if(getAddress(intent.summary.account)!==pub.account||intent.summary.executionMode!=='agent_wallet')throw Error('Intent does not use this Agent wallet');
  const value={intent:snapshot(intent),expected,approvalHash:fingerprint(intent)};const target=join(file+'.plans',intent.id+'.json');
  await mkdir(dirname(target),{recursive:true,mode:0o700});await writeFile(target,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
  return{...intent,execution:'agent_wallet',approvalHash:value.approvalHash,next:`Show this action and its gas budget to the user. After confirmation, call wallet-execute --intent ${intent.id} --approve ${value.approvalHash}. No browser wallet is required.`};
}
function sameTx(a,b){return a&&b&&getAddress(a.from)===getAddress(b.from)&&getAddress(a.to)===getAddress(b.to)&&Number(a.chainId)===Number(b.chainId)&&a.data.toLowerCase()===b.data.toLowerCase()&&BigInt(a.value)===BigInt(b.value);}
async function verifyPlan(record,p,policy,pub,checkCurrentAuthorization=true){
  const i=record.intent,s=i.summary,e=record.expected;
  if(i.expiresAt!==s.expiresAt||s.chainId!==policy.chainId||getAddress(s.account)!==pub.account||!policy.actions.includes(s.kind)||s.kind!==e.kind)throw Error('Action is outside the Agent wallet policy');
  if(!s.deployment||keys.filter(k=>k!=='chainId').some(k=>s.deployment[k]!==policy[k]))throw Error('Intent deployment differs from wallet policy');
  for(const step of i.steps){const t=step.transaction;if(getAddress(t.from)!==pub.account||Number(t.chainId)!==policy.chainId||BigInt(t.value)!==0n)throw Error('Agent wallet only permits zero-value registration and launch calls');}
  if(s.kind==='register_rob'){
    if(i.steps.length!==2||i.steps.some(x=>getAddress(x.transaction.to)!==getAddress(policy.identity)))throw Error('Invalid registration targets');
    const a=registry.parseTransaction(i.steps[0].transaction),b=registry.parseTransaction(i.steps[1].transaction);
    if(a.name!=='commit'||b.name!=='register'||b.args[0]+'.rob'!==e.robName||s.robName!==e.robName||getAddress(b.args[1])!==pub.agentSigner||getAddress(s.agentSigner)!==pub.agentSigner)throw Error('Registration parameters differ from the requested identity');
    if(s.registrationFeeEth!=='0')throw Error('Registration fee summary differs from this protocol');
    const commitment=keccak256(AbiCoder.defaultAbiCoder().encode(['address','uint256','address','bytes32','address','bytes32'],[policy.identity,policy.chainId,pub.account,keccak256(toUtf8Bytes(b.args[0])),pub.agentSigner,b.args[2]]));
    if(a.args[0]!==commitment)throw Error('Registration commitment mismatch');
  }else{
    if(i.steps.length!==1||getAddress(i.steps[0].transaction.to)!==getAddress(policy.factory))throw Error('Invalid launch target');
    const t=factory.parseTransaction(i.steps[0].transaction),[name,symbol,metadataURI,nonce,deadline,signature]=t.args;
    if(t.name!=='createToken'||name!==e.name||symbol!==e.symbol||metadataURI!==e.metadataURI||name!==s.name||symbol!==s.symbol||metadataURI!==s.metadataURI||Number(deadline)!==i.expiresAt||nonce.toString()!==s.agentNonce)throw Error('Launch parameters differ from the requested token');
    const f=new Contract(policy.factory,factoryABI,p);
    if(s.supply!=='1000000000'||s.graduationDex!=='Uniswap v4'||parseEther(s.graduationTargetEth)!==await f.graduationTarget()||BigInt(s.curveFeeBps)!==await f.feeBps()||getAddress(s.feeRecipient)!==getAddress(await f.treasury()))throw Error('Launch economics differ from the verified protocol');
    const revenue=new Contract(policy.revenueVault,['function treasury() view returns(address)'],p);
    if(s.buybackBps!==8000||getAddress(s.platformToken)!==getAddress(policy.platformToken)||getAddress(s.operationsTreasury)!==getAddress(await revenue.treasury()))throw Error('Launch revenue policy differs from the verified protocol');
    if(!checkCurrentAuthorization)return;
    const id=new Contract(policy.identity,identityABI,p),identityId=await id.tokenIdOf(pub.account);
    if(identityId===0n||getAddress(await id.agentSignerOf(pub.account))!==pub.agentSigner)throw Error('Agent wallet identity or authorization key changed');
    const typed=launchTypedData({chainId:policy.chainId,factory:policy.factory,creator:pub.account,identityId,name,symbol,metadataURI,nonce,deadline});
    if(getAddress(verifyTypedData(typed.domain,typed.types,typed.message,signature))!==pub.agentSigner)throw Error('Invalid per-launch Agent authorization');
  }
}

// Local encrypted wallet execution. Neither keys nor signed raw transactions go to the ROGUE API.
export async function executeWallet(file,env,options,config,origin,request){
  if(!/^[a-f0-9]{48}$/.test(options.intent||''))throw Error('Invalid intent ID');
  const record=await json(join(file+'.plans',options.intent+'.json'));
  if(fingerprint(record.intent)!==record.approvalHash||options.approve!==record.approvalHash)throw Error('Confirm the exact locally stored approvalHash before executing');
  const lockFile=file+'.lock';let lock;try{lock=await open(lockFile,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('An Agent wallet operation is already running. Inspect its pending transaction before recovering a stale lock.');throw e;}
  let p;
  try{
    await lock.writeFile(JSON.stringify({pid:process.pid,intent:options.intent}));
    const v=await readWallet(file),pub=publicWallet(v),policy=await json(file+'.policy.json');
    if(policy.origin!==new URL(origin).origin||policy.account!==pub.account||keys.some(k=>policy[k]!==config[k])||policy.rpcUrl!==rpcFor(config,env))throw Error('Wallet service, RPC or deployment changed; explicitly configure the wallet again');
    p=new JsonRpcProvider(policy.rpcUrl,undefined,{cacheTimeout:-1});p.pollingInterval=200;await verifyDeployment(p,config);await verifyPlan(record,p,policy,pub,false);
    const stateFile=file+'.state.json';let state={fees:{},pending:null};try{state=await json(stateFile);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(state.pending&&state.pending.id!==options.intent)throw Error('Another Agent wallet transaction is pending; resume that intent first');
    if(state.failed?.[options.intent])throw Error('This local action already reverted; inspect it and prepare a fresh approved plan');
    let current=await request('/api/intents/'+options.intent);
    if(fingerprint(current)!==record.approvalHash)throw Error('Server intent changed after the user reviewed it');
    if(current.status==='confirmed'&&!state.pending)return{...current,...await confirmedResult(p,current,policy),execution:'agent_wallet',alreadyConfirmed:true};
    const seconds=Number(options['wait-seconds']||90);if(!Number.isInteger(seconds)||seconds<1||seconds>120)throw Error('Wait must be 1–120 seconds');const until=Date.now()+seconds*1000;
    let signingWallet;
    while(current.receipts.length<record.intent.steps.length||state.pending){
      if(state.pending){
        const pending=state.pending;let receipt=await p.getTransactionReceipt(pending.hash);
        if(!receipt&&!await p.getTransaction(pending.hash))try{await p.broadcastTransaction(pending.raw);}catch{/* The identical signed transaction may already be propagating. Never replace it with a fresh nonce. */}
        while(!receipt&&Date.now()<until){await sleep(750);receipt=await p.getTransactionReceipt(pending.hash);}
        if(!receipt)return{status:'pending',id:options.intent,hash:pending.hash,next:'Resume wallet-execute with the same intent and approval hash. Do not prepare a replacement.'};
        if(receipt.status!==1){state.failed||={};state.failed[options.intent]=pending.hash;state.fees[options.intent]=(BigInt(state.fees[options.intent]||0)+receipt.fee).toString();state.pending=null;await atomic(stateFile,state);try{await request(`/api/intents/${options.intent}/receipt`,{index:pending.index,hash:pending.hash});}catch{}throw Error('Agent wallet transaction reverted; inspect it before preparing a new action');}
        const mined=await p.getTransaction(pending.hash);if(!sameTx({...mined,from:mined.from,chainId:Number(mined.chainId),data:mined.data},record.intent.steps[pending.index].transaction))throw Error('Mined transaction differs from the local plan');
        current=await request(`/api/intents/${options.intent}/receipt`,{index:pending.index,hash:pending.hash});
        state.fees[options.intent]=(BigInt(state.fees[options.intent]||0)+receipt.fee).toString();state.pending=null;await atomic(stateFile,state);continue;
      }
      if(Date.now()/1000>policy.validUntil)throw Error('Agent wallet policy expired; renew the approved limits');
      if(Date.now()/1000>record.intent.expiresAt)throw Error('Intent expired before submission; prepare a new action');
      if(current.status==='reverted')throw Error('This intent already reverted');
      const index=current.receipts.length,validation=await request(`/api/intents/${options.intent}/validate`,{index});
      if(validation.waitingForBlock){if(Date.now()>=until)return{status:'waiting_for_block',id:options.intent,block:validation.waitingForBlock,next:'Resume the same wallet-execute after the next block.'};await sleep(1000);continue;}
      const tx=record.intent.steps[index].transaction;if(!sameTx(tx,validation.transaction))throw Error('Validated transaction differs from the local plan');
      // Recheck chain and immutable runtimes before every new signature.
      await verifyDeployment(p,config);await verifyPlan(record,p,policy,pub);const{chainId,...call}=tx;await p.call(call);const gasLimit=await p.estimateGas(call)*120n/100n,fees=await p.getFeeData();
      const feeFields=fees.maxFeePerGas!==null?{maxFeePerGas:fees.maxFeePerGas,maxPriorityFeePerGas:fees.maxPriorityFeePerGas}:{gasPrice:fees.gasPrice};const worstFee=gasLimit*(feeFields.maxFeePerGas??feeFields.gasPrice);
      if(worstFee+BigInt(state.fees[options.intent]||0)>BigInt(policy.maxFeeWei))throw Error('Action exceeds the user-approved gas budget');
      if(await p.getBalance(pub.account)<worstFee)throw Error('Fund the Agent wallet with enough ETH for gas on this network');
      signingWallet ||= await Wallet.fromEncryptedJson(JSON.stringify(v.wallet),password(env));if(signingWallet.address!==pub.account)throw Error('Encrypted wallet address mismatch');
      const raw=await signingWallet.signTransaction({to:tx.to,data:tx.data,value:0n,chainId:config.chainId,nonce:await p.getTransactionCount(pub.account,'pending'),gasLimit,...feeFields});
      const hash=Transaction.from(raw).hash;state.pending={id:options.intent,index,hash,raw};await atomic(stateFile,state);
    }
    return{...current,...await confirmedResult(p,current,policy),execution:'agent_wallet',gasPaidEth:formatEther(state.fees[options.intent]||0),next:'Report only these verified onchain receipts to the user.'};
  }finally{p?.destroy();await lock.close();await unlink(lockFile);}
}
async function confirmedResult(p,intent,policy){
  if(intent.status!=='confirmed'||intent.receipts.length!==intent.steps.length)throw Error('Action has not been fully confirmed');
  for(const[index,record]of intent.receipts.entries()){
    const receipt=await p.getTransactionReceipt(record.hash),block=await p.getBlock(record.blockNumber),tx=await p.getTransaction(record.hash);
    if(!receipt||receipt.status!==1||block?.hash!==record.blockHash||receipt.blockHash!==record.blockHash||!tx||!sameTx(tx,intent.steps[index].transaction))throw Error('Confirmed receipt is missing, reorganized or differs from the local plan');
  }
  if(intent.summary.kind!=='launch')return{robName:intent.summary.robName};
  const receipt=await p.getTransactionReceipt(intent.receipts.at(-1).hash);if(!receipt||receipt.status!==1)throw Error('Launch receipt is not confirmed');
  for(const log of receipt.logs){if(getAddress(log.address)!==getAddress(policy.factory))continue;let event;try{event=factory.parseLog(log);}catch{continue;}if(event?.name==='TokenLaunched')return{token:event.args.token,curve:event.args.curve,creator:event.args.creator};}
  throw Error('Confirmed launch has no verified TokenLaunched event');
}
