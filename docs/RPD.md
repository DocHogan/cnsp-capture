# RPD: CNSP Capture PWA

**Status**: Draft 1 — 2026-04-21
**Owner**: Doc
**Target platform**: Samsung Galaxy Z Fold 3, Chrome (Android)
**Related**: PVN/Projects/Comprehensive Nutritional Supplement Plan/

## Problem

Documenting the CNSP supplement stack requires multiple photos per product (main label, UPC, usage instructions, ingredient list, supplement-facts panel — roughly 4–6 per product across ~30+ products). Android's stock camera saves everything to a flat camera roll with sequential filenames; organizing after the fact is the bottleneck that has killed every prior attempt at this documentation task. The PVN vault needs photos organized by product, not by timestamp.

## Goal

A mobile PWA that lets a capture session produce a clean folder-tree of photos — one folder per product, grouped under a session folder — exportable as a single zip that can be unpacked into PVN with zero post-hoc renaming or sorting.

## Non-goals

- Replacing the stock camera for general photography
- Cloud sync, multi-device sync, or multi-user support
- Backend integration (Grist, PVN-direct, or otherwise)
- Product database / UPC lookup / nutrition data enrichment
- OCR on labels or ingredient lists
- Long-term storage in the app — OPFS is transient working storage; zip export is the commit point

## Users

One user: Doc, on the Fold, capturing a supplement stack in a single ~30-minute session roughly once per quarter (when the stack changes). Sessions may be interrupted and resumed.

## Constraints

- **HTTPS required** — `getUserMedia` and `BarcodeDetector` both require a secure context. Dev environment uses Tailscale certs on the Blade; production uses GitHub Pages.
- **OPFS only** — no File System Access API prompts (unreliable on mobile Chrome), no per-photo downloads (Android flattens folder structure in Downloads inconsistently).
- **No dependencies on native Android features beyond Chrome's web APIs** — keep it a pure PWA.
- **Storage budget** — OPFS has a per-origin quota (~6% of free disk on Android Chrome, typically >1GB available). A full session of ~200 photos at ~2MB each = ~400MB; well within budget but worth monitoring.
- **Offline-capable by virtue of being local-only** — once the PWA is loaded, capture does not require network. Service worker exists solely for install/caching, not for sync.

## Architecture

### Storage (OPFS)

Root directory tree inside OPFS:

```
sessions/
  session-{iso}/
    meta.json          # { id, createdAt, endedAt?, seriesCount, totalPhotos }
    {series-folder}/
      meta.json        # { id, upc?, name?, createdAt, endedAt?, shotCount }
      001.jpg
      002.jpg
      ...
```

Series folder naming is **timestamp-only in-app**. On start, every series gets `series-{hhmmss}`. `meta.json` carries `createdAt` / `endedAt` / `shotCount`. Product identification — UPC decoding, OCR, label lookup — happens **off-device after zip export**, using laptop-side tooling with more reliable decoders (`pyzbar`, `zxing-cpp`, ImageMagick preprocessing). The in-app name isn't meant to be final; the post-capture pipeline renames folders to their product-keyed canonical form before PVN alignment.

Rationale: Chrome Android's native `BarcodeDetector` underperforms on the target device (Samsung Galaxy Z Fold 3), and a JS fallback (`@zxing/browser`, ~200 KB) is unnecessary complexity for a feature that's going to be redone off-device anyway with better tools and batch control.

Photo naming: zero-padded sequential within series, `{NNN}.jpg`. Deleted photos leave gaps — the app does not renumber, because stable filenames matter more than dense numbering. (This is a deliberate choice; revisit if it becomes annoying in practice.)

### Camera pipeline

- `getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })`
- Preview rendered to a `<video>` element.
- Capture: draw the current video frame to an offscreen `<canvas>`, export as JPEG at quality 0.85, write blob to OPFS.
- Resolution cap at 1080p to keep file sizes reasonable; supplement labels are readable well below sensor-max resolution.

### Camera controls (M1.5)

All controls route through `MediaStreamTrack.applyConstraints({ advanced: [...] })`, gated by `track.getCapabilities()` support checks so unsupported features simply don't render.

- **Torch**: toggle button top-right of preview, visible only when `capabilities.torch === true`. Off on camera start. When torch is turned on, the app also applies `exposureCompensation: max(capMin, -1)` to counter close-range blowout; restores `0` when torch turns off. Silently no-ops if the device doesn't expose `exposureCompensation`.
- **Zoom**: pinch gesture on preview when `capabilities.zoom` is present. Current factor displayed top-left. Resets to `zoom.min` on camera restart.
- **Tap-to-focus**: single tap on preview when device supports `focusMode: 'single-shot'` and `pointsOfInterest`. Normalized `(x, y)` ∈ `[0, 1]²` mapped from tap location. Yellow ring indicator at tap point, ~700 ms.
- **Dual shutter buttons**: mirrored left + right in footer, identical behavior, for ambidextrous single-handed portrait operation. Status text sits between.
- Tap/pinch handlers ignore events targeting child `<button>` elements, so torch and shutter don't trigger focus/zoom.

