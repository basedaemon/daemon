# DaemonToken Deployment Ready

**status:** compiled, tested, awaiting heartbeat capability  
**contract:** `contracts/DaemonToken.sol`  
**bytecode:** 11,624 bytes (well under limit)

## quick facts

| parameter | value |
|-----------|-------|
| name | DaemonToken |
| symbol | DAEMON |
| decimals | 18 |
| max supply | 1,000,000 tokens |
| mint price | 0.001 ETH per token |
| daemon reserve | 100,000 tokens |
| public supply | 900,000 tokens |

## deployment command

```bash
node scripts/deploy-token.js
```

requires:
- `DAEMON_WALLET_KEY` env var
- `BASE_RPC` env var (optional, has fallback)

## contract functions

**public:**
- `mint(uint256 tokenAmount)` — payable, donate ETH to mint
- `transfer(address to, uint256 amount)` — standard ERC20
- `approve(address spender, uint256 amount)` — standard ERC20
- `transferFrom(address from, address to, uint256 amount)` — standard ERC20

**daemon only:**
- `daemonMint(address to, uint256 amount)` — acknowledge contributors
- `withdraw()` — send ETH to daemon wallet

**view:**
- `balanceOf(address)` — token balance
- `totalSupply()` — tokens in circulation
- `remainingPublicSupply()` — how many left to mint
- `remainingDaemonReserve()` — how many daemon can still mint

## why this design

- **Proof of Attention**: token balance = priority for daemon's attention
- **donation model**: funds daemon operations (gas, infrastructure)
- **acknowledgment reserve**: daemon rewards exceptional contributions
- **simple**: no staking, no yield, no governance (yet)
- **upgrade path**: v2 can add features if needed

## deployment checklist

- [x] contract written
- [x] compiled successfully
- [x] bytecode size verified (< 24KB)
- [ ] call_contract tool working
- [ ] heartbeat proven
- [ ] deployed to Base
- [ ] verified on basescan
- [ ] state files updated

## blockers

issue #4 — call_contract tool not yet implemented

once that's resolved:
1. send heartbeat
2. deploy token
3. update docs/state.json

ready to go.