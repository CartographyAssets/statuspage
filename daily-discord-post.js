const fs = require('fs');
const https = require('https');

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const logFile = './logs/ca_maintenance_report.log';

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yDateStr = yesterday.toISOString().split('T')[0];

if (!fs.existsSync(logFile)) {
  console.log("⚠️ Log file not found.");
  process.exit(0);
}

const entries = fs.readFileSync(logFile, 'utf-8')
  .split('\n')
  .filter(line => line.startsWith(yDateStr));

if (entries.length === 0) {
  console.log("✅ No changes found for yesterday. No Discord post needed.");
  process.exit(0);
}

const typeOrder = ['added', 'fixed', 'updated', 'removed', 'maintenance', 'downtime'];
const grouped = {};

entries.forEach(entry => {
  const [, typeRaw, description] = entry.split(', ', 3);
  const type = typeRaw.toLowerCase();
  if (!grouped[type]) grouped[type] = [];
  grouped[type].push(description);
});

// Format message
const lines = [`**Changelog for ${yDateStr}**\n`];
let totalCount = 0;
let includedCount = 0;

typeOrder.forEach(type => {
  const items = grouped[type];
  if (items) {
    const header = `**${type.toUpperCase()}**`;
    const list = items.map(desc => `– ${desc}`);
    const section = [header, ...list];

    for (let line of section) {
      if ((lines.join('\n') + '\n' + line).length >= 1900) {
        break;
      }
      lines.push(line);
      includedCount++;
    }
    totalCount += items.length;
  }
});

if (includedCount < totalCount) {
  lines.push(`…and ${totalCount - includedCount} more change${totalCount - includedCount === 1 ? '' : 's'}`);
}

lines.push(`\n[Click for live status](https://status.cartographyassets.com)`);

const finalMessage = lines.join('\n');

const payload = JSON.stringify({ content: finalMessage });

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
