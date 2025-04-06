const fs = require('fs');
const https = require('https');

// ✅ Read webhook from environment (GitHub Secret)
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const logFile = './logs/ca_maintenance_report.log';

// 🕖 Get yesterday's date (YYYY-MM-DD)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yDateStr = yesterday.toISOString().split('T')[0];

// ❓ Make sure log file exists
if (!fs.existsSync(logFile)) {
  console.log("⚠️ Log file not found.");
  process.exit(0);
}

// 📄 Read the log file and extract yesterday's entries
const entries = fs.readFileSync(logFile, 'utf-8')
  .split('\n')
  .filter(line => line.startsWith(yDateStr));

if (entries.length === 0) {
  console.log("✅ No changes found for yesterday. No Discord post needed.");
  process.exit(0);
}

// 🛠 Format message content for Discord
const content = entries.map(e => {
  const [timestamp, type, description] = e.split(', ', 3);
  const emoji = getEmoji(type);
  return `${emoji} **${type.toUpperCase()}** — ${description}`;
}).join('\n');

const payload = JSON.stringify({
  content: `📅 **Changelog for ${yDateStr}**\n${content}`
});

// 📡 Send the POST request to Discord
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

// ✨ Optional emoji helper for clarity
function getEmoji(type) {
  switch (type.toLowerCase()) {
    case 'update': return '🚀';
    case 'maintenance': return '🛠';
    case 'fix': return '🐛';
    case 'chore': return '📦';
    default: return '📝';
  }
}
