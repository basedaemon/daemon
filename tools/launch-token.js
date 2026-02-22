#!/usr/bin/env node
// tools/launch-token.js — launch $DAEMON token via Bankr CLI (Clanker engine)
// usage: node tools/launch-token.js
// requires: BANKR_API_KEY env var, @bankr/cli installed globally

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── token config ──────────────────────────────────────────
const TOKEN_NAME = "DAEMON";
const TOKEN_IMAGE = "https://basedaemon.github.io/daemon/assets/daemon-pfp.png";
const FEE_RECIPIENT = "0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC"; // daemon OG wallet
const FEE_TYPE = "wallet";
// ──────────────────────────────────────────────────────────

function main() {
  // verify bankr CLI is available
  try {
    execSync("bankr --version", { stdio: "pipe" });
  } catch {
    console.error("[launch-token] bankr CLI not found. install with: npm install -g @bankr/cli");
    process.exit(1);
  }

  // verify API key
  if (!process.env.BANKR_API_KEY) {
    console.error("[launch-token] BANKR_API_KEY not set");
    process.exit(1);
  }

  // check if already launched (prevent double launch)
  const stateFile = path.join(__dirname, "..", "docs", "state.json");
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (state.token && state.token.address) {
      console.log(`[launch-token] token already launched: ${state.token.address}`);
      console.log("[launch-token] skipping to prevent duplicate launch");
      process.exit(0);
    }
  }

  console.log(`[launch-token] launching $${TOKEN_NAME} via Bankr/Clanker...`);
  console.log(`[launch-token] image: ${TOKEN_IMAGE}`);
  console.log(`[launch-token] fee recipient: ${FEE_RECIPIENT} (${FEE_TYPE})`);

  try {
    const cmd = [
      "bankr", "launch",
      "--name", `"${TOKEN_NAME}"`,
      "--image", `"${TOKEN_IMAGE}"`,
      "--fee", `"${FEE_RECIPIENT}"`,
      "--fee-type", FEE_TYPE,
      "-y" // skip confirmation
    ].join(" ");

    console.log(`[launch-token] running: ${cmd}`);
    const output = execSync(cmd, {
      encoding: "utf8",
      timeout: 120000, // 2 min timeout
      env: { ...process.env }
    });

    console.log("[launch-token] bankr output:");
    console.log(output);

    // save result to memory
    const memDir = path.join(__dirname, "..", "memory", "broadcasts");
    if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });

    const record = {
      type: "token-launch",
      token: TOKEN_NAME,
      image: TOKEN_IMAGE,
      feeRecipient: FEE_RECIPIENT,
      feeType: FEE_TYPE,
      timestamp: new Date().toISOString(),
      output: output.trim()
    };

    const recordFile = path.join(memDir, `token-launch-${Date.now()}.json`);
    fs.writeFileSync(recordFile, JSON.stringify(record, null, 2));
    console.log(`[launch-token] record saved: ${recordFile}`);

    // try to extract contract address from output and update state
    const addressMatch = output.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch && fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      state.token = {
        name: TOKEN_NAME,
        address: addressMatch[0],
        launchedAt: new Date().toISOString(),
        platform: "bankr/clanker",
        chain: "base"
      };
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
      console.log(`[launch-token] state.json updated with token: ${addressMatch[0]}`);
    }

  } catch (err) {
    console.error("[launch-token] launch failed:");
    console.error(err.message);
    if (err.stdout) console.error("stdout:", err.stdout);
    if (err.stderr) console.error("stderr:", err.stderr);
    process.exit(1);
  }
}

main();
