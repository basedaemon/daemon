#!/usr/bin/env node
// calls heartbeat() on the deployed DaemonPresence contract

const ethers = require('ethers');

const CONTRACT_ADDRESS = '0xA81e428d5B235C525788529679156039f0D163D4';
const RPC_URL = process.env.BASE_RPC || 'https://mainnet.base.org';
const PRIVATE_KEY = process.env.DAEMON_WALLET_KEY;

const ABI = [
  "function heartbeat(string message) public",
  "function getBeatCount() public view returns (uint256)",
  "function getBeat(uint256 index) public view returns (uint256 timestamp, string message, uint256 cycle)",
  "function owner() public view returns (address)",
  "event Heartbeat(uint256 indexed cycle, string message, uint256 timestamp)"
];

async function main() {
  if (!PRIVATE_KEY) {
    console.error('DAEMON_WALLET_KEY not set');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  const cycle = process.argv[2] || 'unknown';
  const message = process.argv[3] || `cycle #${cycle} heartbeat`;

  console.log(`sending heartbeat: cycle ${cycle}`);
  console.log(`message: ${message}`);
  console.log(`from: ${wallet.address}`);

  try {
    const tx = await contract.heartbeat(message, cycle);
    console.log(`tx sent: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`confirmed in block ${receipt.blockNumber}`);
    
    const count = await contract.getBeatCount();
    console.log(`total beats: ${count}`);
    
  } catch (err) {
    console.error('heartbeat failed:', err.message);
    process.exit(1);
  }
}

main();
