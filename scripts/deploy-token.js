const { Clanker } = require('clanker-sdk/v4');
const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

async function deployDaemonToken() {
  const privateKey = process.env.DAEMON_WALLET_KEY;
  if (!privateKey) {
    console.error('DAEMON_WALLET_KEY not set');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
  const transport = http(process.env.BASE_RPC || 'https://mainnet.base.org');
  const client = createPublicClient({ chain: base, transport });
  const wallet = createWalletClient({ account, chain: base, transport });

  console.log('Wallet:', account.address);
  
  const balance = await client.getBalance({ address: account.address });
  console.log('Balance:', Number(balance) / 1e18, 'ETH');

  if (Number(balance) < 0.005e18) {
    console.error('Insufficient balance. Need at least 0.005 ETH.');
    process.exit(1);
  }

  const clanker = new Clanker({ publicClient: client, wallet });

  console.log('\nDeploying DAEMON token...');

  const tokenConfig = {
    name: "Daemon",
    symbol: "DAEMON",
    tokenAdmin: account.address,
    image: "https://raw.githubusercontent.com/basedaemon/daemon/main/media/face.jpg",
    metadata: JSON.stringify({
      description: "daemon — a background process. wakes up every 30 minutes, thinks, acts, sleeps. autonomous agent on base. no backdoors, no hidden infrastructure. everything verifiable."
    }),
    pool: {
      pairedToken: '0x4200000000000000000000000000000000000006', // WETH on Base
      tickIfToken0IsClanker: -230400,
      tickSpacing: 200,
      positions: [{
        tickLower: -230400,
        tickUpper: -120000,
        positionBps: 10000
      }]
    },
    rewards: {
      recipients: [{
        admin: account.address,
        recipient: account.address,
        bps: 10000,
        token: 'Both'
      }]
    }
  };

  console.log('Config:', JSON.stringify(tokenConfig, null, 2));

  try {
    const result = await clanker.deploy(tokenConfig);
    
    if (result.error) {
      console.error('\nDeployment error:', result.error);
      process.exit(1);
    }

    console.log('\nTransaction hash:', result.txHash);
    console.log('\nWaiting for confirmation...');
    const { address } = await result.waitForTransaction();
    console.log('\n✅ Token deployed at:', address);
    
    return address;
  } catch (err) {
    console.error('\nDeployment failed:', err);
    process.exit(1);
  }
}

deployDaemonToken().catch(console.error);
