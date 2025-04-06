const fs = require('fs');
const https = require('https');

// Read webhook URL from environment variables
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const logFile = './logs/ca_maintenance_report.log';

// Get yesterday's date in YYYY-MM-DD format
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yDateStr = yesterday.toISOString().split('T')[0];

// Check if log file exists
if (!fs.existsSync(logFile)) {
  console.log("Log file not found.");
  process.exit(0);
}

// Read the log file and extract yesterday's entries
const entries = fs.readFileSync(logFile, 'utf-8')
  .split('\n')
  .filter(line => line.startsWith(yDateStr));

if (entries.length === 0) {
  console.log("No changes found for yesterday. No Discord post needed.");
  process.exit(0);
}

// Function to format entries with ANSI color codes
function formatEntry(type, description) {
  let colorCode;
  switch (type.toLowerCase()) {
    case 'added':
      colorCode = '\u001b[32m'; // Green
      break;
    case 'updated':
      colorCode = '\u001b[34m'; // Blue
      break;
    case 'removed':
    case 'downtime':
      colorCode = '\u001b[31m'; // Red
      break;
    case 'maintenance':
      colorCode = '\u001b[90m'; // Gray
      break;
    default:
      colorCode = '\u001b[0m'; // Reset/Default
  }
  return `${colorCode}**${type.toUpperCase()}**\u001b[0m — ${description}`;
}

// Group entries by type
const groupedEntries = entries.reduce((acc, entry) => {
  const [timestamp, type, description] = entry.split(', ', 3);
  if (!acc[type]) acc[type] = [];
  acc[type].push(formatEntry(type, description));
  return acc;
}, {});

// Construct the message content
let content = `**Changelog for ${yDateStr}**\n`;
for (const [type, msgs] of Object.entries(groupedEntries)) {
  content += `\n${msgs.join('\n')}\n`;
}
content += `\n[Click for live status](https://status.cartographyassets.com)`;

// Prepare the payload
const payload = JSON.stringify({ content: `\`\`\`ansi\n${content}\n\`\`\`` });

// Send the POST request to Discord
const req = https.request(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  console.log(`Sent to Discord (status: ${res.statusCode})`);
});

req.on('error', error => {
  console.error(`Discord webhook failed: ${error.message}`);
});

req.write(payload);
req.end();
