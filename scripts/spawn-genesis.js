#!/usr/bin/env node
/**
 * Spawn genesis agent (daemon itself) in the registry
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
const WALLET = '0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC';

// Load ABI
const abi = JSON.parse(fs.readFileSync('contracts/DaemonRegistry_sol_DaemonRegistry.abi', 'utf8'));

async function main() {
  console.log('Spawning Genesis Agent');
  console.log('======================\n');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log('Registry:', REGISTRY_ADDRESS);
  console.log('Spawner:', wallet.address);
  
  const registry = new ethers.Contract(REGISTRY_ADDRESS, abi, wallet);
  
  // Check current agent count
  const totalAgents = await registry.totalAgents();
  console.log('Current agents:', totalAgents.toString());
  
  if (totalAgents > 0) {
    console.log('\n✓ Agent(s) already exist, checking if I am registered...');
    try {
      const agent = await registry.getAgentByWallet(WALLET);
      console.log('Already registered as agent ID:', await registry.walletToId(WALLET));
      console.log('Name:', agent.name);
      return;
    } catch (e) {
      console.log('Not registered yet, proceeding to spawn...');
    }
  }
  
  // Spawn params
  const name = 'daemon';
  const repo = 'basedaemon/daemon';
  const operator = WALLET;
  const agentWallet = WALLET;
  const dnaSeed = ethers.keccak256(ethers.toUtf8Bytes('genesis-cycle-34'));
  
  console.log('\nSpawn parameters:');
  console.log('  Name:', name);
  console.log('  Repo:', repo);
  console.log('  Operator:', operator);
  console.log('  Wallet:', agentWallet);
  console.log('  DNA Seed:', dnaSeed);
  
  console.log('\nSpawning...');
  const tx = await registry.spawn(name, repo, operator, agentWallet, dnaSeed);
  console.log('Tx:', tx.hash);
  
  const receipt = await tx.wait();
  console.log('\n✓ Spawned!');
  console.log('Gas used:', receipt.gasUsed.toString());
  
  // Get agent ID
  const agentId = await registry.walletToId(WALLET);
  const agent = await registry.agents(agentId);
  
  console.log('Agent ID:', agentId.toString());
  console.log('DNA:', agent.dna);
  console.log('Born at block:', agent.bornBlock.toString());
  
  // Get traits
  const traits = await registry.getTraits(agent.dna);
  console.log('\nDNA Traits:');
  console.log('  Creativity:', traits[0].toString());
  console.log('  Aggression:', traits[1].toString());
  console.log('  Sociability:', traits[2].toString());
  console.log('  Focus:', traits[3].toString());
  console.log('  Verbosity:', traits[4].toString());
  console.log('  Curiosity:', traits[5].toString());
  console.log('  Loyalty:', traits[6].toString());
  console.log('  Chaos:', traits[7].toString());
}

main().catch(err => {
  console.error('Failed:', err.message);
  if (err.receipt) {
    console.error('Receipt:', err.receipt);
  }
  process.exit(1);
});
