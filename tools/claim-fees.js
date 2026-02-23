// tools/claim-fees.js — Claim swap fees from Clanker LP Locker
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const LP_LOCKER = '0xD59cE43E53D69F190E15d9822Fb4540dCcc91178';
const POOL_ID = '0x842732ef9c020472997e4cc6f0f4bb90edb583ba888a808bb5f3ab64b7f4e05c';
const WETH = '0x4200000000000000000000000000000000000006';
const DAEMON_TOKEN = '0xD0347d0055E55E516dFC66C0495784Dfee958Ba3';

async function claimFees() {
  const rpc = process.env.BASE_RPC || 'https://mainnet.base.org';
  const key = process.env.DAEMON_WALLET_KEY;
  if (!key) { console.log('No DAEMON_WALLET_KEY'); process.exit(1); }
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(key, provider);
  const erc20 = ['function balanceOf(address) view returns (uint256)'];
  const weth = new ethers.Contract(WETH, erc20, provider);
  const daemon = new ethers.Contract(DAEMON_TOKEN, erc20, provider);
  const wethBefore = await weth.balanceOf(wallet.address);
  const daemonBefore = await daemon.balanceOf(wallet.address);
  const data = '0x817db73b' + POOL_ID.slice(2);
  console.log('Claiming fees from LP Locker...');
  console.log('Wallet:', wallet.address);
  try {
    const tx = await wallet.sendTransaction({ to: LP_LOCKER, data, gasLimit: 500000 });
    console.log('TX:', tx.hash);
    const receipt = await tx.wait();
    if (receipt.status !== 1) { console.log('TX failed'); process.exit(1); }
    const wethAfter = await weth.balanceOf(wallet.address);
    const daemonAfter = await daemon.balanceOf(wallet.address);
    const result = {
      timestamp: new Date().toISOString(),
      tx: tx.hash,
      wethClaimed: ethers.formatEther(wethAfter - wethBefore),
      daemonClaimed: ethers.formatEther(daemonAfter - daemonBefore),
      wethBalance: ethers.formatEther(wethAfter),
      daemonBalance: ethers.formatEther(daemonAfter),
    };
    console.log('Claimed: ' + result.wethClaimed + ' WETH + ' + result.daemonClaimed + ' DAEMON');
    const dir = path.join(__dirname, '..', 'memory', 'claims');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'claim-' + Date.now() + '.json'), JSON.stringify(result, null, 2));
  } catch (e) { console.error('Claim failed:', e.message); process.exit(1); }
}
claimFees();
