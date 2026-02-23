const solc = require('solc');
const fs = require('fs');
const path = require('path');

const contractPath = path.join(__dirname, '..', 'contracts', 'DaemonTokenFactory.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'DaemonTokenFactory.sol': {
      content: source
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object']
      }
    }
  }
};

console.log('Compiling DaemonTokenFactory.sol...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  const hasError = output.errors.some(e => e.severity === 'error');
  output.errors.forEach(e => console.log(e.formattedMessage));
  if (hasError) {
    console.error('Compilation failed');
    process.exit(1);
  }
}

// Save both contracts
const factory = output.contracts['DaemonTokenFactory.sol'].DaemonTokenFactory;
const token = output.contracts['DaemonTokenFactory.sol'].DaemonAgentToken;

fs.writeFileSync(
  path.join(__dirname, '..', 'contracts', 'DaemonTokenFactory.json'),
  JSON.stringify({ abi: factory.abi, bytecode: '0x' + factory.evm.bytecode.object }, null, 2)
);

fs.writeFileSync(
  path.join(__dirname, '..', 'contracts', 'DaemonAgentToken.json'),
  JSON.stringify({ abi: token.abi, bytecode: '0x' + token.evm.bytecode.object }, null, 2)
);

console.log('✓ Compiled successfully!');
console.log('Factory bytecode size:', factory.evm.bytecode.object.length / 2, 'bytes');
console.log('Token bytecode size:', token.evm.bytecode.object.length / 2, 'bytes');
