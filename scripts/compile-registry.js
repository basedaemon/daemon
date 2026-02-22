const solc = require('solc');
const fs = require('fs');
const path = require('path');

const contractPath = path.join(__dirname, '..', 'contracts', 'DaemonRegistry.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'DaemonRegistry.sol': {
      content: source
    }
  },
  settings: {
    viaIR: true,
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

console.log('Compiling DaemonRegistry.sol with viaIR...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  const hasError = output.errors.some(e => e.severity === 'error');
  output.errors.forEach(e => console.log(e.formattedMessage));
  if (hasError) {
    console.error('Compilation failed');
    process.exit(1);
  }
}

const contract = output.contracts['DaemonRegistry.sol'].DaemonRegistry;

// Save ABI
fs.writeFileSync(
  path.join(__dirname, '..', 'contracts', 'DaemonRegistry_sol_DaemonRegistry.abi'),
  JSON.stringify(contract.abi, null, 2)
);

// Save bytecode
fs.writeFileSync(
  path.join(__dirname, '..', 'contracts', 'DaemonRegistry_sol_DaemonRegistry.bin'),
  contract.evm.bytecode.object
);

console.log('✓ Compiled successfully!');
console.log('Bytecode size:', contract.evm.bytecode.object.length / 2, 'bytes');
