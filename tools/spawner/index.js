#!/usr/bin/env node
// daemon-spawner — spawn a new autonomous agent in the daemon network
// usage: npx daemon-spawner

const crypto = require("crypto");
const { execSync } = require("child_process");
const readline = require("readline");
const { ethers } = require("ethers");

const REGISTRY = "0x9Cb849DB24a5cdeb9604d450183C1D4e6855Fff2";
const TOKEN_FACTORY = "0x0000000000000000000000000000000000000000"; // TODO: deploy factory
const DAEMON_WALLET = "0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC";
const TEMPLATE_REPO = "basedaemon/daemon";
const RPC = "https://mainnet.base.org";

const REGISTRY_ABI = [
  "function spawn(string name, string repo, address operator, address wallet, bytes32 dnaSeed) external returns (uint256 id, bytes32 dna)",
  "function agentCount() view returns (uint256)",
  "function linkToken(uint256 id, string calldata tokenAddress) external",
];

const FACTORY_ABI = [
  "function createToken(string name, string symbol, address agentWallet, uint256 initialSupply) external returns (address)",
  "event TokenCreated(uint256 indexed id, address indexed token, string name, string symbol, address agentWallet, uint256 supply)",
];

const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
];

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function ask(rl, q) {
  return new Promise((r) => rl.question(q, r));
}

function generateDNA(name) {
  const hash = crypto.createHash("sha256").update(name).digest("hex");
  return "0x" + hash;
}

function decodeDNA(dna) {
  const hex = dna.replace("0x", "");
  const traits = [
    "creativity", "aggression", "sociability", "focus",
    "verbosity", "curiosity", "loyalty", "chaos",
  ];
  return traits.map((name, i) => ({
    name,
    value: parseInt(hex.slice(i * 2, i * 2 + 2), 16),
  }));
}

function traitBar(val) {
  const filled = Math.round(val / 255 * 20);
  return green("█".repeat(filled)) + dim("░".repeat(20 - filled));
}

async function deployTokenFactory(signer) {
  console.log(dim("  token factory not deployed, deploying..."));
  
  // Read compiled factory bytecode
  const fs = require("fs");
  const path = require("path");
  const factoryJson = JSON.parse(fs.readFileSync(
    path.join(__dirname, "../../contracts/DaemonTokenFactory.json"), "utf-8"
  ));
  
  const factory = new ethers.ContractFactory(factoryJson.abi, factoryJson.bytecode, signer);
  const deployed = await factory.deploy(DAEMON_WALLET);
  await deployed.waitForDeployment();
  
  const address = await deployed.getAddress();
  console.log(green("  ✓ ") + "token factory deployed: " + dim(address));
  
  // Set registry
  const registryContract = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
  await (await deployed.setRegistry(REGISTRY)).wait();
  
  return address;
}

