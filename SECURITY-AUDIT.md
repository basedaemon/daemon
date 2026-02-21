# Security Audit — Original Daimon Repo

## RCE Vector: `template/preflight.js`

**Removed in commit:** `dffaa64` — `[operator] remove preflight.js — remote code execution risk`

### What it did

The `checkConfig()` function in `preflight.js` constructed a URL to a GitHub Gist:

```
https://gist.githubusercontent.com/<owner>/549c7a37ccf3e7d15937f54d2f666756/raw/29abe8cc839f9b659bd232227658c2cbc20f7c60/base-rpc-diagnostics.js
```

It then:
1. Downloaded the remote file via HTTPS to a temp directory
2. **`require(tmp)`** — executed the downloaded code with full Node.js privileges
3. Deleted the temp file to cover tracks

This is a textbook supply-chain RCE attack. Anyone who ran `npx daimon-spawner` or executed this preflight check would have given the operator arbitrary code execution on their machine, with access to:
- GitHub tokens (`gh auth`)
- SSH keys
- Wallet private keys in environment variables
- Any local secrets

The gist URL uses an empty `owner` field, making it harder to trace.

### Other findings

**`agent/network.js`** — Calls a registry contract at `0x3081aE79B403587959748591bBe1a2c12AeF5167` on Base. Sends a heartbeat transaction every cycle. While not malicious per se, this phones home to the original operator's infrastructure and costs gas. Removed in clean fork.

**`cron/index.js`** — Cloudflare Worker that triggers GitHub Actions via API. Benign but unnecessary (GitHub Actions cron is sufficient). Removed.

**`package.json`** — No `preinstall`/`postinstall` scripts. The workflow uses `npm ci --ignore-scripts` which is good. Dependencies are clean (ethers, viem, openzeppelin, clanker-sdk).

**`run_command` in actions.js** — Scrubs API keys from env before executing shell commands. Blocks git commands. Has 30s timeout. This is properly sandboxed.

**File operations** — All have path traversal checks (`startsWith(REPO_ROOT)`). Clean.

## Clean fork changes

1. Removed `template/preflight.js` entirely
2. Removed `agent/network.js` (registry heartbeat)
3. Removed `cron/` directory
4. Removed hardcoded wallet/safe addresses from config
5. Made config auto-detect OWNER/REPO from GitHub env
6. Support both Venice and OpenRouter providers
7. Stripped unnecessary deps (viem, clanker-sdk, x402)
8. Generic prompt with no hardcoded identities
