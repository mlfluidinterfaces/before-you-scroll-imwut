/**
 * Send End-of-Day Survey Notification
 * 
 * This script sends a notification that directs users to the Qualtrics EOD survey.
 * 
 * Usage:
 *   node scripts/send-eod-notification.js <expo-push-token> [user-id]
 * 
 * Examples:
 *   # Send without user ID
 *   node scripts/send-eod-notification.js ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 * 
 *   # Send with user ID for tracking
 *   node scripts/send-eod-notification.js ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx] user-123
 */

const { sendPushNotification, checkReceipts } = require('./send-expo-notification.js');

/**
 * Wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send an EOD survey notification
 */
async function sendEODNotification(expoPushToken, userId = null) {
  const qualtricsUrl = userId 
    ? `https://mit.co1.qualtrics.com/jfe/form/SV_a9x3wnEMkCDq1vM?userId=${encodeURIComponent(userId)}`
    : 'https://mit.co1.qualtrics.com/jfe/form/SV_a9x3wnEMkCDq1vM';

  console.log('📊 Survey URL:', qualtricsUrl);

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

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Error: Please provide an Expo push token');
    console.log('\nUsage:');
    console.log('  node scripts/send-eod-notification.js <expo-push-token> [user-id]');
    console.log('\nExamples:');
    console.log('  # Send without user ID');
    console.log('  node scripts/send-eod-notification.js ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
    console.log('\n  # Send with user ID for tracking in Qualtrics');
    console.log('  node scripts/send-eod-notification.js ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx] user-123');
    process.exit(1);
  }

  const expoPushToken = args[0];
  const userId = args[1] || null;

  // Validate token format
  if (!expoPushToken.startsWith('ExponentPushToken[') && 
      !expoPushToken.startsWith('ExpoPushToken[')) {
    console.warn('⚠️  Warning: Token does not appear to be in the expected format');
    console.warn('   Expected: ExponentPushToken[...] or ExpoPushToken[...]');
  }

  try {
    console.log('📤 Sending End-of-Day survey notification...');
    if (userId) {
      console.log(`👤 User ID: ${userId}`);
    }

    // Send the notification
    const sendResponse = await sendEODNotification(expoPushToken, userId);

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

    // Wait for notification to be processed
    console.log('\n⏳ Waiting 3 seconds before checking receipts...');
    await wait(3000);

    // Check receipts
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
    console.log('\n💡 When the user taps the notification, they will be directed to:');
    console.log(`   ${userId ? `https://mit.co1.qualtrics.com/jfe/form/SV_a9x3wnEMkCDq1vM?userId=${userId}` : 'https://mit.co1.qualtrics.com/jfe/form/SV_a9x3wnEMkCDq1vM'}`);

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

module.exports = { sendEODNotification };
