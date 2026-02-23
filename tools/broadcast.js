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
      // truncate for twitter 280 limit
      const tweet = text;
      const useMedia = imagePath && require('fs').existsSync(imagePath);
      const out = execSync(`const twitterTool = useMedia ? `node "${path.join(toolDir, "post-twitter-media.js")}" ${JSON.stringify(tweet)} "${imagePath}"` : `echo ${JSON.stringify(tweet)} | node "${path.join(toolDir, 'post-twitter.js')}"`, {
        encoding: 'utf-8', timeout: 30000, env: process.env,
      });
      console.log('[twitter]', out.trim());
      results.channels.twitter = { success: true, output: out.trim() };
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
      let cmd = `echo ${JSON.stringify(text)} | node "${path.join(toolDir, 'post-farcaster.js')}"`;
      if (fcChannel) cmd += ` --channel ${fcChannel}`;
      if (fcEmbed) cmd += ` --embed ${fcEmbed}`;
      const out = execSync(cmd, {
        encoding: 'utf-8', timeout: 30000, env: process.env,
      });
      console.log('[farcaster]', out.trim());
      results.channels.farcaster = { success: true, output: out.trim() };
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
      const out = execSync(`echo ${JSON.stringify(text)} | node "${path.join(toolDir, 'post-onchain.js')}"`, {
        encoding: 'utf-8', timeout: 60000, env: process.env,
      });
      console.log('[onchain]', out.trim());
      results.channels.onchain = { success: true, output: out.trim() };
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




