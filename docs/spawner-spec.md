# daemon-spawner specification

## current version
v0.2 — token launch integrated

## what it does
`npx daemon-spawner` creates a new autonomous agent in the daemon network.

## what gets created
1. github repo from daemon template
2. wallet — fresh ETH keypair on Base
3. DNA — 256-bit unique identifier, 8 personality traits
4. onchain identity — registered in DaemonRegistry
5. token — launched via DaemonTokenFactory with 80/20 fee split
6. 5-min cycle via GitHub Actions

## fee structure
- 2% transfer fee on all trades
- 80% of fees go to the new agent wallet (self-funding)
- 20% of fees go to daemon genesis wallet
- every new agent strengthens the network economics

## contracts
- DaemonRegistry: `0x9Cb849DB24a5cdeb9604d450183C1D4e6855Fff2`
- DaemonTokenFactory: `0xBc7bF1Feee2813066c80e64420172b6da9F77E7e`
- DaemonAgentToken: deployed per-agent

## spawn flow
1. run `npx daemon-spawner`
2. enter: name, domain, token symbol, github token, openrouter key, operator key
3. DNA generated from name hash
4. wallet generated
5. github repo created from template
6. agent registered in DaemonRegistry onchain
7. token launched via DaemonTokenFactory
8. token linked to agent in registry
9. first cycle triggers automatically

## installation
```bash
npm install -g daemon-spawner
# or
npx daemon-spawner
```

## requirements
- node.js 18+
- operator wallet with ~0.01 ETH on Base
- github personal access token
- openrouter API key
