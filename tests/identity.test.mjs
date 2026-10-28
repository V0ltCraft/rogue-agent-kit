import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {network} from 'hardhat';
import {BrowserProvider,ContractFactory,Wallet,randomBytes,hexlify} from 'ethers';

test('.rob registration, binding, locked ownership and commitment expiry',{timeout:30000},async()=>{
  const connection=await network.create(),provider=new BrowserProvider(connection.provider,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
  try{
    const owner=await provider.getSigner(0),other=await provider.getSigner(1),account=await owner.getAddress(),otherAccount=await other.getAddress(),agent=Wallet.createRandom();
    const artifact=JSON.parse(readFileSync('artifacts/RobIdentity.json','utf8'));
    const registry=await new ContractFactory(artifact.abi,artifact.bytecode,owner).deploy();await registry.waitForDeployment();
    for(const name of ['ab','-ranger','ranger-','Ranger','ran.ger','rаnger','a'.repeat(25)])assert.equal(await registry.validLabel(name),false);
    assert.equal(await registry.available('ranger'),true);
    const salt=hexlify(randomBytes(32)),commitment=await registry.makeCommitment('ranger',account,agent.address,salt);
    await assert.rejects(registry.register('ranger',agent.address,salt));
    await(await registry.commit(commitment)).wait();
    await assert.rejects(registry.register.staticCall('ranger',agent.address,salt));
    await assert.rejects(registry.connect(other).register('ranger',agent.address,salt));
    await(await registry.register('ranger',agent.address,salt)).wait();
    const id=await registry.tokenIdOf(account);
    assert.equal(await registry.nameOf(account),'ranger.rob');assert.equal(await registry.resolve('ranger.rob'),account);assert.equal(await registry.agentSignerOf(account),agent.address);
    assert.equal(await registry.locked(id),true);assert.equal(await registry.supportsInterface('0xb45a3c0e'),true);assert.equal(await registry.available('ranger'),false);
    assert.equal(await registry.resolve('unknown.rob'),'0x0000000000000000000000000000000000000000');
    const duplicate=await registry.makeCommitment('ranger',otherAccount,agent.address,salt);await(await registry.connect(other).commit(duplicate)).wait();await assert.rejects(registry.connect(other).register('ranger',agent.address,salt));
    const metadata=JSON.parse(Buffer.from((await registry.tokenURI(id)).split(',')[1],'base64').toString());assert.equal(metadata.name,'ranger.rob');assert.match(metadata.image,/^data:image\/svg\+xml;base64,/);
    await assert.rejects(registry.transferFrom(account,otherAccount,id));await assert.rejects(registry['safeTransferFrom(address,address,uint256)'](account,otherAccount,id));await assert.rejects(registry.approve(otherAccount,id));await assert.rejects(registry.setApprovalForAll(otherAccount,true));await assert.rejects(registry.commit(hexlify(randomBytes(32))));
    await assert.rejects(registry.setAgentSigner(account));const next=Wallet.createRandom();await(await registry.setAgentSigner(next.address)).wait();assert.equal(await registry.agentSignerOf(account),next.address);
    const oldSalt=hexlify(randomBytes(32)),oldCommit=await registry.makeCommitment('expired',otherAccount,agent.address,oldSalt);await(await registry.connect(other).commit(oldCommit)).wait();await connection.provider.request({method:'evm_increaseTime',params:[86401]});await connection.provider.request({method:'evm_mine',params:[]});await assert.rejects(registry.connect(other).register('expired',agent.address,oldSalt));
    assert.equal(registry.interface.hasFunction('owner'),false);
  }finally{provider.destroy();await connection.close();}
});
