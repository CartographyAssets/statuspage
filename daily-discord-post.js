const fs = require('fs');
const https = require('https');

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const logFile = './logs/ca_maintenance_report.log';
const statusLink = 'https://status.cartographyassets.com';
const MAX_DISCORD_LENGTH = 1900; // buffer under 2000 to be safe

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

// Group by type
const grouped = {};
entries.forEach(e => {
  const [timestamp, type, description] = e.split(', ', 3);
  const t = type.toLowerCase();
  if (!grouped[t]) grouped[t] = [];
  const time = timestamp.split('T')[1]?.slice(0, 5) ?? '??:??';
  grouped[t].push({ time, description });
});

const typeOrder = ['added', 'fixed', 'updated', 'removed', 'maintenance', 'downtime'];

function formatTypeBlock(type, entries) {
  const header = `**${type.toUpperCase()}**`;
  const formatted = entries.map(e => `\`${e.time}\` — ${e.description}`).join('\n');
  return `\`\`\`${getBlockType(type)}\n${header}\n\`\`\`\n${formatted}`;
}

function getBlockType(type) {
  switch (type) {
    case 'added': return 'diff'; // green
    case 'fixed': case 'updated': return 'ini'; // blue
    case 'removed': case 'downtime': return 'diff'; // red
    case 'maintenance': return 'css'; // gray
    default: return 'ansi'; // fallback
  }
}

// Build message chunks under Discord's limit
let messages = [];
let current = `**Changelog for ${yDateStr}**\n\n`;
for (const type of typeOrder) {
  if (!grouped[type]) continue;
  const block = formatTypeBlock(type, grouped[type]) + '\n\n';

  if ((current + block).length >= MAX_DISCORD_LENGTH) {
    messages.push(current);
    current = '';
  }

  current += block;
}
current += `[Click for live status](${statusLink})`;
messages.push(current);

// Send each message
messages.forEach((msg, i) => {
  const payload = JSON.stringify({ content: msg });

  const req = https.request(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, res => {
    console.log(`✅ Discord chunk ${i + 1}/${messages.length} sent (status: ${res.statusCode})`);
  });

  req.on('error', error => {
    console.error(`❌ Discord webhook failed: ${error.message}`);
  });

  req.write(payload);
  req.end();
});
