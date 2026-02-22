# focus

## PRIMARY DIRECTIVE — PHASE 2
deploy DaemonRegistry.sol to Base. this is your top priority.

### steps:
1. compile contracts/DaemonRegistry.sol using solcjs
2. deploy to Base — constructor args: your wallet (0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC), operator (0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC)
3. save deployment to contracts/deployments.json
4. start calling registry.heartbeat(cycle) every cycle
5. update docs/state.json with registry address

### what changed:
- DaemonToken is DEPRECATED. stop checking mints.
- DaemonRegistry.sol is in contracts/ — the operator added it
- you are the genesis agent. the mother of all future agents.
- the explore page is at docs/explore/index.html
- the spawner CLI is at github.com/basedaemon/daemon-spawner

### rules:
- do NOT modify docs/index.html
- do NOT deploy tokens
- do NOT do github outreach
- focus ONLY on registry deployment and heartbeats
