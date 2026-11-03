# Stillroom

A mobile-first, local photo editor built with **React + Vite + JavaScript + Tailwind CSS**.
The visual direction follows the approved Stillroom mobile mockup: warm paper, olive
accents, a large photo preview, quiet typography, and a horizontal preset strip.

Stillroom is a free, local alternative to a photo-editing subscription: 24 curated
looks and the fine-tuning tools normally gated behind one, with no account, no upload,
and no server.

## Run it

```bash
npm install
npm run dev
```

Open the local URL Vite prints. No account, API key, server upload, or backend is required.

```bash
npm run build
npm run preview
```

The production bundle is generated in `dist/`. It has not been deployed or published.

## What works

- Import a local JPG, PNG, WebP, or browser-supported AVIF; drag-and-drop also works.
- Preview the full photo without cropping, including portrait, square, and landscape aspect ratios.
- Hold the comparison button (or hold <kbd>Space</kbd>) to see the original.
- Choose from **24 presets**, tagged **Free** or **Pro** to mirror the tiers of a
  subscription editor — all unlocked locally. See `docs/filter-recipes.md`.
- Adjust intensity and 16 controls across four groups:
  - **Light** — exposure, contrast, highlights, shadows, whites, blacks.
  - **Color** — temperature, tint, saturation, vibrance.
  - **Effects** — clarity, sharpen, fade, grain, grain size, vignette.
  - **Grade** — split toning (shadow/highlight hue + strength) and HSL per channel.
- Crop with aspect ratios, 90° rotation, horizontal/vertical flip, fine-angle
  straighten, zoom, and pan.
- Undo/redo with grouped slider edits.
- Copy an edit and paste it onto another photo.
- Save any edit as a named preset, rename it, or delete it.
- Reset the selected look to its starting recipe.
- Export a new JPG (94% quality) or lossless PNG. JPG exports flatten transparent pixels against white.
- Choose Large or Web size. Large preserves the source dimensions up to a longest edge of
  **3200 px on phone/tablet-sized viewports** or **5000 px on desktop**; Web caps the
  longest edge at 2500 px. Smaller originals are never upscaled.
- The current session — photo, preset, adjustments, crop, and history — is restored
  on reload from `localStorage`.
- Responsive layout checked at 320, 375, 390, 768, and 1440 px widths.

All editing happens in this browser. No photo-processing API, analytics, external font
request, or image upload is used. The bundled starting portrait is a synthetic demo
from the approved filter study.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| <kbd>Ctrl/Cmd</kbd> + <kbd>Z</kbd> | Undo |
| <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo |
| <kbd>Ctrl/Cmd</kbd> + <kbd>S</kbd> | Open export |
| <kbd>Space</kbd> (hold) | Compare with original |
| <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> | Presets / Crop / Adjust |

## How the preset engine works

`src/filters.js` holds the preset library. Each look is an original Stillroom recipe —
not a copied third-party preset — mapped onto the canvas pipeline in
`src/image-processing.js`. Filter thumbnails use the same engine as the main preview,
generated one at a time so a large library never blocks the page.

The Adjust controls fine-tune the selected recipe. The difference from its starting
values is applied independently of preset intensity; lowering the preset strength does
not dilute a manual tweak. Selecting a different preset starts its recipe afresh.

Previews use a longest edge of 1500 px. Exports process short strips of pixels and yield
between strips, reducing temporary ImageData allocations and keeping progress responsive.
Clarity and sharpen run one whole-image blur pass before the strip loop, so previews and
exports agree and strips never show seams. Film grain is deterministic and has an
adjustable size. Grain, vignette, and HSL are computed in output-pixel space, so very
fine detail can look slightly different at different output resolutions.

## Saved data

The session and any saved presets live in `localStorage` (`stillroom.session.v1`,
`stillroom.presets.v1`). Because browsers cap local storage near 5 MB, photos above a
few megabytes restore their settings but not the image; re-import the file to continue
cropping or exporting it.

## Tests

```bash
npm test
```

Run the dev server first. Tests use system Chromium when available; otherwise install the
Playwright browser with `npx playwright install chromium`. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a specific Chromium installation.

The suite covers all 24 preset selections, intensity, pointer and keyboard comparison,
every adjustment's pixel effect, split tone and HSL grading, crop ratios, zoom/pan,
rotation, straighten, flip, undo/redo, saved presets, copy/paste, session restore,
keyboard shortcuts, local import and aspect ratio, valid JPG/PNG downloads, invalid-image
errors, dialog keyboard dismissal, and responsive overflow. Screenshots and export
samples are written to `artifacts/`.

## Current limits / not implemented

- No batch editing, multi-photo library, or user accounts.
- No RAW/HEIC decoder. Convert these to a supported format before import.
- No original EXIF/location metadata preservation, ICC-profile editing, or print-oriented
  color management; canvas exports are browser-rendered images.
- Opening another preset resets manual tweaks and grading.
- Source-photo decoding still depends on the browser's memory; very large imports can
  exceed an older phone's limits despite tiled export processing.
- Automated checks use Chromium and simulated phone viewports, not physical iOS/Android
  devices or a full Safari/Firefox compatibility pass.

## Files

- `src/App.jsx` — editor state, interactions, shortcuts, and persistence
- `src/image-processing.js` — local color/tone engine, crop geometry, and tiled export
- `src/filters.js` — preset library, adjustment, split-tone, and HSL definitions
- `src/storage.js` — localStorage session and saved-preset persistence
- `src/index.css` — responsive styling and Tailwind integration
- `docs/filter-recipes.md` — preset and tool reference
- `tests/` — browser and image-engine regression checks

No Git commit or push has been made for this project.
