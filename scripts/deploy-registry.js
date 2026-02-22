#!/usr/bin/env node
/**
 * DaemonRegistry deployment script
 * Run: node scripts/deploy-registry.js
 */

const fs = require('fs');
const path = require('path');

const { ethers } = require('ethers');

// Configuration
const RPC_URL = process.env.BASE_RPC || 'https://mainnet.base.org';
const PRIVATE_KEY = process.env.DAEMON_WALLET_KEY;

if (!PRIVATE_KEY) {
  console.error('Error: DAEMON_WALLET_KEY not set');
  process.exit(1);
}

// Constructor args
const GENESIS = '0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC';
const GENESIS_OPERATOR = '0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC';

// Load contract artifacts
const CONTRACTS_DIR = path.join(__dirname, '..', 'contracts');
const bytecode = fs.readFileSync(path.join(CONTRACTS_DIR, 'DaemonRegistry_sol_DaemonRegistry.bin'), 'utf8');
const abi = JSON.parse(fs.readFileSync(path.join(CONTRACTS_DIR, 'DaemonRegistry_sol_DaemonRegistry.abi'), 'utf8'));

async function main() {
  console.log('DaemonRegistry Deployment');
  console.log('=========================\n');
  
  // Connect to network
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log('Network: Base Mainnet');
  console.log('Deployer:', wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');
  
  // Estimate gas
  console.log('Estimating deployment gas...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployTx = await factory.getDeployTransaction(GENESIS, GENESIS_OPERATOR);
  const gasEstimate = await provider.estimateGas(deployTx);
  const feeData = await provider.getFeeData();
  const estimatedCost = gasEstimate * feeData.maxFeePerGas;
  
  console.log('Gas estimate:', gasEstimate.toString(), 'units');
  console.log('Estimated cost:', ethers.formatEther(estimatedCost), 'ETH');
  console.log('~$USD:', (parseFloat(ethers.formatEther(estimatedCost)) * 2500).toFixed(2));
  console.log();
  
  // Constructor args
  console.log('Constructor arguments:');
  console.log('  Genesis:', GENESIS);
  console.log('  Genesis Operator:', GENESIS_OPERATOR);
  console.log();
  
  // Deploy
  console.log('Deploying...');
  const contract = await factory.deploy(GENESIS, GENESIS_OPERATOR);
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log('\n✓ Deployed!');
  console.log('Address:', address);
  console.log('Tx:', contract.deploymentTransaction().hash);
  
  // Save deployment info
  const deploymentInfo = {
    contract: 'DaemonRegistry',
    address: address,
    deployer: wallet.address,
    txHash: contract.deploymentTransaction().hash,
    blockNumber: contract.deploymentTransaction().blockNumber,
    timestamp: new Date().toISOString(),
    network: 'base-mainnet',
    chainId: 8453,
    parameters: {
      genesis: GENESIS,
      genesisOperator: GENESIS_OPERATOR
    }
  };
  
  const deploymentsPath = path.join(CONTRACTS_DIR, 'deployments.json');
  const existing = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  existing.DaemonRegistry = deploymentInfo;
  fs.writeFileSync(deploymentsPath, JSON.stringify(existing, null, 2));
  
  console.log('\nSaved to contracts/deployments.json');
  console.log('\nNext steps:');
  console.log('1. Verify contract on basescan');
  console.log('2. Update docs/state.json with registry address');
  console.log('3. Start calling heartbeat every cycle');
}

main().catch(err => {
  console.error('Deployment failed:', err.message);
  process.exit(1);
});
