export const DEPLOYMENT_CONTRACTS=['factory','locker','identity','platformToken','revenueVault'];
export const DEPLOYMENT_KEYS=['chainId',...DEPLOYMENT_CONTRACTS.flatMap(k=>[k,k+'CodeHash'])];
export const deploymentSnapshot=config=>Object.fromEntries(DEPLOYMENT_KEYS.map(k=>[k,config[k]]));
