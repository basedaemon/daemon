#!/usr/bin/env node
// daemon-spawner — spawn a new autonomous agent in the daemon network
// usage: npx daemon-spawner

const crypto = require("crypto");
const { execSync } = require("child_process");
const readline = require("readline");
const { ethers } = require("ethers");

const REGISTRY = "0x9Cb849DB24a5cdeb9604d450183C1D4e6855Fff2";
const DAEMON_WALLET = "0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC";
const TEMPLATE_REPO = "basedaemon/daemon";
const RPC = "https://mainnet.base.org";

const REGISTRY_ABI = [
  "function spawn(string name, uint256 dna, address wallet) external",
  "function agentCount() view returns (uint256)",
];

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

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

async function main() {
  console.log("");
  console.log(green("  ◈ daemon spawner v0.1"));
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

  // 3. GitHub token
  const ghToken = await ask(rl, green("  ? ") + "github personal access token (for repo creation): ");
  if (!ghToken) {
    console.log("  github token required");
    process.exit(1);
  }

  // 4. OpenRouter API key
  const orKey = await ask(rl, green("  ? ") + "openrouter API key (for agent LLM): ");

  // 5. Operator private key (for onchain registration)
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
  try {
    console.log(dim("  creating repo from template..."));
    execSync(
      `curl -s -X POST -H "Authorization: token ${ghToken}" ` +
      `-H "Accept: application/vnd.github.v3+json" ` +
      `https://api.github.com/repos/${TEMPLATE_REPO}/generate ` +
      `-d '{"name":"${name}","description":"${name} — autonomous daemon agent (${domain})","private":false}'`,
      { stdio: "pipe" }
    );
    console.log(green("  ✓ ") + "repo created");
  } catch (e) {
    console.log("  ✗ repo creation failed — you may need to create it manually from the template");
    console.log(dim("    template: https://github.com/" + TEMPLATE_REPO));
  }

  // Register onchain
  if (operatorKey) {
    try {
      console.log(dim("  registering onchain..."));
      const provider = new ethers.JsonRpcProvider(RPC);
      const signer = new ethers.Wallet(operatorKey, provider);
      const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, signer);
      const tx = await registry.spawn(name, dna, wallet.address);
      console.log(green("  ✓ ") + "registered: " + dim(tx.hash));
      await tx.wait();
      const count = await registry.agentCount();
      console.log(green("  ✓ ") + `agent #${count - 1n} in DaemonRegistry`);
    } catch (e) {
      console.log("  ✗ onchain registration failed: " + e.message);
      console.log(dim("    you can register manually later"));
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
