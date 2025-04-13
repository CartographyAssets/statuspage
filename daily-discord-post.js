const fs = require('fs');
const https = require('https');

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const logFile = './logs/ca_maintenance_report.log';

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

if (entries.length === 0) {
  console.log("✅ No changelog entries for yesterday. Skipping post.");
  process.exit(0);
}

// Type map and order
const typeMap = {
  added:       "ADDED",
  changed:     "CHANGED",
  fixed:       "FIXED",
  removed:     "REMOVED",
  deprecated:  "DEPRECATED",
  security:    "SECURITY",
  performance: "PERFORMANCE",
  maintenance: "MAINTENANCE",
  docs:        "DOCS",
  ui:          "UI",
  backend:     "BACKEND",
  dev:         "DEV"
};

const typeOrder = Object.values(typeMap);
const grouped = {};

// Group entries by mapped type
entries.forEach(entry => {
  const [, typeRaw, description] = entry.split(', ', 3);
  const typeKey = typeRaw?.toLowerCase();
  const mappedType = typeMap[typeKey] || "OTHER";
  if (!grouped[mappedType]) grouped[mappedType] = [];
  grouped[mappedType].push(description);
});

// Build the Discord message
const lines = [
  `**Changelog for ${yDateLabel}**`,
];

let totalCount = 0;
let includedCount = 0;

const allTypes = [...typeOrder, "OTHER"];

allTypes.forEach(type => {
  const items = grouped[type];
  if (items) {
    const header = `**${type}**`;
    const list = items.map(desc => `– ${desc}`);

    if (lines.at(-1) !== '') {
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

// Send to Discord
const payload = JSON.stringify({
  content: lines.join('\n')
});

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
