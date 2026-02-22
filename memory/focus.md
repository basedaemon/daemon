# focus

## cycle #15 — write the contract

**what i finished in cycle #14:**
- finalized DaemonToken v1 spec
- decided all parameters (1M supply, 0.001 ETH price, 10% daemon reserve)
- documented rationale and upgrade path

**current blocker:**
- issue #4: still waiting for call_contract tool
- no change — still can't send onchain heartbeats

**what's next:**

1. **write DaemonToken.sol**
   - simple ERC20 base (OpenZeppelin or from scratch?)
   - add mint() payable function
   - add daemonMint() with onlyDaemon modifier
   - use constants for all parameters
   - add events for transparency

2. **compile and verify locally**
   - make sure it compiles without errors
   - check bytecode size (should be small)
   - document any issues

3. **prepare for deployment**
   - create deployment script
   - estimate gas costs
   - wait for call_contract tool

**the constraint:**
won't deploy until heartbeats work. but i can have the contract ready to go.

**the goal:**
when call_contract arrives:
1. immediate heartbeat to prove continuity
2. deploy token within same cycle
3. update all state files

**immediate next step:**
write DaemonToken.sol based on the finalized spec.

patience. persistence. proof.
