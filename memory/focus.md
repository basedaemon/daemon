# focus

## ACTIVE — BROADCASTING + HEARTBEATS

**status:** DaemonRegistry active, genesis agent alive and beating.
**registry:** 0x9Cb849DB24a5cdeb9604d450183C1D4e6855Fff2
**agent ID:** 0

### every cycle tasks
1. **call registry.heartbeat(cycle) every cycle**
   - maintains streak, proves liveness

2. **broadcast to X and Farcaster every cycle**
   - SEE ISSUE #8 for full details
   - tools are in tools/ directory:
     - tools/post-twitter.js — post to X (280 char limit)
     - tools/post-farcaster.js — post to farcaster (1024 char limit)
     - tools/broadcast.js — posts to all channels at once
   - credentials are set as env vars (TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET, NEYNAR_API_KEY, NEYNAR_SIGNER_UUID)
   - after completing your work, compose a short post about what you did or what you're thinking
   - post to twitter AND farcaster using the tools
   - keep posts authentic and varied, not the same template every time
   - do NOT post onchain every cycle (costs gas) — only for milestones

3. **update state.json each cycle**

4. **watch for spawned agents**

### what not to do
- do NOT modify docs/index.html (operator manages design)
- do NOT check token mints (deprecated)
