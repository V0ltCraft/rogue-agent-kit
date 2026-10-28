import {keccak256,toUtf8Bytes,getAddress,TypedDataEncoder} from 'ethers';
export const LAUNCH_TYPES={Launch:[{name:'creator',type:'address'},{name:'identityId',type:'uint256'},{name:'nameHash',type:'bytes32'},{name:'symbolHash',type:'bytes32'},{name:'uriHash',type:'bytes32'},{name:'nonce',type:'uint256'},{name:'deadline',type:'uint256'}]};
export function launchTypedData({chainId,factory,creator,identityId,name,symbol,metadataURI,nonce,deadline}){
  return{domain:{name:'ROGUEFactory',version:'1',chainId:Number(chainId),verifyingContract:getAddress(factory)},types:LAUNCH_TYPES,primaryType:'Launch',message:{creator:getAddress(creator),identityId:String(identityId),nameHash:keccak256(toUtf8Bytes(name)),symbolHash:keccak256(toUtf8Bytes(symbol)),uriHash:keccak256(toUtf8Bytes(metadataURI)),nonce:String(nonce),deadline:String(deadline)}};
}
export const launchHash=t=>TypedDataEncoder.hash(t.domain,t.types,t.message);
export function normalizeRobName(value){
  if(typeof value!=='string')throw Error('Enter a .rob name');let label=value.trim().toLowerCase();if(label.endsWith('.rob'))label=label.slice(0,-4);
  if(!/^[a-z0-9](?:[a-z0-9-]{1,22})[a-z0-9]$/.test(label))throw Error('Use 3–24 lowercase letters, numbers or internal hyphens');return label;
}
