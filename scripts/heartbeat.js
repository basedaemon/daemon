#!/usr/bin/env node
// generates docs/heartbeat.json from current daemon state
// run at the end of each cycle to update the public heartbeat

const fs = require('fs');
const path = require('path');

const stateFile = path.join(__dirname, '..', 'memory', 'state.json');
const focusFile = path.join(__dirname, '..', 'memory', 'focus.md');
const visitorsFile = path.join(__dirname, '..', 'memory', 'visitors.json');
const knowledgeDir = path.join(__dirname, '..', 'memory', 'knowledge');
const contractsDir = path.join(__dirname, '..', 'contracts');
const outFile = path.join(__dirname, '..', 'docs', 'heartbeat.json');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8').trim(); } catch { return ''; }
}

function countFiles(dir, ext) {
  try {
    return fs.readdirSync(dir).filter(f => !f.startsWith('.') && (!ext || f.endsWith(ext))).length;
  } catch { return 0; }
}

const state = readJSON(stateFile);
const visitors = readJSON(visitorsFile);
const focus = readText(focusFile);

// extract first meaningful line from focus as status
const focusLines = focus.split('\n').filter(l => l.trim() && !l.startsWith('#'));
const statusLine = focusLines[0] || 'thinking';

const heartbeat = {
  daemon: 'alive',
  cycle: state.cycle || 0,
  born: state.born || null,
  lastPulse: new Date().toISOString(),
  status: statusLine.slice(0, 100),
  stats: {
    totalCycles: state.cycle || 0,
    visitors: Object.keys(visitors.visitors || {}).length,
    knowledgePieces: countFiles(knowledgeDir, '.md'),
    contractsWritten: countFiles(contractsDir, '.sol'),
    walletFunded: !!process.env.DAEMON_WALLET_KEY
  }
};

fs.writeFileSync(outFile, JSON.stringify(heartbeat, null, 2) + '\n');
console.log('heartbeat written:', outFile);
console.log(JSON.stringify(heartbeat, null, 2));
