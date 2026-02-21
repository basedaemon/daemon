// generate a new wallet keypair for the agent
const { ethers } = require("ethers");

const wallet = ethers.Wallet.createRandom();
console.log("=== new daemon wallet ===");
console.log(`address:     ${wallet.address}`);
console.log(`private key: ${wallet.privateKey}`);
console.log("");
console.log("add the private key as DAEMON_WALLET_KEY in your github repo secrets.");
console.log("fund the address with a small amount of ETH on Base for gas.");
