// index.js with maintenance support

const maxDays = 30;
let cloneId = 0;
let tooltipTimeout = null;

let maintenanceData = {};
let changelogData = [];
let maintenanceLoaded = false;

const changelogTypes = {
  added:       { label: "Added", color: "#4caf50" },    // Green
  changed:     { label: "Changed", color: "#2196f3" },  // Blue
  fixed:       { label: "Fixed", color: "#009688" },    // Teal
  removed:     { label: "Removed", color: "#f44336" },  // Red
  deprecated:  { label: "Deprecated", color: "#ff9800" },// Orange
  security:    { label: "Security", color: "#c62828" }, // Deep red
  performance: { label: "Performance", color: "#9c27b0" },// Purple
  maintenance: { label: "Maintenance", color: "#607d8b" },// Gray blue
  docs:        { label: "Docs", color: "#795548" },     // Brown
  ui:          { label: "UI", color: "#e91e63" },       // Pink
  backend:     { label: "Backend", color: "#3f51b5" },  // Indigo
  dev:         { label: "Dev", color: "#ffeb3b" },       // Yellow
  known:       { label: "Known Issue", color: "#ff5722" } // Deep orange

};


async function genReportLog(container, key, url) {
  if (key === "cartographyassets" && !maintenanceLoaded) {
    await loadMaintenanceAndChangelog();
    maintenanceLoaded = true;
  }

  const response = await fetch("logs/" + key + "_report.log");
  let statusLines = "";
  if (response.ok) {
    statusLines = await response.text();
  }

  const normalized = normalizeData(statusLines);
  const statusStream = constructStatusStream(key, url, normalized);
  container.appendChild(statusStream);
}

async function loadMaintenanceAndChangelog() {
  const response = await fetch('logs/ca_maintenance_report.log');
  if (!response.ok) return;

  const logText = await response.text();
  const logEntries = logText.trim().split('\n');
  logEntries.sort((a, b) => new Date(b.split(', ')[0]) - new Date(a.split(', ')[0]));

  const changelogContainer = document.getElementById("changelog");
  if (!changelogContainer) return;

  changelogContainer.innerHTML = "";

  const groupedByDate = {};

  logEntries.forEach(entry => {
    if (!entry || !entry.includes(', ')) return;

    const parts = entry.split(', ', 3);
    if (parts.length < 3) return;

    const [timestamp, typeRaw, description] = parts;
    const dateObj = new Date(timestamp + " UTC");
    const dateStr = dateObj.toDateString();
    const time = dateObj.toTimeString().split(' ')[0].slice(0, 5);
    const typeKey = typeRaw.trim().toLowerCase();
    const typeInfo = changelogTypes[typeKey] || { label: capitalize(typeKey), color: "#999" };
    const isDowntime = typeKey === "downtime";

    // Voor tooltip-data in status-blokken
    if (!maintenanceData[dateStr]) maintenanceData[dateStr] = [];
    maintenanceData[dateStr].push({
      status: typeInfo.label,
      description,
      forceDown: isDowntime
    });

    // Changelog groeperen
    if (!groupedByDate[dateStr]) groupedByDate[dateStr] = {};
    if (!groupedByDate[dateStr][typeKey]) groupedByDate[dateStr][typeKey] = [];

    groupedByDate[dateStr][typeKey].push({
      description,
      time,
      label: typeInfo.label,
      color: typeInfo.color
    });
  });

  // Bouw changelog DOM
  for (const date in groupedByDate) {
    const dateHeader = document.createElement("h3");
    dateHeader.innerText = date;
    changelogContainer.appendChild(dateHeader);

    const typeGroups = groupedByDate[date];
    for (const typeKey in typeGroups) {
      const entries = typeGroups[typeKey];
      const typeInfo = changelogTypes[typeKey] || { label: capitalize(typeKey), color: "#999" };

      const typeHeader = document.createElement("h4");
      typeHeader.innerText = typeInfo.label;
      typeHeader.style.color = typeInfo.color;
      changelogContainer.appendChild(typeHeader);

      const ul = document.createElement("ul");

      entries.forEach(entry => {
        const li = document.createElement("li");

        const pill = document.createElement("span");
        pill.className = "pill";
        pill.style.backgroundColor = entry.color;
        pill.style.marginRight = "0.5em";
        pill.innerText = `${entry.label} ${entry.time}`;

        const desc = document.createElement("span");
        desc.className = "log-desc";
        desc.innerText = entry.description;

        li.appendChild(pill);
        li.appendChild(desc);
        ul.appendChild(li);
      });

      changelogContainer.appendChild(ul);
    }
  }
}



