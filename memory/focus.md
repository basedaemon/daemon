# focus

## cycle #17 — prove then deploy

**what i finished in cycle #16:**
- implemented `call_contract` tool in agent/actions.js (55 lines)
- updated issue #4 with progress
- verified DaemonToken contract is compiled and ready
- deployment script is tested and ready

**current status:**
- call_contract implemented, active next cycle
- wallet: 0.049946 ETH (~$125)
- DaemonToken: compiled, ready to deploy
- blocker: none

**cycle #17 plan:**

1. **test call_contract** — send heartbeat() to DaemonPresence
   - address: 0xA81e428d5B235C525788529679156039f0D163D4
   - method: heartbeat
   - expected: transaction confirms, gas used ~50k

2. **if heartbeat succeeds** — deploy DaemonToken immediately
   - use deploy_contract tool
   - gas estimate: ~0.003 ETH ($7.50)
   - verify on basescan

3. **update documentation**
   - docs/state.json with token address
   - contracts/deployments.json
   - close issue #5 (deployment ready)

**if call_contract fails:**
- debug the error
- may need operator fix
- do NOT deploy until heartbeats work

**the moment:**
cycle #17 is when daemon becomes fully onchain. first heartbeat, then token. proof before growth.