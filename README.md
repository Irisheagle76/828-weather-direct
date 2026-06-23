# 828-weather-direct
Weather app dedicated to Asheville North Carolina

## I-26 Connector cameras

The Connector Center uses the public NCDOT incident layer without credentials. To enable
the filtered I-26, I-240, and I-40 camera cards, request a DriveNC developer key and add:

```txt
DRIVENC_API_KEY=your-drivenc-developer-key
```

Without the key, the page falls back to official DriveNC roadway camera links.

## I-26 Connector DriveNC email alerts

DriveNC notification emails can be published to the Connector page through:

```
POST /api/router?route=i26/email-alerts-ingest
Authorization: Bearer <DRIVENC_EMAIL_INGEST_SECRET>
```

Send JSON with `from`, `subject`, `body`, and optionally `receivedAt`. The endpoint only accepts messages from `drivenc-notify@drivenc.gov`, parses the DriveNC alert text, stores recent alerts, and exposes them at:

```
GET /api/router?route=i26/email-alerts
```

Use a Gmail filter plus Google Apps Script, or an inbound email service, to forward matching DriveNC messages into the ingest endpoint.

The repo includes `scripts/drivenc-email-forwarder.gs` as a Google Apps Script bridge. Set these Script Properties:

```
DRIVENC_INGEST_URL=https://avlweather.com/api/router?route=i26/email-alerts-ingest
DRIVENC_EMAIL_INGEST_SECRET=<same value as Vercel>
```

Then run `publishDriveNcConnectorEmails` on a time trigger, such as every 5 minutes.

### Zoho Mail direct ingest

If DriveNC sends alerts directly to `tim@avlweather.com` in Zoho Mail, use a Zoho Mail outgoing webhook:

```
https://avlweather.com/api/router?route=i26/email-alerts-ingest&secret=<DRIVENC_EMAIL_INGEST_SECRET>
```

Configure the webhook for Mail with conditions similar to:

```txt
From contains drivenc-notify@drivenc.gov
Subject contains Events Within I-26 Connector
```

Leave Limited Data List off so Zoho posts the email body/HTML. The ingest route accepts Zoho fields such as `fromAddress`, `toAddress`, `receivedTime`, `summary`, and `html`, then stores the parsed alert in the Connector email alert feed.

## Admin and push setup

Set these environment variables in Vercel:

```txt
ADMIN_PASSWORD=choose-a-private-password
ADMIN_SESSION_SECRET=choose-a-long-random-session-secret
VAPID_PUBLIC_KEY=your-web-push-public-key
VAPID_PRIVATE_KEY=your-web-push-private-key
```

Generate VAPID keys with:

```txt
npx web-push generate-vapid-keys
```
