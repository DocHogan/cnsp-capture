# cnsp-capture

Mobile-first PWA for capturing supplement-stack photos into a structured folder tree for PVN.

See [docs/RPD.md](docs/RPD.md) for full requirements.

## Status: M1 — smoke test

Camera preview + single-shot capture to OPFS. No sessions, no UPC, no export yet. Capture writes to `/smoke-test/NNN.jpg` in OPFS; reload the page to verify persistence via the directory listing in the UI.

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