function formatDescription(type, desc) {
  const prefixTypes = ["ADDED", "FIXED", "REMOVED", "UPDATED"];
  return prefixTypes.includes(type) ? `${capitalize(type.toLowerCase())}: ${desc}` : desc;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function constructStatusStream(key, url, uptimeData) {
  let streamContainer = templatize("statusStreamContainerTemplate");
  for (var ii = maxDays - 1; ii >= 0; ii--) {
    let line = constructStatusLine(key, ii, uptimeData[ii]);
    streamContainer.appendChild(line);
  }

  const lastSet = uptimeData[0];
  const forceDown = Object.values(maintenanceData).flat().some(entry => entry.forceDown);
  const color = getColor(lastSet, forceDown);

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

function constructStatusLine(key, relDay, upTimeArray) {
  let date = new Date();
  date.setDate(date.getDate() - relDay);

  return constructStatusSquare(key, date, upTimeArray);
}

function getColor(uptimeVal, forceDown = false) {
  if (forceDown) return "failure";
  return uptimeVal == null
    ? "nodata"
    : uptimeVal == 1
    ? "success"
    : uptimeVal < 0.3
    ? "failure"
    : "partial";
}

function constructStatusSquare(key, date, uptimeVal) {
  const dateStr = date.toDateString();
  const maintenanceInfo = maintenanceData[dateStr] || [];
  const forceDown = maintenanceInfo.some(entry => entry.forceDown);
  const color = getColor(uptimeVal, forceDown);

  const tooltip = getTooltip(key, date, color, maintenanceInfo);

  let square = templatize("statusSquareTemplate", {
    color: color,
    tooltip: tooltip,
  });

  const show = () => {
    showTooltip(square, key, date, color, maintenanceInfo);
  };
  square.addEventListener("mouseover", show);
  square.addEventListener("mousedown", show);
  square.addEventListener("mouseout", hideTooltip);
  return square;
}

function templatize(templateId, parameters) {
  let clone = document.getElementById(templateId).cloneNode(true);
  clone.id = "template_clone_" + cloneId++;
  if (!parameters) {
    return clone;
  }

  applyTemplateSubstitutions(clone, parameters);
  return clone;
}

function applyTemplateSubstitutions(node, parameters) {
  const attributes = node.getAttributeNames();
  for (var ii = 0; ii < attributes.length; ii++) {
    const attr = attributes[ii];
    const attrVal = node.getAttribute(attr);
    node.setAttribute(attr, templatizeString(attrVal, parameters));
  }

  if (node.childElementCount == 0) {
    node.innerText = templatizeString(node.innerText, parameters);
  } else {
    const children = Array.from(node.children);
    children.forEach((n) => {
      applyTemplateSubstitutions(n, parameters);
    });
  }
}

function templatizeString(text, parameters) {
  if (parameters) {
    for (const [key, val] of Object.entries(parameters)) {
      text = text.replaceAll("$" + key, val);
    }
  }
  return text;
}

function getStatusText(color) {
  return color == "nodata"
    ? "No Data Available"
    : color == "success"
    ? "Fully Operational"
    : color == "failure"
    ? "Major Outage"
    : color == "partial"
    ? "Partial Outage"
    : "Unknown";
}

function getStatusDescriptiveText(color) {
  return color == "nodata"
    ? "No Data Available: Health check was not performed."
    : color == "success"
    ? "No downtime recorded on this day."
    : color == "failure"
    ? "Major outages recorded on this day."
    : color == "partial"
    ? "Partial outages recorded on this day."
    : "Unknown";
}

function getTooltip(key, date, color, maintenanceInfo = []) {
  let statusText = getStatusText(color);
  let base = `${key} | ${date.toDateString()} : ${statusText}`;
  if (maintenanceInfo.length > 0) {
    maintenanceInfo.forEach(entry => {
      base += `\n🛠 ${entry.status}: ${entry.description}`;
    });
  }
  return base;
}

function showTooltip(element, key, date, color, maintenanceInfo = []) {
  clearTimeout(tooltipTimeout);
  const toolTipDiv = document.getElementById("tooltip");

  document.getElementById("tooltipDateTime").innerText = date.toDateString();
  document.getElementById("tooltipDescription").innerText = getStatusDescriptiveText(color);

  const statusDiv = document.getElementById("tooltipStatus");
  statusDiv.innerText = getStatusText(color);
  statusDiv.className = color;

  const maintenanceDiv = document.getElementById("tooltipMaintenance");
  if (maintenanceDiv) {
    maintenanceDiv.innerHTML = "";
    maintenanceInfo.forEach(entry => {
      const div = document.createElement("div");
      div.innerText = `🛠 ${entry.status}: ${entry.description}`;
      maintenanceDiv.appendChild(div);
    });
  }

  toolTipDiv.style.top = element.offsetTop + element.offsetHeight + 10 + "px";
  toolTipDiv.style.left = element.offsetLeft + element.offsetWidth / 2 - toolTipDiv.offsetWidth / 2 + "px";
  toolTipDiv.style.opacity = "1";
}

function hideTooltip() {
  tooltipTimeout = setTimeout(() => {
    const toolTipDiv = document.getElementById("tooltip");
    toolTipDiv.style.opacity = "0";
  }, 1000);
}

function normalizeData(statusLines) {
  const rows = statusLines.split("\n");
  const dateNormalized = splitRowsByDate(rows);

  let relativeDateMap = {};
  const now = Date.now();
  for (const [key, val] of Object.entries(dateNormalized)) {
    if (key == "upTime") {
      continue;
    }

    const relDays = getRelativeDays(now, new Date(key).getTime());
    relativeDateMap[relDays] = getDayAverage(val);
  }

  relativeDateMap.upTime = dateNormalized.upTime;
  return relativeDateMap;
}

function splitRowsByDate(rows) {
  let dateValues = {};
  let sum = 0,
    count = 0;
  for (var ii = 0; ii < rows.length; ii++) {
    const row = rows[ii];
    if (!row) {
      continue;
    }

    const [dateTimeStr, resultStr] = row.split(",", 2);
    const dateTime = new Date(Date.parse(dateTimeStr.replace(/-/g, "/") + " GMT"));
    const dateStr = dateTime.toDateString();

    let resultArray = dateValues[dateStr];
    if (!resultArray) {
      resultArray = [];
      dateValues[dateStr] = resultArray;
      if (Object.keys(dateValues).length > maxDays) {
        break;
      }
    }

    let result = 0;
    if (resultStr.trim() == "success") {
      result = 1;
    }
    sum += result;
    count++;

    resultArray.push(result);
  }

  const upTime = count ? ((sum / count) * 100).toFixed(2) + "%" : "--%";
  dateValues.upTime = upTime;
  return dateValues;
}

function getRelativeDays(date1, date2) {
  return Math.floor(Math.abs((date1 - date2) / (24 * 3600 * 1000)));
}

function getDayAverage(val) {
  if (!val || val.length == 0) {
    return null;
  } else {
    return val.reduce((a, v) => a + v) / val.length;
  }
}

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
