const fs = require('fs');
const https = require('https');

// Read webhook URL from environment variables
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const logFile = './logs/ca_maintenance_report.log';

// Get yesterday's date in YYYY-MM-DD format
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yDateStr = yesterday.toISOString().split('T')[0];

// Ensure the log file exists
if (!fs.existsSync(logFile)) {
  console.log("⚠️ Log file not found.");
  process.exit(0);
}

// Read the log file and extract entries from yesterday
const entries = fs.readFileSync(logFile, 'utf-8')
  .split('\n')
  .filter(line => line.startsWith(yDateStr));

if (entries.length === 0) {
  console.log("✅ No changes found for yesterday. No Discord post needed.");
  process.exit(0);
}

// Format message content for Discord
const content = entries.map(e => {
  const [timestamp, type, description] = e.split(', ', 3);
  const formattedType = formatType(type);
  return `**${formattedType}** — ${description}`;
}).join('\n');

const payload = JSON.stringify({
  content: `${content}\n\n[Live status]<https://status.cartographyassets.com>`
});

// Send the POST request to Discord
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

// Helper function to format the type with Discord's text formatting
function formatType(type) {
  const lowerType = type.toLowerCase();
  switch (lowerType) {
    case 'added':
      return `\`\`\`diff\n+ ${type.toUpperCase()}\n\`\`\``; // Green
    case 'fixed':
    case 'updated':
      return `\`\`\`ini\n[ ${type.toUpperCase()} ]\n\`\`\``; // Blue
    case 'removed':
    case 'downtime':
      return `\`\`\`diff\n- ${type.toUpperCase()}\n\`\`\``; // Red
    case 'maintenance':
      return `\`\`\`css\n${type.toUpperCase()}\n\`\`\``; // Gray
    default:
      return type.toUpperCase();
  }
}
