// index.js with maintenance support

const maxDays = 30;
let cloneId = 0;
let tooltipTimeout = null;
let maintenanceData = {};
let maintenanceLoaded = false;

async function genReportLog(container, key, url) {
  const response = await fetch("logs/" + key + "_report.log");
  let statusLines = "";
  if (response.ok) {
    statusLines = await response.text();
  }

  const normalized = normalizeData(statusLines);
  const statusStream = constructStatusStream(key, url, normalized);
  container.appendChild(statusStream);

  if (key === "cartographyassets" && !maintenanceLoaded) {
    await loadMaintenanceData();
    maintenanceLoaded = true;
  }
}

async function loadMaintenanceData() {
  const response = await fetch('logs/cartographyassets_maintenance_report.log');
  if (!response.ok) return;

  const logText = await response.text();
  const logEntries = logText.trim().split('\n');
  logEntries.forEach(entry => {
    const [timestamp, status, description] = entry.split(', ');
    const date = new Date(timestamp).toDateString();
    if (!maintenanceData[date]) {
      maintenanceData[date] = [];
    }
    maintenanceData[date].push({ status, description });
  });
}

// [rest of your code remains unchanged below]

function constructStatusStream(key, url, uptimeData) {
  let streamContainer = templatize("statusStreamContainerTemplate");
  for (var ii = maxDays - 1; ii >= 0; ii--) {
    let line = constructStatusLine(key, ii, uptimeData[ii]);
    streamContainer.appendChild(line);
  }

  const lastSet = uptimeData[0];
  const color = getColor(lastSet);

  const container = templatize("statusContainerTemplate", {
    title: key,
    url: url,
    color: color,
    status: getStatusText(color),
    upTime: uptimeData.upTime,
  });

  container.appendChild(streamContainer);
  return container;
}

// [rest of the functions stay the same...]

// ...

async function genAllReports() {
  const response = await fetch("urls.cfg");
  const configText = await response.text();
  const configLines = configText.split("\n");
  for (let ii = 0; ii < configLines.length; ii++) {
    const configLine = configLines[ii];
    const [key, url] = configLine.split("=");
    if (!key || !url) {
      continue;
    }

    await genReportLog(document.getElementById("reports"), key, url);
  }
}

genAllReports();
