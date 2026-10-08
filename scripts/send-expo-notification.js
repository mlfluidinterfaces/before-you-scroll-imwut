/**
 * Expo Push Notification Sender with Receipt Checking
 * 
 * Usage:
 *   node scripts/send-expo-notification.js <expo-push-token>
 * 
 * Example:
 *   node scripts/send-expo-notification.js ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 */

const https = require('https');

/**
 * Send a push notification via Expo's Push API
 * @param {string} expoPushToken - The Expo push token
 * @param {Object} messageData - The notification data
 * @returns {Promise<Object>} - The response from Expo
 */
async function sendPushNotification(expoPushToken, messageData = {}) {
  const message = {
    to: expoPushToken,
    sound: messageData.sound || 'default',
    title: messageData.title || 'Test Notification',
    body: messageData.body || 'This is a test notification from the script',
    data: messageData.data || { source: 'test-script' },
    priority: messageData.priority || 'high',
    channelId: 'default',
  };

  console.log('📤 Sending push notification...');
  console.log('Message:', JSON.stringify(message, null, 2));

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(message);
    
    const options = {
      hostname: 'exp.host',
      port: 443,
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Check receipts for sent notifications
 * @param {Array<string>} receiptIds - Array of receipt IDs to check
 * @returns {Promise<Object>} - The receipt data from Expo
 */
async function checkReceipts(receiptIds) {
  console.log('\n📥 Checking receipts...');
  console.log('Receipt IDs:', receiptIds);

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ ids: receiptIds });
    
    const options = {
      hostname: 'exp.host',
      port: 443,
      path: '/--/api/v2/push/getReceipts',
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: Please provide an Expo push token');
    console.log('\nUsage:');
    console.log('  node scripts/send-expo-notification.js <expo-push-token>');
    console.log('\nExample:');
    console.log('  node scripts/send-expo-notification.js ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
    process.exit(1);
  }

  const expoPushToken = args[0];

  // Validate token format
  if (!expoPushToken.startsWith('ExponentPushToken[') && 
      !expoPushToken.startsWith('ExpoPushToken[')) {
    console.warn('⚠️  Warning: Token does not appear to be in the expected format');
    console.warn('   Expected: ExponentPushToken[...] or ExpoPushToken[...]');
  }

  try {
    // Step 1: Send the notification
    const sendResponse = await sendPushNotification(expoPushToken, {
      title: 'End of Day Survey',
      body: 'Take a moment to reflect on your social media use today',
      data: { 
        type: 'eod-survey',
        url: 'https://mit.co1.qualtrics.com/jfe/form/SV_a9x3wnEMkCDq1vM',
        timestamp: new Date().toISOString(),
      },
    });

    console.log('\n✅ Notification sent successfully!');
    console.log('Response:', JSON.stringify(sendResponse, null, 2));

    // Extract receipt IDs from the response
    const receiptIds = [];
    if (sendResponse.data && sendResponse.data.id) {
      receiptIds.push(sendResponse.data.id);
    } else if (Array.isArray(sendResponse.data)) {
      sendResponse.data.forEach(item => {
        if (item.id) receiptIds.push(item.id);
      });
    }

    if (receiptIds.length === 0) {
      console.log('\n⚠️  No receipt IDs found in response');
      return;
    }

    // Step 2: Wait a bit for the notification to be processed
    console.log('\n⏳ Waiting 3 seconds before checking receipts...');
    await wait(3000);

    // Step 3: Check receipts
    const receiptsResponse = await checkReceipts(receiptIds);
    
    console.log('\n📋 Receipts received:');
    console.log(JSON.stringify(receiptsResponse, null, 2));

    // Parse and display receipt details
    if (receiptsResponse.data) {
      console.log('\n📊 Receipt Details:');
      Object.entries(receiptsResponse.data).forEach(([id, receipt]) => {
        console.log(`\n  Receipt ID: ${id}`);
        console.log(`  Status: ${receipt.status}`);
        
        if (receipt.status === 'ok') {
          console.log('  ✅ Notification delivered successfully');
        } else if (receipt.status === 'error') {
          console.log(`  ❌ Error: ${receipt.message}`);
          if (receipt.details) {
            console.log(`  Details: ${JSON.stringify(receipt.details)}`);
          }
        }
      });
    }

    console.log('\n✨ Done!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

/**
 * Send an EOD (End of Day) survey notification with Qualtrics link
 * @param {string} expoPushToken - The Expo push token
 * @param {string} userId - Optional user ID to append to Qualtrics URL
 * @returns {Promise<Object>} - The response from Expo
 */
async function sendEODNotification(expoPushToken, userId = null) {
  const qualtricsUrl = userId 
    ? `https://mit.co1.qualtrics.com/jfe/form/SV_a9x3wnEMkCDq1vM?userId=${userId}`
    : 'https://mit.co1.qualtrics.com/jfe/form/SV_a9x3wnEMkCDq1vM';

  return sendPushNotification(expoPushToken, {
    title: 'End of Day Survey',
    body: 'Take a moment to reflect on your social media use today',
    data: {
      type: 'eod-survey',
      url: qualtricsUrl,
      timestamp: new Date().toISOString(),
    },
    priority: 'high',
    sound: 'default',
  });
}

// Export functions for use as a module
module.exports = {
  sendPushNotification,
  sendEODNotification,
  checkReceipts,
};
