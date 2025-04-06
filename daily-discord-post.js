const fs = require('fs');
const https = require('https');

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const logFile = './logs/ca_maintenance_report.log';
const statusFile = './logs/cartographyassets_report.log';

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yDateStr = yesterday.toISOString().split('T')[0];
const yDateLabel = yesterday.toDateString();

if (!fs.existsSync(logFile)) {
  console.log("⚠️ Log file not found.");
  process.exit(0);
}

// Read and filter entries for yesterday
const entries = fs.readFileSync(logFile, 'utf-8')
  .split('\n')
  .filter(line => line.startsWith(yDateStr));

const hasCriticalChange = entries.some(e => {
  const [, typeRaw] = e.split(', ', 2);
  return ['downtime', 'online'].includes(typeRaw?.trim()?.toLowerCase());
});

if (entries.length === 0 && !hasCriticalChange) {
  console.log("✅ No changelog or critical status update. Skipping post.");
  process.exit(0);
}

// Determine current status
let currentStatus = "❓ Unknown";
if (fs.existsSync(statusFile)) {
  const statusLines = fs.readFileSync(statusFile, 'utf-8').trim().split('\n');
  const lastLine = statusLines.at(-1);
  const [, result] = lastLine.split(', ');
  currentStatus =
    result === 'success' ? '✅ Fully Operational'
    : result === 'partial' ? '⚠️ Partial Outage'
    : result === 'failed' ? '❌ Major Outage'
    : '❓ Unknown';
}

// Group entries
const typeOrder = ['added', 'fixed', 'updated', 'removed', 'maintenance', 'downtime'];
const grouped = {};

entries.forEach(entry => {
  const [, typeRaw, description] = entry.split(', ', 3);
  const type = typeRaw.toLowerCase();
  if (!grouped[type]) grouped[type] = [];
  grouped[type].push(description);
});

// Build the Discord message
const lines = [
  `**Status for ${yDateLabel}**`,
  `${currentStatus}`,
  ``,
  `##Changelog`
];

let totalCount = 0;
let includedCount = 0;

typeOrder.forEach(type => {
  const items = grouped[type];
  if (items) {
    const header = `**${type.toUpperCase()}**`;
    const list = items.map(desc => `– ${desc}`);

    // Insert spacing before new block
    if (lines.at(-1) !== '' && lines.at(-1) !== '\n') {
      lines.push('');
    }

    const section = [header, ...list];

    for (let line of section) {
      if ((lines.join('\n') + '\n' + line).length >= 1900) {
        break;
      }
      lines.push(line);
      if (line.startsWith('–')) includedCount++;
    }
    totalCount += items.length;
  }
});

if (includedCount < totalCount) {
  lines.push(`\n…and ${totalCount - includedCount} more change${totalCount - includedCount === 1 ? '' : 's'}`);
}

lines.push(`\n[Click for live status](https://status.cartographyassets.com)`);

const payload = JSON.stringify({
  content: lines.join('\n')
});

// Send to Discord
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
