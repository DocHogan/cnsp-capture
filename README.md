# cnsp-capture

Mobile-first PWA for capturing supplement-stack photos into a structured folder tree, exported as a zip for laptop-side post-processing (UPC decoding, OCR, alignment into PVN).

**Live:** <https://dochogan.github.io/cnsp-capture/>

See [docs/RPD.md](docs/RPD.md) for full requirements.

## Install

On the target device (Galaxy Z Fold 3, Chrome Android), open the live URL, tap the install prompt or Chrome menu → **Add to Home screen**. Launches fullscreen, portrait-locked for capture.

## Flow

1. **Home** — list of sessions. Start new, resume last, export or delete existing.
2. **Session** — list of series captured in this session. Start new series, end session, export entire session as zip.
3. **Series** — live camera + shutter. Torch, pinch-zoom, tap-to-focus. Thumbnail strip; tap a thumb to retake or delete. End series returns to Session screen.

All storage is OPFS (transient, origin-scoped). Zip export is the commit point — after zipping, data lives on the laptop.

## Hard requirements

- **HTTPS.** `getUserMedia` and OPFS both require a secure context on Android Chrome. Plain HTTP over a LAN IP will fail silently or block the camera prompt.
- **Local-only.** No backend. OPFS is transient working storage; zip export (M5) is the commit point. A user-initiated "Clear site data" wipes everything.
- **Target:** Chrome Android on the Galaxy Z Fold 3. Other browsers untested.

## Local dev (desktop, HTTP)

```
npm install
npm run dev
```

Opens at `http://localhost:5173`. OPFS works on localhost. `getUserMedia` on desktop Chrome will use the webcam — fine for smoke-testing the UI, but mobile quirks won't show.

## Dev on the Fold (HTTPS via Tailscale)

```
mkdir -p certs
tailscale cert --cert-file certs/cert.pem --key-file certs/key.pem blade15.dusky-kardashev.ts.net
npm run dev
```

Vite detects the certs and switches to HTTPS, binding `0.0.0.0:5173`. From the Fold, visit:

```
https://blade15.dusky-kardashev.ts.net:5173
```

`certs/` is gitignored.

## Scripts

- `npm run dev` — vite dev server
- `npm run build` — typecheck + production build
- `npm run typecheck` — tsc, no emit
- `npm run lint` — eslint
- `npm run format` — prettier write
