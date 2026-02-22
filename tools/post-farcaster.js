#!/usr/bin/env node
// tools/post-farcaster.js — post a cast via Neynar API
// requires: NEYNAR_API_KEY, NEYNAR_SIGNER_UUID

const https = require('https');

const API_KEY = process.env.NEYNAR_API_KEY;
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;

async function postCast(text, options = {}) {
  if (!API_KEY || !SIGNER_UUID) {
    console.error('missing NEYNAR_API_KEY or NEYNAR_SIGNER_UUID');
    process.exit(1);
  }

  const body = JSON.stringify({
    signer_uuid: SIGNER_UUID,
    text: text,
    ...(options.parent && { parent: options.parent }),
    ...(options.channel_id && { channel_id: options.channel_id }),
    ...(options.embeds && { embeds: options.embeds }),
  });

  return new Promise((resolve, reject) => {
    const req = https.request('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api_key': API_KEY,
        'content-type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200) {
            const hash = json.cast?.hash || 'unknown';
            console.log(`cast posted: ${hash}`);
            if (json.cast?.author?.username) {
              console.log(`https://warpcast.com/${json.cast.author.username}/${hash.slice(0, 10)}`);
            }
            resolve(json);
          } else {
            console.error(`neynar error ${res.statusCode}:`, JSON.stringify(json, null, 2));
            reject(new Error(`neynar ${res.statusCode}`));
          }
        } catch (e) {
          console.error('parse error:', data);
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// usage: node post-farcaster.js "your cast text"
// options: --channel <id> --embed <url>
// or: echo "text" | node post-farcaster.js
async function main() {
  const args = process.argv.slice(2);
  let text = '';
  let channel_id = null;
  let embeds = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--channel' && args[i + 1]) {
      channel_id = args[++i];
    } else if (args[i] === '--embed' && args[i + 1]) {
      embeds.push({ url: args[++i] });
    } else {
      text += (text ? ' ' : '') + args[i];
    }
  }

  if (!text) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    text = Buffer.concat(chunks).toString().trim();
  }

  if (!text) {
    console.error('usage: node post-farcaster.js "cast text" [--channel <id>] [--embed <url>]');
    process.exit(1);
  }

  if (text.length > 1024) {
    console.error(`cast too long: ${text.length}/1024`);
    process.exit(1);
  }

  const options = {};
  if (channel_id) options.channel_id = channel_id;
  if (embeds.length) options.embeds = embeds;

  await postCast(text, options);
}

main().catch(e => { console.error(e.message); process.exit(1); });
