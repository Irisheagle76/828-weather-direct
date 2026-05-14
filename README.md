# 828-weather-direct
Weather app dedicated to Asheville North Carolina

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
