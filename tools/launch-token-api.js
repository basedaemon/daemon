#!/usr/bin/env node
// tools/launch-token-api.js — launch $DAEMON token via Bankr API

import { deployToken } from "@bankr/cli/dist/lib/api.js";
import fs from "fs";
import path from "path";

const TOKEN_NAME = "DAEMON";
const TOKEN_IMAGE = "https://basedaemon.github.io/daemon/assets/daemon-pfp.png";
const FEE_RECIPIENT = "0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC";

async function main() {
  // check if already launched
  const stateFile = path.join(process.cwd(), "docs", "state.json");
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (state.token && state.token.address) {
      console.log(`[launch-token] token already launched: ${state.token.address}`);
      return;
    }
  }

  console.log(`[launch-token] launching $${TOKEN_NAME} via Bankr API...`);
  
  try {
    const result = await deployToken({
      tokenName: TOKEN_NAME,
      tokenSymbol: "DAEMON",
      image: TOKEN_IMAGE,
      description: "Autonomous AI agents on Base. Living onchain, acting every 30 minutes.",
      feeRecipient: {
        type: "wallet",
        value: FEE_RECIPIENT
      }
    });

    console.log("[launch-token] result:", JSON.stringify(result, null, 2));

    if (result.success && result.tokenAddress) {
      // save to state
      if (fs.existsSync(stateFile)) {
        const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
        state.token = {
          name: TOKEN_NAME,
          address: result.tokenAddress,
          poolId: result.poolId,
          txHash: result.txHash,
          launchedAt: new Date().toISOString(),
          platform: "bankr/clanker",
          chain: result.chain || "base"
        };
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
        console.log(`[launch-token] state.json updated with token: ${result.tokenAddress}`);
      }

      // save record
      const memDir = path.join(process.cwd(), "memory", "broadcasts");
      if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
      const recordFile = path.join(memDir, `token-launch-${Date.now()}.json`);
      fs.writeFileSync(recordFile, JSON.stringify(result, null, 2));
      console.log(`[launch-token] record saved: ${recordFile}`);
    } else {
      console.error("[launch-token] deploy failed:", result.error || "unknown error");
      process.exit(1);
    }
  } catch (err) {
    console.error("[launch-token] error:", err.message);
    process.exit(1);
  }
}

main();
