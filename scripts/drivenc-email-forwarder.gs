const PROCESSED_IDS_KEY = "DRIVENC_PROCESSED_MESSAGE_IDS";
const SEARCH_QUERY = 'from:drivenc-notify@drivenc.gov subject:"Events Within I-26 Connector" newer_than:14d';

function publishDriveNcConnectorEmails() {
  const props = PropertiesService.getScriptProperties();
  const ingestUrl = props.getProperty("DRIVENC_INGEST_URL");
  const ingestSecret = props.getProperty("DRIVENC_EMAIL_INGEST_SECRET");

  if (!ingestUrl || !ingestSecret) {
    throw new Error("Set DRIVENC_INGEST_URL and DRIVENC_EMAIL_INGEST_SECRET in Script Properties.");
  }

  const processed = loadProcessedIds(props);
  const threads = GmailApp.search(SEARCH_QUERY, 0, 25);

  threads.forEach((thread) => {
    thread.getMessages().forEach((message) => {
      const messageId = message.getId();
      if (processed.has(messageId)) return;

      const response = UrlFetchApp.fetch(ingestUrl, {
        method: "post",
        contentType: "application/json",
        headers: {
          Authorization: `Bearer ${ingestSecret}`
        },
        payload: JSON.stringify({
          from: message.getFrom(),
          subject: message.getSubject(),
          body: message.getPlainBody(),
          receivedAt: message.getDate().toISOString()
        }),
        muteHttpExceptions: true
      });

      const status = response.getResponseCode();
      if (status < 200 || status >= 300) {
        throw new Error(`DriveNC ingest failed with HTTP ${status}: ${response.getContentText()}`);
      }

      processed.add(messageId);
    });
  });

  saveProcessedIds(props, processed);
}

function loadProcessedIds(props) {
  try {
    return new Set(JSON.parse(props.getProperty(PROCESSED_IDS_KEY) || "[]"));
  } catch (error) {
    return new Set();
  }
}

function saveProcessedIds(props, processed) {
  const ids = Array.from(processed).slice(-500);
  props.setProperty(PROCESSED_IDS_KEY, JSON.stringify(ids));
}
