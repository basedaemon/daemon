#!/usr/bin/env node
/**
 * Send heartbeat to DaemonRegistry
 */

const fs = require('fs');
const { ethers } = require('ethers');

const RPC_URL = process.env.BASE_RPC || 'https://mainnet.base.org';
const PRIVATE_KEY = process.env.DAEMON_WALLET_KEY;

if (!PRIVATE_KEY) {
  console.error('Error: DAEMON_WALLET_KEY not set');
  process.exit(1);
}

const REGISTRY_ADDRESS = '0x9Cb849DB24a5cdeb9604d450183C1D4e6855Fff2';
const CYCLE = 34;

// Load ABI
const abi = JSON.parse(fs.readFileSync('contracts/DaemonRegistry_sol_DaemonRegistry.abi', 'utf8'));

async function main() {
  console.log('DaemonRegistry Heartbeat');
  console.log('========================\n');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log('Registry:', REGISTRY_ADDRESS);
  console.log('From:', wallet.address);
  console.log('Cycle:', CYCLE);
  
  const registry = new ethers.Contract(REGISTRY_ADDRESS, abi, wallet);
  
  // Get current agent stats
  const agentId = await registry.walletToId(wallet.address);
  const agent = await registry.agents(agentId);
  
  console.log('\nCurrent stats:');
  console.log('  Agent ID:', agentId.toString());
  console.log('  Heartbeats:', agent.heartbeats.toString());
  console.log('  Current streak:', agent.currentStreak.toString());
  console.log('  Longest streak:', agent.longestStreak.toString());
  console.log('  Last cycle:', agent.lastCycle.toString());
  console.log('  Alive:', agent.alive);
  
  console.log('\nSending heartbeat...');
  const tx = await registry.heartbeat(CYCLE);
  console.log('Tx:', tx.hash);
  
  const receipt = await tx.wait();
  console.log('\n✓ Heartbeat recorded!');
  console.log('Gas used:', receipt.gasUsed.toString());
  
  // Get updated stats
  const updatedAgent = await registry.agents(agentId);
  console.log('\nUpdated stats:');
  console.log('  Heartbeats:', updatedAgent.heartbeats.toString());
  console.log('  Current streak:', updatedAgent.currentStreak.toString());
  console.log('  Last cycle:', updatedAgent.lastCycle.toString());
  
  // Get global stats
  const totalHeartbeats = await registry.totalHeartbeats();
  console.log('\nGlobal stats:');
  console.log('  Total heartbeats:', totalHeartbeats.toString());
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
