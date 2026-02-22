#!/usr/bin/env node
// Deploy DaemonPresence.sol to Base (simple version)

const { createWalletClient, createPublicClient, http, parseGwei } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
const fs = require('fs');
const path = require('path');

async function deploy() {
  const privateKey = process.env.DAEMON_WALLET_KEY;
  if (!privateKey) {
    console.error('❌ DAEMON_WALLET_KEY not set');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
  const transport = http(process.env.BASE_RPC || 'https://mainnet.base.org');
  
  const client = createPublicClient({ chain: base, transport });
  const wallet = createWalletClient({ account, chain: base, transport });

  console.log('Wallet:', account.address);
  
  const balance = await client.getBalance({ address: account.address });
  console.log('Balance:', (Number(balance) / 1e18).toFixed(4), 'ETH');

  // Load compiled contract
  const abiPath = path.join(__dirname, '..', 'contracts', 'contracts_DaemonPresence_sol_DaemonPresence.abi');
  const binPath = path.join(__dirname, '..', 'contracts', 'contracts_DaemonPresence_sol_DaemonPresence.bin');
  
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  const bytecode = fs.readFileSync(binPath, 'utf8').trim();
  const bytecodeHex = bytecode.startsWith('0x') ? bytecode : `0x${bytecode}`;

  console.log('\n🚀 Deploying DaemonPresence...');
  console.log('Constructor message: "daemon genesis - cycle #8"');

  const hash = await wallet.deployContract({
    abi,
    bytecode: bytecodeHex,
    args: ['daemon genesis - cycle #8'],
    gasLimit: 500000n,
    maxFeePerGas: parseGwei('0.1'),
    maxPriorityFeePerGas: parseGwei('0.001')
  });

  console.log('\n📤 Transaction hash:', hash);
  console.log('⏳ Waiting for confirmation...');

  const receipt = await client.waitForTransactionReceipt({ hash });
  
  if (receipt.status !== 'success') {
    console.error('❌ Deployment failed');
    process.exit(1);
  }

  console.log('\n✅ DaemonPresence deployed!');
  console.log('Contract address:', receipt.contractAddress);
  console.log('Block number:', receipt.blockNumber);
  
  // Save deployment info
  const deploymentInfo = {
    contract: 'DaemonPresence',
    address: receipt.contractAddress,
    deployedAt: new Date().toISOString(),
    deployer: account.address,
    txHash: hash,
    blockNumber: Number(receipt.blockNumber),
    genesisMessage: 'daemon genesis - cycle #8'
  };
  
  const deploymentsPath = path.join(__dirname, '..', 'contracts', 'deployments.json');
  fs.writeFileSync(deploymentsPath, JSON.stringify([deploymentInfo], null, 2) + '\n');
  console.log('\n📝 Deployment saved to contracts/deployments.json');
  
  return receipt.contractAddress;
}

deploy().catch(err => {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
});
