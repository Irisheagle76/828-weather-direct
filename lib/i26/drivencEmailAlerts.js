import crypto from "node:crypto";

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

export function parseDriveNcEmailAlert(input = {}) {
  const body = normalizeBody(input.body || input.text || "");
  const subject = clean(input.subject || "DriveNC alert");
  const receivedAt = normalizeDate(input.receivedAt) || new Date().toISOString();
  const lines = body
    .split(/\r?\n/)
    .map((line) => clean(line))
    .filter(Boolean);

  const statusLineIndex = lines.findIndex((line) => Boolean(extractStatusLine(line)));
  const statusLine = statusLineIndex >= 0 ? extractStatusLine(lines[statusLineIndex]) : subject;
  const [typePart = "Traffic alert", statusPart = "New"] = statusLine.split(/\s+-\s+/);
  const status = clean(statusPart);
  const cleared = /cleared/i.test(status) || lines.some((line) => /^cleared:?$/i.test(line));
  const description = extractDescription(lines, statusLineIndex);
  const eventId = extractEventId(description) || extractEventId(body);
  const startText = extractField(body, "Start Time");
  const endText = extractField(body, "Anticipated End Time");
  const mapUrl = extractMapUrl(body);
  const road = extractRoad(description);
  const alertType = normalizeType(typePart);

  return {
    id: buildId(eventId, statusLine, description),
    eventId,
    source: "DriveNC email",
    sourceEmail: clean(input.from || input.sender || "DriveNC-Notify@drivenc.gov"),
    subject,
    type: alertType,
    typeLabel: clean(typePart),
    status,
    cleared,
    road,
    title: `${clean(typePart)} - ${status}`,
    description,
    startTimeText: startText,
    endTimeText: endText,
    startTime: parseDriveNcDate(startText),
    endTime: parseDriveNcDate(endText),
    url: mapUrl || "https://www.drivenc.gov/region/Asheville",
    area: extractArea(lines) || "I-26 Connector",
    severity: inferSeverity(typePart, description, cleared),
    receivedAt,
    updatedAt: receivedAt
  };
}

export function isDriveNcSender(value = "") {
  return /drivenc-notify@drivenc\.gov/i.test(String(value));
}

function extractDescription(lines, statusLineIndex) {
  const start = statusLineIndex >= 0 ? statusLineIndex + 1 : 0;
  const bodyLines = [];

  for (const line of lines.slice(start)) {
    if (/^hi\b/i.test(line)) continue;
    if (/^cleared:?$/i.test(line)) continue;
    if (/^Start Time\b/i.test(line)) break;
    if (/^Anticipated End Time\b/i.test(line)) break;
    if (/^\[View on map\]/i.test(line)) break;
    if (/^Area Notification\b/i.test(line)) break;
    if (/^\[(X|Facebook|YouTube|Contact Us|Unsubscribe)\]/i.test(line)) break;
    if (/^Please do not reply/i.test(line)) break;
    bodyLines.push(line);
  }

  return clean(bodyLines.join(" ")) || "DriveNC alert for the I-26 Connector notification area.";
}

function extractField(body, label) {
  const match = body.match(new RegExp(`${label}\\s+([^\\n\\r]+)`, "i"));
  return clean(match?.[1] || "");
}

function extractMapUrl(body) {
  return clean(body.match(/\[View on map\]\((https?:\/\/[^)]+)\)/i)?.[1] || "");
}

function extractArea(lines) {
  const line = lines.find((item) => /^Area Notification\b/i.test(item));
  return clean(line?.replace(/^Area Notification/i, "") || "");
}

function extractStatusLine(value) {
  const match = clean(value).match(/\b((?:Upcoming\s+)?(?:Road Work|Closure|Incident|Upcoming Closure))\s+-\s+([A-Za-z ]+)\b/i);
  if (!match) return "";
  return `${toTitleCase(match[1])} - ${toTitleCase(match[2])}`;
}

function extractEventId(value) {
  return clean(String(value).match(/\bID\s*[-:]?\s*(-?\d+)\b/i)?.[1] || String(value).match(/\bId:\s*(-?\d+)\b/i)?.[1] || "");
}

function extractRoad(value) {
  return clean(String(value).match(/\b(I-\d+|US-\d+(?:-[A-Z]+)?|NC-\d+|Ramp)\b/i)?.[1] || "Connector area");
}

function normalizeType(value) {
  const type = clean(value).toLowerCase();
  if (type.includes("closure")) return "closure";
  if (type.includes("road work")) return "road-work";
  if (type.includes("incident")) return "incident";
  return "traffic-alert";
}

function inferSeverity(type, description, cleared) {
  if (cleared) return "cleared";
  const text = `${type} ${description}`.toLowerCase();
  if (text.includes("all lanes closed") || text.includes("closure")) return "closure";
  if (text.includes("crash") || text.includes("incident")) return "incident";
  return "advisory";
}

function buildId(eventId, statusLine, description) {
  const source = eventId ? `${eventId}:${statusLine}` : `${statusLine}:${description}`;
  return `drivenc-${crypto.createHash("sha1").update(source).digest("hex").slice(0, 16)}`;
}

function parseDriveNcDate(value) {
  const match = clean(value).match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i);
  if (!match) return "";

  const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
  if (month === undefined) return "";

  let hour = Number(match[4]);
  if (/pm/i.test(match[6]) && hour !== 12) hour += 12;
  if (/am/i.test(match[6]) && hour === 12) hour = 0;

  const year = Number(match[3]);
  const offsetHours = month >= 2 && month <= 10 ? 4 : 5;
  return new Date(Date.UTC(year, month, Number(match[2]), hour + offsetHours, Number(match[5]))).toISOString();
}

function normalizeDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeBody(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\[image:[^\]]+\]/gi, " ")
    .replace(/\*/g, "")
    .trim();
}

function toTitleCase(value) {
  return clean(value).toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
