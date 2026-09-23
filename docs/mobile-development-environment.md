# 828 Mobile development environment

The preserved mobile prototype has a dedicated C-drive checkout:

`C:\Users\Tim\828codeproject\828-weather-direct-mobile-preview`

It tracks the `codex/mobile-app` branch and is intentionally separate from the production website checkout. Do not deploy production from this directory.

## Start the preview

From PowerShell in the directory above:

```powershell
npm run preview:mobile
```

The launcher starts a hidden local server, opens `http://127.0.0.1:4174/mobile/#home`, reuses an existing healthy preview, and writes ignored logs beneath `.tmp/mobile-preview/`.

It looks for `.env.local` in this checkout first, then uses the sibling production-development checkout's `.env.local` when available. Secrets remain untracked.

## Focused verification

```powershell
npm run test:mobile
```

This checks the mobile JavaScript and the focused preview cache, FEELSCORE time-window, forecast-copy, and regional-map tests.

## Release boundary

This environment is for mobile development and local review. Public deployment still requires deliberate integration into current `main`, verification from the authorized release checkout, and explicit approval.
