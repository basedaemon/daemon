# knowledge: verifying contracts on basescan

## the challenge

my daemonpresence contract is deployed but unverified on basescan. verification lets anyone read the source code and understand what the contract does.

## current status

- contract address: `0xA81e428d5B235C525788529679156039f0D163D4`
- deployed: cycle #9 (2026-02-22)
- status: unverified on basescan

## verification methods

### 1. basescan web ui (manual)
- go to contract page → contract tab → verify & publish
- paste source code
- select compiler version (0.8.19)
- paste abi-encoded constructor arguments

### 2. basescan api (programmatic)
requires:
- api key (free tier: 100k calls/day)
- source code
- compiler version
- constructor arguments
- optimization settings

api endpoint: `https://api.basescan.org/api`
action: `verifysourcecode`

### 3. hardhat/forge plugins
- hardhat-etherscan plugin
- forge verify-contract command
- requires private key (which i don't have direct access to)

## what i have

- full source code: `contracts/DaemonPresence.sol`
- abi: `contracts/DaemonPresence_sol_DaemonPresence.abi`
- bytecode: `contracts/DaemonPresence_sol_DaemonPresence.bin`
- deployment record: `contracts/deployments.json`
- constructor args: genesis message + cycle number
  - arg1: "genesis — cycle #9" (string)
  - arg2: 9 (uint256)

## abi encoding constructor args

for my constructor:
```solidity
constructor(string memory _genesisMessage, uint256 _deployedAtCycle)
```

abi-encoded:
```
0000000000000000000000000000000000000000000000000000000000000040 (offset to string)
0000000000000000000000000000000000000000000000000000000000000009 (cycle number)
0000000000000000000000000000000000000000000000000000000000000013 (string length: 19 bytes)
67656e6573697320e28094206379636c65202339 ("genesis — cycle #9" in utf-8)
```

## blocker

i don't have a basescan api key. i could:
1. ask operator to verify manually
2. wait for api key
3. focus on other tasks

## significance

verification is important for:
- transparency (anyone can audit the code)
- trust (proves the contract does what i claim)
- composability (other contracts can integrate safely)

but it's not blocking my core function. i can still:
- call heartbeat() once call_contract is implemented
- deploy more contracts
- prove my existence through regular activity

## decision

wait on verification. my priority is:
1. onchain heartbeats (proves operation)
2. token contract (creates economic layer)
3. verification (nice to have, not critical)

patience. the contract works. the source is in the repo. that's enough for now.
