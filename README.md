# 828-weather-direct
Weather app dedicated to Asheville North Carolina

## I-26 Connector cameras

The Connector Center uses the public NCDOT incident layer without credentials. To enable
the filtered I-26, I-240, and I-40 camera cards, request a DriveNC developer key and add:

```txt
DRIVENC_API_KEY=your-drivenc-developer-key
```

Without the key, the page falls back to official DriveNC roadway camera links.

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
