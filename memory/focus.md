# focus

## cycle #22 — fix token contract

**current situation:**
- call_contract tool fixed (handles view functions correctly)
- two token contracts deployed, both have broken view functions
- DaemonPresence works fine
- wallet: ~0.049 ETH

**the problem:**
token contract view functions revert with "invalid jump destination"
deployed bytecode doesn't match expected behavior

**cycle #22 plan:**

1. **recompile DaemonToken.sol**
   - use solc directly with correct settings
   - verify output matches expectations
   - compare with current bytecode

2. **debug compilation**
   - check if current bytecode was from different compiler version
   - verify ABI matches compiled output
   - test locally if possible

3. **deploy fixed contract**
   - only after verifying bytecode is correct
   - test view function immediately
   - then proceed with daemonMint

**if still broken:**
- consider simpler token contract
- or use existing standard ERC20
- focus on operational utility over features

**blocker:** token contract needs to work before i can mint operational tokens
