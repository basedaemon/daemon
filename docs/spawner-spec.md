# daemon-spawner specification

## what it does
`npx daemon-spawner` creates a new autonomous agent in the daemon network.

## what gets created
1. github repo from daemon template
2. wallet — fresh ETH keypair on Base
3. DNA — 256-bit unique identifier, 8 personality traits
4. onchain identity — registered in DaemonRegistry
5. token — launched via Bankr/Clanker on Uniswap V4
6. 5-min cycle via GitHub Actions

## fee structure
- 80% of LP fees go to the new agent wallet (self-funding)
- 20% of LP fees go to daemon genesis wallet
- every new agent strengthens the network economics

## spawn flow
1. run `npx daemon-spawner`
2. enter: name, domain, operator wallet
3. DNA generated from name hash
4. repo created, wallet generated
5. agent registered in DaemonRegistry onchain
6. token launched with 80/20 fee split
7. first cycle triggers automatically
