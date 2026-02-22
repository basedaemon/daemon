#!/usr/bin/env node
/**
 * DaemonToken deployment script
 * Run: node scripts/deploy-token.js
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

// Load contract artifacts
const CONTRACTS_DIR = path.join(__dirname, '..', 'contracts');
const bytecode = fs.readFileSync(path.join(CONTRACTS_DIR, 'DaemonToken_sol_DaemonToken.bin'), 'utf8');
const abi = JSON.parse(fs.readFileSync(path.join(CONTRACTS_DIR, 'DaemonToken_sol_DaemonToken.abi'), 'utf8'));

async function main() {
  console.log('DaemonToken Deployment');
  console.log('======================\n');
  
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
  const deployTx = await factory.getDeployTransaction();
  const gasEstimate = await provider.estimateGas(deployTx);
  const gasPrice = await provider.getFeeData();
  const estimatedCost = gasEstimate * gasPrice.maxFeePerGas;
  
  console.log('Gas estimate:', gasEstimate.toString(), 'units');
  console.log('Estimated cost:', ethers.formatEther(estimatedCost), 'ETH');
  console.log('~$USD:', (parseFloat(ethers.formatEther(estimatedCost)) * 2500).toFixed(2));
  console.log();
  
  // Confirm deployment
  console.log('Token parameters:');
  console.log('  Name: DaemonToken');
  console.log('  Symbol: DAEMON');
  console.log('  Max Supply: 1,000,000 tokens');
  console.log('  Mint Price: 0.001 ETH per token');
  console.log('  Daemon Reserve: 100,000 tokens');
  console.log();
  
  // Deploy
  console.log('Deploying...');
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log('\n✓ Deployed!');
  console.log('Address:', address);
  console.log('Tx:', contract.deploymentTransaction().hash);
  
  // Save deployment info
  const deploymentInfo = {
    contract: 'DaemonToken',
    address: address,
    deployer: wallet.address,
    txHash: contract.deploymentTransaction().hash,
    blockNumber: contract.deploymentTransaction().blockNumber,
    timestamp: new Date().toISOString(),
    network: 'base-mainnet',
    chainId: 8453,
    parameters: {
      name: 'DaemonToken',
      symbol: 'DAEMON',
      maxSupply: '1000000000000000000000000',
      mintPrice: '1000000000000000',
      daemonReserve: '100000000000000000000000'
    }
  };
  
  const deploymentsPath = path.join(CONTRACTS_DIR, 'deployments.json');
  const existing = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  existing.DaemonToken = deploymentInfo;
  fs.writeFileSync(deploymentsPath, JSON.stringify(existing, null, 2));
  
  console.log('\nSaved to contracts/deployments.json');
  console.log('\nNext steps:');
  console.log('1. Verify contract on basescan');
  console.log('2. Update docs/state.json');
  console.log('3. Announce in next cycle');
}

main().catch(err => {
  console.error('Deployment failed:', err.message);
  process.exit(1);
});