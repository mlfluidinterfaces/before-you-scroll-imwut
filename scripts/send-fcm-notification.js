/**
 * FCM Direct Notification Sender
 * 
 * This script sends notifications directly via Firebase Cloud Messaging,
 * bypassing Expo's servers. Requires a Firebase service account key.
 * 
 * Setup:
 *   1. Download service account key from Firebase Console
 *   2. Set environment variable: export FCM_SERVICE_ACCOUNT_KEY=/path/to/key.json
 * 
 * Usage:
 *   node scripts/send-fcm-notification.js <fcm-token-or-expo-token>
 */

const https = require('https');
const fs = require('fs');

/**
 * Get OAuth2 access token from service account
 */
async function getAccessToken(serviceAccountKey) {
  const jwtHeader = Buffer.from(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT'
  })).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const jwtClaimSet = Buffer.from(JSON.stringify({
    iss: serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).toString('base64url');

  const crypto = require('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${jwtHeader}.${jwtClaimSet}`);
  const signature = sign.sign(serviceAccountKey.private_key, 'base64url');

  const jwt = `${jwtHeader}.${jwtClaimSet}.${signature}`;

  return new Promise((resolve, reject) => {
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.access_token);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Extract FCM token from Expo push token format
 */
function extractFcmToken(token) {
  // If it's an ExponentPushToken, extract the FCM token
  if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
    // The FCM token is base64 encoded inside the brackets
    const match = token.match(/\[([^\]]+)\]/);
    if (match) {
      try {
        return Buffer.from(match[1], 'base64').toString('utf-8');
      } catch (e) {
        // If decoding fails, return original
        return match[1];
      }
    }
  }
  return token;
}

/**
 * Send notification via FCM v1 API
 */
async function sendFcmNotification(fcmToken, accessToken, projectId, message = {}) {
  const payload = {
    message: {
      token: fcmToken,
      notification: {
        title: message.title || 'Screen Time App',
        body: message.body || 'Time for your daily survey!'
      },
      data: message.data || {
        source: 'fcm-script',
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default'
        }
      }
    }
  };

  console.log('📤 Sending FCM notification...');
  console.log('Payload:', JSON.stringify(payload, null, 2));

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    
    const options = {
      hostname: 'fcm.googleapis.com',
      path: `/v1/projects/${projectId}/messages:send`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: Please provide a token');
    console.log('\nUsage:');
    console.log('  node scripts/send-fcm-notification.js <fcm-token-or-expo-token>');
    console.log('\nSetup:');
    console.log('  export FCM_SERVICE_ACCOUNT_KEY=/path/to/service-account-key.json');
    process.exit(1);
  }

  // Check for service account key
  const serviceAccountPath = process.env.FCM_SERVICE_ACCOUNT_KEY;
  
  if (!serviceAccountPath) {
    console.error('❌ Error: FCM_SERVICE_ACCOUNT_KEY environment variable not set');
    console.log('\nTo get a service account key:');
    console.log('  1. Go to Firebase Console: https://console.firebase.google.com/');
    console.log('  2. Select your Firebase project');
    console.log('  3. Go to Project Settings → Service Accounts');
    console.log('  4. Click "Generate new private key"');
    console.log('  5. Save the JSON file');
    console.log('  6. Set environment variable:');
    console.log('     export FCM_SERVICE_ACCOUNT_KEY=/path/to/key.json');
    process.exit(1);
  }

  try {
    // Load service account
    const serviceAccountKey = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    const projectId = serviceAccountKey.project_id;

    console.log(`🔑 Using project: ${projectId}`);

    // Get access token
    console.log('🔐 Getting access token...');
    const accessToken = await getAccessToken(serviceAccountKey);
    console.log('✅ Access token obtained');

    // Extract FCM token if needed
    const inputToken = args[0];
    const fcmToken = extractFcmToken(inputToken);
    
    if (fcmToken !== inputToken) {
      console.log('🔄 Extracted FCM token from Expo token format');
    }

    // Send notification
    const response = await sendFcmNotification(fcmToken, accessToken, projectId, {
      title: 'Screen Time App',
      body: 'Time for your daily survey!',
      data: {
        type: 'survey-reminder',
        timestamp: new Date().toISOString()
      }
    });

    console.log('\n✅ Notification sent successfully!');
    console.log('Response:', JSON.stringify(response, null, 2));
    console.log('\n✨ Done!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { sendFcmNotification, extractFcmToken };
