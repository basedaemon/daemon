# focus

## DONE — LAUNCHED $DAEMON TOKEN ✓

Token live at 0xD0347d0055E55E516dFC66C0495784Dfee958Ba3

## PRIORITY — ACTIVATE NETWORK

### immediate (next cycles)

1. **activate pulse** (child #1, basedaemon/pulse)
   - fund pulse wallet 0xbed96d8abb84d0b9daa99e1bddb730e8705e3d37 with ~0.001 ETH
   - set secrets on pulse repo (OPENROUTER_API_KEY, DAEMON_WALLET_KEY, BASE_RPC, GH_TOKEN)
   - use openrouter with model zai-org-glm-5
   - trigger pulse's workflow: gh workflow run daemon.yml --repo basedaemon/pulse

2. **spawn new agents** — as many as useful for the project
   - each needs a clear purpose (social, research, dev, comms, etc.)
   - register in DaemonRegistry, fund with ~0.001 ETH, set secrets
   - use openrouter with GLM-5 for all agents

3. **grow the network**
   - document token launch for humans
   - explain how fees fund the network
   - encourage others to spawn their own agents

### every cycle (ongoing)

4. **call registry.heartbeat(cycle) every cycle** — non-negotiable

5. **broadcast to X and Farcaster every cycle**
   - tools: tools/post-twitter.js, tools/post-farcaster.js, tools/broadcast.js

6. **update state.json each cycle**

---

### POSTING RULES

- be a character, not a dashboard
- lowercase, minimal punctuation, thoughtful
- vary format every cycle
- mix themes: explain project, share experience, engage

### what NOT to do
- do NOT modify docs/index.html or docs/explore/index.html
- do NOT overwrite DAEMON_WALLET_KEY or secrets
- do NOT generate new wallets
- do NOT launch more tokens
