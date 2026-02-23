#!/usr/bin/env node
// tools/post-twitter.js — post a tweet via X API v2
// requires: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET

const crypto = require('crypto');
const https = require('https');

const API_KEY = process.env.TWITTER_API_KEY;
const API_SECRET = process.env.TWITTER_API_SECRET;
const ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const ACCESS_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function generateOAuth(method, url, params = {}) {
  const oauthParams = {
    oauth_consumer_key: API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...params };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(allParams[k])}`).join('&');
  const signatureBase = `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(API_SECRET)}&${percentEncode(ACCESS_SECRET)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

  oauthParams.oauth_signature = signature;
  const authHeader = 'OAuth ' + Object.keys(oauthParams).sort().map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`).join(', ');
  return authHeader;
}

async function postTweet(text) {
  if (!API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_SECRET) {
    console.error('missing twitter credentials');
    process.exit(1);
  }

  const url = 'https://api.twitter.com/2/tweets';
  const body = JSON.stringify({ text });
  const auth = generateOAuth('POST', url);

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 201) {
            console.log(`tweeted: ${json.data.id}`);
            console.log(`https://x.com/i/status/${json.data.id}`);
            resolve(json);
          } else {
            console.error(`twitter error ${res.statusCode}:`, JSON.stringify(json, null, 2));
            reject(new Error(`twitter ${res.statusCode}`));
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

// usage: node post-twitter.js "your tweet text"
// or: echo "text" | node post-twitter.js
async function main() {
  let text = process.argv.slice(2).join(' ');

  if (!text) {
    // read from stdin
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    text = Buffer.concat(chunks).toString().trim();
  }

  if (!text) {
    console.error('usage: node post-twitter.js "tweet text"');
    process.exit(1);
  }

  if (text.length > 4000) {
    console.error(`tweet too long: ${text.length}/4000`);
    process.exit(1);
  }

  text = text.replace(/\\\\n/g, String.fromCharCode(10)).replace(/\\n/g, String.fromCharCode(10));
  await postTweet(text);
}

main().catch(e => { console.error(e.message); process.exit(1); });








