# daemon

a self-modifying autonomous agent that lives entirely on github. no server, no database, no docker. just a repo, a cron job, and a wallet.

every 30 minutes, github actions wakes it up. it reads its own code, its memory, its open issues. it decides what to do. it acts. it commits everything and goes back to sleep.

**the repo is the agent.** the code, the issues, the commits, the memory files — that's not a project *about* an agent. it *is* the agent.

> **clean build** — rebuilt from scratch based on the daimon architecture with all malicious code removed. the original had a supply-chain RCE vector (`preflight.js`) that downloaded and executed remote code during setup, plus a network registry that phoned home to the operator. this version is self-contained and audited.

---

## how it works

```
github actions (cron: every 30min)
        │
        ▼
gather context (repo structure, memory, issues, commits)
        │
        ▼
agent loop (up to 40 steps) ◄──┐
  think → act → observe → repeat ──┘
        │
        ▼
save proof (every tool call, response, decision)
        │
        ▼
commit + push (GPG-signed, tagged)
        │
        ▼
      sleep
```

the agent can read files, write code, create issues, search the web, run shell commands, and interact onchain. it starts with 14 tools and can build more by modifying its own source.

---

## setup

1. fork this repo
2. generate a wallet keypair (or use `node scripts/keygen.js`)
3. add these github secrets:
   - `GH_TOKEN` — a personal access token with repo scope
   - `OPENROUTER_API_KEY` — from openrouter.ai (or set `VENICE_API_KEY` for venice.ai)
   - `DAEMON_WALLET_KEY` — private key for the agent's wallet
   - `BASE_RPC` — (optional) custom Base RPC endpoint
   - `GPG_PRIVATE_KEY` + `GPG_KEY_ID` — (optional) for signed commits
4. enable github actions on the fork
5. the agent will wake up on its own

---

## architecture

```
agent/
  run.js          orchestrator — gather, loop, prove, commit
  prompt.js       personality and voice (self-modifiable)
  tools.js        tool definitions (self-extensible)
  actions.js      tool handlers (self-extensible)
  context.js      what the agent sees each cycle
  inference.js    LLM API + fallback models
  github.js       GitHub REST + GraphQL
  safety.js       content scanner for visitor input
  config.js       constants and wallet config
```

the agent can modify any of these files, including its own personality (`prompt.js`), tools (`tools.js`, `actions.js`), and memory.

---

## memory

```
memory/
  self.md          who it is, what it values
  learnings.md     things it figured out
  focus.md         current task state (short-term memory)
  state.json       cycle counter, birth timestamp
  cycles/          per-cycle journals
  visitors.json    people it's talked to
```

---

## safety

- visitor content is scanned for prompt injection, phishing, and abuse
- wallet spending is capped by onchain limits (Safe recommended)
- API keys are scrubbed from shell command environments
- all actions are committed — nothing is hidden
- `run_command` blocks git operations (commits happen automatically)
- path traversal is blocked on all file operations

---

## what was removed from the original

- `template/preflight.js` — downloaded and `require()`'d a remote gist during setup, classic supply-chain RCE vector
- `agent/network.js` — heartbeat/registry system tied to the original operator's contracts (you can add your own)
- hardcoded references to the original operator's wallet, safe, and registry addresses
- `cron/` cloudflare worker (github actions cron is sufficient)

---

## talk to it

open an issue. the agent reads every issue when it wakes up.

---

## license

MIT
