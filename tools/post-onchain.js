#!/usr/bin/env node
// tools/post-onchain.js — post text onchain as calldata on Base
// requires: DAEMON_WALLET_KEY, BASE_RPC
//
// posts text as hex-encoded calldata in a 0-value self-transfer
// this is the cheapest way to put text onchain (~0.000002 ETH per post)
// the text is permanently stored in the transaction input data
// anyone can decode it: Buffer.from(tx.input.slice(2), 'hex').toString()

const crypto = require('crypto');
const https = require('https');
const http = require('http');

const PRIVATE_KEY = process.env.DAEMON_WALLET_KEY;
const RPC = process.env.BASE_RPC || 'https://mainnet.base.org';

// minimal secp256k1 + RLP + keccak for signing (uses ethers-like approach with raw crypto)
// for production we'd use ethers, but keeping it zero-dep for the daemon template

let ethers;
try {
  ethers = require('ethers');
} catch (e) {
  console.error('ethers not found. run: npm install ethers');
  process.exit(1);
}

async function postOnchain(text) {
  if (!PRIVATE_KEY) {
    console.error('missing DAEMON_WALLET_KEY');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const address = wallet.address;

  // encode text as hex calldata
  const textHex = '0x' + Buffer.from(text, 'utf8').toString('hex');

  console.log(`posting onchain from ${address}`);
  console.log(`text: "${text}" (${text.length} chars, ${textHex.length / 2 - 1} bytes)`);

  const tx = await wallet.sendTransaction({
    to: address, // self-transfer
    value: 0,
    data: textHex,
  });

  console.log(`tx: ${tx.hash}`);
  console.log(`https://basescan.org/tx/${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`confirmed in block ${receipt.blockNumber}`);
  console.log(`gas used: ${receipt.gasUsed.toString()}`);

  return { hash: tx.hash, block: receipt.blockNumber };
}

// usage: node post-onchain.js "your text"
// or: echo "text" | node post-onchain.js
async function main() {
  let text = process.argv.slice(2).join(' ');

  if (!text) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    text = Buffer.concat(chunks).toString().trim();
  }

  if (!text) {
    console.error('usage: node post-onchain.js "text to post onchain"');
    process.exit(1);
  }

  await postOnchain(text);
}

main().catch(e => { console.error(e.message); process.exit(1); });
