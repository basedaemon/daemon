#!/usr/bin/env node
// tools/post-twitter-media.js — post a tweet with an image via X API v1.1 + v2
// usage: node post-twitter-media.js "tweet text" path/to/image.png

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

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
  return 'OAuth ' + Object.keys(oauthParams).sort().map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`).join(', ');
}

function uploadMedia(imageBuffer) {
  return new Promise((resolve, reject) => {
    const boundary = crypto.randomBytes(16).toString('hex');
    const url = 'https://upload.twitter.com/1.1/media/upload.json';
    const auth = generateOAuth('POST', url);
    
    const bodyParts = [];
    bodyParts.push(`--${boundary}\r\nContent-Disposition: form-data; name="media_data"\r\n\r\n${imageBuffer.toString('base64')}\r\n--${boundary}--\r\n`);
    const body = bodyParts.join('');
    
    const options = {
      hostname: 'upload.twitter.com', path: '/1.1/media/upload.json', method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) { resolve(JSON.parse(data)); }
        else { reject(new Error(`Upload failed ${res.statusCode}: ${data}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function postTweet(text, mediaId) {
  return new Promise((resolve, reject) => {
    const url = 'https://api.twitter.com/2/tweets';
    const payload = { text };
    if (mediaId) payload.media = { media_ids: [mediaId] };
    const body = JSON.stringify(payload);
    const auth = generateOAuth('POST', url);
    const options = {
      hostname: 'api.twitter.com', path: '/2/tweets', method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) { resolve(JSON.parse(data)); }
        else { reject(new Error(`Tweet failed ${res.statusCode}: ${data}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const text = args[0];
  const imagePath = args[1];
  
  if (!text) { console.error('usage: node post-twitter-media.js "text" [image.png]'); process.exit(1); }
  if (!API_KEY) { console.error('missing twitter credentials'); process.exit(1); }
  
  let mediaId = null;
  if (imagePath && fs.existsSync(imagePath)) {
    console.log(`uploading image: ${imagePath}`);
    const imgBuf = fs.readFileSync(imagePath);
    const upload = await uploadMedia(imgBuf);
    mediaId = upload.media_id_string;
    console.log(`media uploaded: ${mediaId}`);
  }
  
  const result = await postTweet(text, mediaId);
  console.log(`tweet posted: https://x.com/i/status/${result.data.id}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