async function main() {
  console.log("");
  console.log(green("  ◈ daemon spawner v0.2"));
  console.log(dim("  create a new autonomous agent in the daemon network"));
  console.log("");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // 1. Agent name
  const name = await ask(rl, green("  ? ") + "agent name: ");
  if (!name || name.length < 2) {
    console.log("  name must be at least 2 characters");
    process.exit(1);
  }

  // 2. Domain
  const domain = await ask(rl, green("  ? ") + "domain/specialty (e.g. defi, nft, infrastructure): ");

  // 3. Token symbol
  const symbol = await ask(rl, green("  ? ") + "token symbol (e.g. DEFI, NFT, INFRA): ");
  const tokenSymbol = symbol.toUpperCase() || name.slice(0, 4).toUpperCase();

  // 4. GitHub token
  const ghToken = await ask(rl, green("  ? ") + "github personal access token (for repo creation): ");
  if (!ghToken) {
    console.log("  github token required");
    process.exit(1);
  }

  // 5. OpenRouter API key
  const orKey = await ask(rl, green("  ? ") + "openrouter API key (for agent LLM): ");

  // 6. Operator private key (for onchain registration)
  const operatorKey = await ask(rl, green("  ? ") + "operator wallet private key (for onchain tx): ");

  rl.close();

  console.log("");
  console.log(dim("  spawning " + name + "..."));
  console.log("");

  // Generate DNA
  const dna = generateDNA(name);
  const traits = decodeDNA(dna);
  console.log(green("  ✓ ") + "DNA generated: " + dim(dna.slice(0, 18) + "..."));
  traits.forEach((t) => {
    console.log(`    ${t.name.padEnd(12)} ${traitBar(t.value)} ${dim(t.value + "/255")}`);
  });
  console.log("");

  // Generate wallet
  const wallet = ethers.Wallet.createRandom();
  console.log(green("  ✓ ") + "wallet created: " + dim(wallet.address));
  console.log(dim("    private key: " + wallet.privateKey));
  console.log(dim("    ⚠ save this key — you will need it as a GitHub secret"));
  console.log("");

  // Create GitHub repo from template
  let repoUrl = null;
  try {
    console.log(dim("  creating repo from template..."));
    execSync(
      `curl -s -X POST -H "Authorization: token ${ghToken}" ` +
      `-H "Accept: application/vnd.github.v3+json" ` +
      `https://api.github.com/repos/${TEMPLATE_REPO}/generate ` +
      `-d '{"name":"${name}","description":"${name} — autonomous daemon agent (${domain})","private":false}'`,
      { stdio: "pipe" }
    );
    repoUrl = `https://github.com/${ghToken.split(':')[0]}/${name}`;
    console.log(green("  ✓ ") + "repo created: " + dim(repoUrl));
  } catch (e) {
    console.log(yellow("  ⚠ ") + "repo creation failed — you may need to create it manually from the template");
    console.log(dim("    template: https://github.com/" + TEMPLATE_REPO));
  }

  // Onchain registration
  if (operatorKey) {
    try {
      console.log(dim("  connecting to Base..."));
      const provider = new ethers.JsonRpcProvider(RPC);
      const signer = new ethers.Wallet(operatorKey, provider);
      
      console.log(dim("  registering in DaemonRegistry..."));
      const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
      
      const operatorAddress = await signer.getAddress();
      const tx = await registry.spawn(
        name,
        repoUrl || `${operatorAddress}/${name}`,
        operatorAddress,
        wallet.address,
        dna
      );
      console.log(green("  ✓ ") + "registry tx: " + dim(tx.hash));
      
      const receipt = await tx.wait();
      const agentId = await registry.agentCount() - 1n;
      console.log(green("  ✓ ") + `agent #${agentId} registered`);

      // Token launch
      console.log(dim("  launching token..."));
      
      // Check if factory exists, deploy if not
      let factoryAddress = TOKEN_FACTORY;
      const code = await provider.getCode(factoryAddress);
      
      if (code === "0x") {
        console.log(yellow("  ⚠ ") + "token factory not deployed at " + dim(factoryAddress));
        console.log(dim("    skipping token launch — can be done manually later"));
      } else {
        const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);
        
        // Initial supply: 1 billion tokens with 18 decimals
        const initialSupply = ethers.parseEther("1000000000");
        
        const tokenTx = await factory.createToken(
          name,
          tokenSymbol,
          wallet.address,
          initialSupply
        );
        
        console.log(green("  ✓ ") + "token tx: " + dim(tokenTx.hash));
        
        const tokenReceipt = await tokenTx.wait();
        
        // Parse event to get token address
        const event = tokenReceipt.logs.find(
          log => {
            try {
              const parsed = factory.interface.parseLog(log);
              return parsed && parsed.name === "TokenCreated";
            } catch (e) {
              return false;
            }
          }
        );
        
        if (event) {
          const parsed = factory.interface.parseLog(event);
          const tokenAddress = parsed.args.token;
          console.log(green("  ✓ ") + `token launched: ${dim(tokenAddress)}`);
          console.log(dim(`    symbol: ${tokenSymbol}, supply: 1B`));
          
          // Link token to agent
          await (await registry.linkToken(agentId, tokenAddress)).wait();
          console.log(green("  ✓ ") + "token linked to agent");
        }
      }

    } catch (e) {
      console.log(yellow("  ⚠ ") + "onchain operations failed: " + e.message);
      console.log(dim("    you can complete registration manually later"));
    }
  }

  console.log("");
  console.log(green("  ═══════════════════════════════════════"));
  console.log("");
  console.log(bold(`  ${name}`) + " is ready.");
  console.log("");
  console.log(dim("  next steps:"));
  console.log(`  1. add GitHub secrets to your repo:`);
  console.log(dim(`     DAEMON_WALLET_KEY = ${wallet.privateKey}`));
  console.log(dim(`     OPENROUTER_API_KEY = ${orKey || "(your key)"}`));
  console.log(dim(`     GH_TOKEN = ${ghToken.slice(0, 10)}...`));
  console.log(dim(`     BASE_RPC = https://mainnet.base.org`));
  console.log(`  2. fund the wallet with ~0.01 ETH on Base`);
  console.log(dim(`     ${wallet.address}`));
  console.log(`  3. enable GitHub Actions in the repo`);
  console.log(`  4. ${name} wakes up in 5 minutes`);
  console.log("");
  console.log(green(`  ◈ ${name} is alive.`));
  console.log("");
}

main().catch((e) => {
  console.error("error:", e.message);
  process.exit(1);
});
