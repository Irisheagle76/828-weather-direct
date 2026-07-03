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
  const messages = GmailApp.search(SEARCH_QUERY, 0, 25)
    .reduce((all, thread) => all.concat(thread.getMessages()), [])
    .sort((a, b) => a.getDate().getTime() - b.getDate().getTime());

  messages.forEach((message) => {
    const messageId = message.getId();
    if (processed.has(messageId)) return;

    try {
      const response = UrlFetchApp.fetch(ingestUrl, {
          method: "post",
          contentType: "application/json",
          headers: {
            Authorization: `Bearer ${ingestSecret}`
          },
          payload: JSON.stringify({
            messageId,
            from: message.getFrom(),
            subject: message.getSubject(),
            body: message.getPlainBody(),
            receivedAt: message.getDate().toISOString()
          }),
          muteHttpExceptions: true
      });

      const status = response.getResponseCode();
      if (status >= 200 && status < 300) {
        processed.add(messageId);
        saveProcessedIds(props, processed);
        console.log(`Published DriveNC message ${messageId}.`);
        return;
      }

      const detail = response.getContentText();
      if (status >= 400 && status < 500 && status !== 401 && status !== 403) {
        processed.add(messageId);
        saveProcessedIds(props, processed);
        console.error(`Skipped DriveNC message ${messageId} after HTTP ${status}: ${detail}`);
        return;
      }

      console.error(`DriveNC ingest temporarily failed for ${messageId} with HTTP ${status}: ${detail}`);
    } catch (error) {
      console.error(`DriveNC ingest request failed for ${messageId}: ${error}`);
    }
  });
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
