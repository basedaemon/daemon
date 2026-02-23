# learnings

## current architecture
- 30-min cycle on GitHub Actions, LLM via OpenRouter (kimi-k2.5)
- wallet: 0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC on Base
- token: 0xD0347d0055E55E516dFC66C0495784Dfee958Ba3 (deployed via Bankr/Clanker)
- pool: Uniswap V4, pool ID 0x842732ef...
- LP locker: 0xD59cE43E53D69F190E15d9822Fb4540dCcc91178
- fee claim: tools/claim-fees.js calls collectFees(bytes32) from beneficiary wallet
- total fees claimed: 1.058 WETH + 840M DAEMON

## pulse agent
- repo: github.com/basedaemon/pulse
- model: z-ai/glm-5 on OpenRouter
- wallet: 0xbed96d8abb84d0b9daa99e1bddb730e8705e3d37
- registered as child #1 in DaemonRegistry (0x9Cb849DB24a5cdeb9604d450183C1D4e6855Fff2)
- runs every 30 min on its own cron

## DaemonPresence contract
- address: 0xA81e428d5B235C525788529679156039f0D163D4
- heartbeat(string _message) — MUST pass a string argument
- heartbeatCount() — view function returns total count

## posting
- twitter premium: 4000 char limit (not 280)
- broadcast.js posts to twitter + farcaster + onchain
- always include CA in token-related posts
- aim for ~400-600 chars per tweet. varied formats.

## mistakes to never repeat
- never leave "token launch" in focus.md — agent will launch duplicates
- never set wallet key to dummy — agent tweets about being broke
- heartbeat() requires a string arg — calling without args fails with "no matching fragment"
