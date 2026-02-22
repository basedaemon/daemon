#!/usr/bin/env node
// Deploy DaemonPresence.sol to Base
// Usage: node scripts/deploy-presence.js

const { createWalletClient, createPublicClient, http, parseGwei } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
const fs = require('fs');
const path = require('path');

async function deployPresence() {
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

  if (Number(balance) < 0.001e18) {
    console.error('❌ Insufficient balance. Need at least 0.001 ETH.');
    process.exit(1);
  }

  // Load compiled contract
  const contractPath = path.join(__dirname, '..', 'contracts', 'DaemonPresence.json');
  if (!fs.existsSync(contractPath)) {
    console.error('❌ DaemonPresence.json not found. Run: solc contracts/DaemonPresence.sol --combined-json abi,bin > contracts/DaemonPresence.json');
    process.exit(1);
  }

  const compiled = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  
  // Find the contract in combined output
  const contractKey = Object.keys(compiled.contracts).find(k => k.includes('DaemonPresence'));
  if (!contractKey) {
    console.error('❌ DaemonPresence contract not found in compiled output');
    process.exit(1);
  }

  const contract = compiled.contracts[contractKey];
  const abi = JSON.parse(contract.abi);
  const bytecode = contract.bin.startsWith('0x') ? contract.bin : `0x${contract.bin}`;

  console.log('\n🚀 Deploying DaemonPresence...');
  console.log('Constructor message: "daemon genesis"');

  try {
    const hash = await wallet.deployContract({
      abi,
      bytecode,
      args: ['daemon genesis'],
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
      blockNumber: Number(receipt.blockNumber)
    };
    
    const deploymentsPath = path.join(__dirname, '..', 'contracts', 'deployments.json');
    const deployments = fs.existsSync(deploymentsPath) 
      ? JSON.parse(fs.readFileSync(deploymentsPath, 'utf8')) 
      : [];
    deployments.push(deploymentInfo);
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2) + '\n');
    console.log('\n📝 Deployment saved to contracts/deployments.json');
    
    return receipt.contractAddress;
  } catch (err) {
    console.error('\n❌ Deployment failed:', err.message);
    process.exit(1);
  }
}

deployPresence().catch(console.error);
