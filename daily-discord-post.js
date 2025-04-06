const fs = require('fs');
const https = require('https');

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const logFile = './logs/ca_maintenance_report.log';

// Get yesterday’s date (YYYY-MM-DD)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yDateStr = yesterday.toISOString().split('T')[0];

if (!fs.existsSync(logFile)) {
  console.log("⚠️ Log file not found.");
  process.exit(0);
}

const entries = fs.readFileSync(logFile, 'utf-8')
  .split('\n')
  .filter(line => line.slice(0, 10) === yDateStr);

if (entries.length === 0) {
  console.log("✅ No changes found for yesterday. No Discord post needed.");
  process.exit(0);
}

// Format log entries with Discord Markdown
const content = entries.map(entry => {
  const [timestamp, type, description] = entry.split(', ', 3);
  const time = timestamp.split(' ')[1];
  return `\`${time}\` **${capitalize(type)}** — ${description}`;
}).join('\n');

const payload = JSON.stringify({
  content:
    `📄 **Changelog for ${yDateStr}**\n` +
    content +
    `\n\n🔗 Live status available at: https://status.cartographyassets.com`
});

// Send POST request
const req = https.request(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  console.log(`✅ Sent to Discord (status: ${res.statusCode})`);
});

req.on('error', error => {
  console.error(`❌ Discord webhook failed: ${error.message}`);
});

req.write(payload);
req.end();

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