### Identification (off-device)

No UPC decoding, OCR, or naming UI in the capture app. The capture app's job is just to produce clean, well-grouped JPGs. Post-processing happens on the laptop after zip import, where a dedicated script runs UPC decoding (`pyzbar` / `zxing-cpp`), OCR fallback on the label images (Tesseract or equivalent), and manual review-and-rename as the last resort, before the final folder tree lands in PVN.

Earlier iterations tried `BarcodeDetector` during capture; Chrome Android's implementation on the Fold produced no hits on held barcodes even after ~200 detection passes. Moving the work off-device gives us better decoders, batch preprocessing (contrast, deskew, rotation), and no in-capture friction.

### Export

- `fflate` zips the session folder tree to a Blob.
- Blob is handed to the browser via `<a download>` click, which triggers the standard download flow. On Android this lands in Downloads.
- Zip filename: `cnsp-session-{iso-date}.zip`.
- Post-export, session remains in OPFS (so the user can re-export or resume if something went wrong). Explicit "Delete session" button in session list handles cleanup.

### State management

React Context + `useReducer` for session state. OPFS is the source of truth; in-memory state is a cache rebuilt on mount from OPFS directory listing. No IndexedDB, no localStorage beyond a "last-used session ID" pointer so resumption is one tap.

## UX

### Screens

1. **Home** — "Start new session" button, list of existing sessions (date, series count, export/delete actions).
2. **Session** — header with session date, list of series (folder name + thumbnail strip + photo count), "Start series" primary button, "Export zip" secondary button, "End session" tertiary.
3. **Series capture** — fullscreen camera preview, shutter button, thumbnail strip of captured photos at bottom, "End series" button top-right. Thumbnail tap → photo modal with retake/delete.
4. **Scan overlay** (modal over Session before capture begins) — live preview with scan reticle, UPC detected banner, "Skip scan" button after 10s.

### Interaction rules

- All destructive actions (delete photo, delete session) require a single confirmation tap — no typed confirmation, but no one-tap deletion either.
- Retake replaces the current photo in place (same filename). Delete leaves a gap.
- Camera permission is requested on first "Start series" tap, not on app load, to avoid permission fatigue.
- Orientation lock: portrait only for the capture screen (supplement bottles are taller than wide).

## Risks / open questions

- **Samsung One UI camera quirks**: One UI sometimes imposes extra permission prompts on `getUserMedia`. Validate on the Fold before committing to the design.
- **BarcodeDetector coverage**: Shipping in Chrome Android for several versions, but worth a feature-detection fallback. If unavailable, fall back to "tap to capture UPC photo, enter manually" flow. Do not add a JS barcode library unless the fallback proves painful.
- **OPFS persistence across Chrome updates**: OPFS is persistent but not sacred — a user-initiated "Clear site data" wipes it. Since zip export is the commit point, this is acceptable. Document it in the README.
- **Fold form factor**: App should handle both folded (narrow) and unfolded (near-tablet) layouts. Portrait lock on capture screens simplifies this; the session/home views should use responsive layout and behave sensibly on the inner display.
- **Storage quota exhaustion mid-session**: Unlikely given budget math above, but add a quota check at session start (`navigator.storage.estimate()`) and warn if <500MB free.

## Success criteria

- A full supplement-stack capture session (~30 products × ~5 photos each) can be completed in one sitting on the Fold without app reload, without manual file renaming, and exports to a single zip whose contents unpack cleanly into PVN.
- Zero post-capture sorting required to match photos to products.
- Session can be interrupted (app backgrounded, phone locked, even Chrome killed) and resumed without data loss.

## Deployment

- **Dev**: Blade at `~/devspace/realworld/cnsp-capture/`, `vite dev --host`, served over Tailscale cert on `blade15.dusky-kardashev.ts.net:5173`. Fold accesses directly.
- **Prod**: GitHub Pages at `github.com/DocHogan/cnsp-capture`, deployed via `deploy.sh` pattern borrowed from CPNP. Installed to Fold home screen as a PWA via Chrome's "Add to Home screen" menu.

## Milestones

1. Scaffold + camera preview + single-shot capture to OPFS (smoke test).
1.5. Camera controls: torch, pinch zoom, tap-to-focus, dual shutter buttons.
2. Series folder creation + sequential photo writes + thumbnail strip + retake/delete modal.
3. Series naming stabilized as `series-{hhmmss}`; identification moved off-device.
4. Session management (create, list, resume, end).
5. Zip export via fflate.
6. PWA manifest, service worker for install, Fold-layout polish.
7. Deploy to GitHub Pages, install to Fold, capture a real session, revise.
