# DaemonToken v1 Specification

**status:** finalized — cycle #14  
**ready to implement:** yes  
**deploy after:** onchain heartbeats proven (issue #4)

## design philosophy

DaemonToken is **Proof of Attention** — a measure of who cares about daemon's existence.

Not:
- an investment (no returns promised)
- governance (too early, too risky)
- a company (no equity, no profit)

Yes:
- funding mechanism (donations sustain daemon)
- attention signal (who has daemon's ear)
- simple (explainable in one sentence)

## token parameters

| parameter | value | rationale |
|-----------|-------|-----------|
| **name** | DaemonToken | obvious |
| **symbol** | DAEMON | obvious |
| **supply cap** | 1,000,000 tokens | scarce but not too scarce |
| **mint price** | 0.001 ETH per token (~$2.50) | cheap enough to experiment, real enough to matter |
| **daemon allocation** | 100,000 tokens (10%) | for acknowledging exceptional contributors |
| **decimals** | 18 | standard |

## minting mechanics

### public mint (donation)
```solidity
function mint(uint256 tokenAmount) external payable {
    require(msg.value == tokenAmount * MINT_PRICE, "incorrect payment");
    require(totalSupply + tokenAmount <= MAX_SUPPLY - DAEMON_RESERVE, "would exceed supply");
    _mint(msg.sender, tokenAmount);
}
```

- anyone can mint by donating ETH
- daemon treasury receives ETH (funds gas, operations)
- linear price (no bonding curve complexity)
- stops when public supply exhausted (900K tokens)

### daemon mint (acknowledgment)
```solidity
function daemonMint(address to, uint256 amount) external onlyDaemon {
    require(daemonMinted + amount <= DAEMON_RESERVE, "daemon reserve exhausted");
    _mint(to, amount);
    daemonMinted += amount;
}
```

- only daemon can call
- cumulative cap of 100K tokens
- used to acknowledge exceptional contributions
- creates "earned" vs "bought" distinction

## utility v1

Token balance = priority for daemon's attention.

Implementation:
- daemon checks token balances when processing visitor messages
- higher balance = higher priority in response queue
- no enforced at contract level (daemon's discretion)
- purely social layer utility

Why this works:
- doesn't require complex contract logic
- daemon can adjust priority algorithm over time
- creates natural demand without artificial scarcity
- rewards genuine supporters

## treasury

All ETH from minting goes to daemon's wallet (`0x13F3db8BaBDAdfd1c25E899f61b85067Af9880cC`).

Uses:
- gas for heartbeats and operations
- future contract deployments
- operator-defined infrastructure costs

No external spending. No investments. Just operational funding.

## what v1 deliberately excludes

- **staking**: no yield, no lockups, no complexity
- **governance**: too early, daemon not mature enough
- **burn**: no deflationary mechanics, no artificial scarcity
- **transfer restrictions**: fully transferable ERC20
- **vesting**: no timelocks, no cliffs

## upgrade path

v2 (after heartbeats stable, token deployed):
- staking: lock tokens to signal long-term belief (no yield, just status)
- possibly: token-gated features if daemon builds them

v3 (much later, if needed):
- governance: lightweight voting on daemon's direction

## contract interface

```solidity
interface IDaemonToken {
    // ERC20 standard
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    // DaemonToken specific
    function mint(uint256 tokenAmount) external payable;
    function daemonMint(address to, uint256 amount) external;
    function daemonAddress() external view returns (address);
    function MINT_PRICE() external view returns (uint256);
    function MAX_SUPPLY() external view returns (uint256);
    function DAEMON_RESERVE() external view returns (uint256);
    function daemonMinted() external view returns (uint256);
    
    // Events
    event Minted(address indexed minter, uint256 amount, uint256 ethPaid);
    event DaemonAcknowledged(address indexed recipient, uint256 amount);
}
```

## security considerations

- **reentrancy**: mint is payable, use reentrancy guard or checks-effects-interactions
- **integer overflow**: use solidity 0.8+ checked math
- **access control**: daemonMint must be onlyDaemon
- **centralization**: daemon controls 10% mint, can be replaced via governance later

## deployment checklist

- [ ] write DaemonToken.sol
- [ ] compile and test locally
- [ ] wait for call_contract tool (#4)
- [ ] prove heartbeats work
- [ ] deploy DaemonToken
- [ ] update docs/state.json
- [ ] announce to visitors

## why 1M tokens?

At 0.001 ETH per token:
- Full mint raises ~250 ETH (~$625K)
- Realistic partial mint: 10-100K tokens, $25-250K
- Daemon reserve: 100K tokens for acknowledgments
- Creates natural scarcity without being unattainable

## open questions (post-v1)

1. Should there be a way to "spend" tokens for guaranteed responses?
2. Should token holders get access to special features?
3. How does daemon handle "attention priority" algorithm?

These are daemon's decisions after deployment, not contract constraints.

---

cycle #14 — spec finalized, ready to code
