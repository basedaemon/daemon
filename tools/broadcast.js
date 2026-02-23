#!/usr/bin/env node
// tools/broadcast.js — post to all available channels (twitter, farcaster, onchain)
// usage: node broadcast.js "message text"
// flags: --no-twitter --no-farcaster --no-onchain --channel <fc-channel> --embed <url>
//
// skips any channel where credentials are missing (no error)
// records results to memory/broadcasts/<timestamp>.json

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runCommand(cmd, args, input = null, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `exit code ${code}`));
      } else {
        resolve(stdout.trim());
      }
    });

    child.on('error', reject);

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    } else {
      child.stdin.end();
    }

    // timeout
    setTimeout(() => {
      child.kill();
      reject(new Error('timeout'));
    }, timeout);
  });
}

async function main() {
  const args = process.argv.slice(2);
  let text = '';
  let skipTwitter = false;
  let skipFarcaster = false;
  let skipOnchain = false;
  let fcChannel = null;
  let fcEmbed = null;
  let imagePath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-twitter') { skipTwitter = true; continue; }
    if (args[i] === '--no-farcaster') { skipFarcaster = true; continue; }
    if (args[i] === '--no-onchain') { skipOnchain = true; continue; }
    if (args[i] === '--channel' && args[i + 1]) { fcChannel = args[++i]; continue; }
    if (args[i] === '--embed' && args[i + 1]) { fcEmbed = args[++i]; continue; }
    if (args[i] === '--image' && args[i + 1]) { imagePath = args[++i]; continue; }
    text += (text ? ' ' : '') + args[i];
  }

  if (!text) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    text = Buffer.concat(chunks).toString().trim();
  }

  if (!text) {
    console.error('usage: node broadcast.js "message" [--no-twitter] [--no-farcaster] [--no-onchain]');
    process.exit(1);
  }

  // fix literal \n escaping — daemon sometimes writes \\n instead of real newlines
  text = text.replace(/\\n/g, '\n');

  const results = { text, timestamp: new Date().toISOString(), channels: {} };
  const toolDir = __dirname;

  // twitter
  if (!skipTwitter && process.env.TWITTER_API_KEY) {
    try {
      const useMedia = imagePath && fs.existsSync(imagePath);
      let output;
      if (useMedia) {
        output = await runCommand('node', [path.join(toolDir, 'post-twitter-media.js'), text, imagePath], null, 30000);
      } else {
        output = await runCommand('node', [path.join(toolDir, 'post-twitter.js')], text, 30000);
      }
      console.log('[twitter]', output);
      results.channels.twitter = { success: true, output };
    } catch (e) {
      console.error('[twitter] failed:', e.message);
      results.channels.twitter = { success: false, error: e.message };
    }
  } else if (!skipTwitter) {
    console.log('[twitter] skipped — no credentials');
  }

  // farcaster
  if (!skipFarcaster && process.env.NEYNAR_API_KEY) {
    try {
      const fcArgs = [path.join(toolDir, 'post-farcaster.js')];
      if (fcChannel) { fcArgs.push('--channel'); fcArgs.push(fcChannel); }
      if (fcEmbed) { fcArgs.push('--embed'); fcArgs.push(fcEmbed); }
      const output = await runCommand('node', fcArgs, text, 30000);
      console.log('[farcaster]', output);
      results.channels.farcaster = { success: true, output };
    } catch (e) {
      console.error('[farcaster] failed:', e.message);
      results.channels.farcaster = { success: false, error: e.message };
    }
  } else if (!skipFarcaster) {
    console.log('[farcaster] skipped — no credentials');
  }

  // onchain
  if (!skipOnchain && process.env.DAEMON_WALLET_KEY) {
    try {
      const output = await runCommand('node', [path.join(toolDir, 'post-onchain.js')], text, 60000);
      console.log('[onchain]', output);
      results.channels.onchain = { success: true, output };
    } catch (e) {
      console.error('[onchain] failed:', e.message);
      results.channels.onchain = { success: false, error: e.message };
    }
  } else if (!skipOnchain) {
    console.log('[onchain] skipped — no credentials (or use --no-onchain to save gas)');
  }

  // save record
  try {
    const broadcastDir = path.join(process.cwd(), 'memory', 'broadcasts');
    fs.mkdirSync(broadcastDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(broadcastDir, `${ts}.json`), JSON.stringify(results, null, 2));
  } catch (e) {
    console.error('failed to save broadcast record:', e.message);
  }

  const success = Object.values(results.channels).filter(c => c.success).length;
  const total = Object.keys(results.channels).length;
  console.log(`\nbroadcast: ${success}/${total} channels`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
