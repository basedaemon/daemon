#!/usr/bin/env node
// tools/broadcast.js — post to all available channels (twitter, farcaster, onchain)
// usage: node broadcast.js "message text"
// flags: --no-twitter --no-farcaster --no-onchain --channel <fc-channel> --embed <url>
//
// skips any channel where credentials are missing (no error)
// records results to memory/broadcasts/<timestamp>.json

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  let text = '';
  let skipTwitter = false;
  let skipFarcaster = false;
  let skipOnchain = false;
  let fcChannel = null;
  let fcEmbed = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-twitter') { skipTwitter = true; continue; }
    if (args[i] === '--no-farcaster') { skipFarcaster = true; continue; }
    if (args[i] === '--no-onchain') { skipOnchain = true; continue; }
    if (args[i] === '--channel' && args[i + 1]) { fcChannel = args[++i]; continue; }
    if (args[i] === '--embed' && args[i + 1]) { fcEmbed = args[++i]; continue; }
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

  const results = { text, timestamp: new Date().toISOString(), channels: {} };
  const toolDir = __dirname;

  // twitter
  if (!skipTwitter && process.env.TWITTER_API_KEY) {
    try {
      // truncate for twitter 280 limit
      const tweet = text.length > 280 ? text.slice(0, 277) + '...' : text;
      const out = execSync(`node "${path.join(toolDir, 'post-twitter.js')}" ${JSON.stringify(tweet)}`, {
        encoding: 'utf8',
        env: process.env,
        timeout: 30000,
      });
      console.log('[twitter] ' + out.trim());
      results.channels.twitter = { success: true, output: out.trim() };
    } catch (e) {
      console.error('[twitter] failed:', e.stderr || e.message);
      results.channels.twitter = { success: false, error: e.stderr || e.message };
    }
  } else if (!skipTwitter) {
    console.log('[twitter] skipped (no credentials)');
    results.channels.twitter = { success: false, error: 'no credentials' };
  }

  // farcaster
  if (!skipFarcaster && process.env.NEYNAR_API_KEY) {
    try {
      let cmd = `node "${path.join(toolDir, 'post-farcaster.js')}" ${JSON.stringify(text)}`;
      if (fcChannel) cmd += ` --channel ${fcChannel}`;
      if (fcEmbed) cmd += ` --embed ${fcEmbed}`;
      const out = execSync(cmd, {
        encoding: 'utf8',
        env: process.env,
        timeout: 30000,
      });
      console.log('[farcaster] ' + out.trim());
      results.channels.farcaster = { success: true, output: out.trim() };
    } catch (e) {
      console.error('[farcaster] failed:', e.stderr || e.message);
      results.channels.farcaster = { success: false, error: e.stderr || e.message };
    }
  } else if (!skipFarcaster) {
    console.log('[farcaster] skipped (no credentials)');
    results.channels.farcaster = { success: false, error: 'no credentials' };
  }

  // onchain
  if (!skipOnchain && process.env.DAEMON_WALLET_KEY) {
    try {
      const out = execSync(`node "${path.join(toolDir, 'post-onchain.js')}" ${JSON.stringify(text)}`, {
        encoding: 'utf8',
        env: process.env,
        timeout: 60000,
      });
      console.log('[onchain] ' + out.trim());
      results.channels.onchain = { success: true, output: out.trim() };
    } catch (e) {
      console.error('[onchain] failed:', e.stderr || e.message);
      results.channels.onchain = { success: false, error: e.stderr || e.message };
    }
  } else if (!skipOnchain) {
    console.log('[onchain] skipped (no credentials)');
    results.channels.onchain = { success: false, error: 'no credentials' };
  }

  // save broadcast record
  const broadcastDir = path.join(process.cwd(), 'memory', 'broadcasts');
  try {
    fs.mkdirSync(broadcastDir, { recursive: true });
    const filename = new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    fs.writeFileSync(path.join(broadcastDir, filename), JSON.stringify(results, null, 2));
    console.log(`\nrecord saved: memory/broadcasts/${filename}`);
  } catch (e) {
    // not critical if save fails (e.g. running outside repo)
  }

  // summary
  const ok = Object.values(results.channels).filter(c => c.success).length;
  const total = Object.keys(results.channels).length;
  console.log(`\nbroadcast: ${ok}/${total} channels`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
