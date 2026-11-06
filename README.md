# Stillroom

A mobile-first, local photo editor built with **React + Vite + JavaScript**.
The visual direction follows the approved Stillroom mobile mockup: warm paper,
olive accents, a large photo preview, quiet typography, and a horizontal preset
strip docked at the bottom of the viewport — the layout phone editors are used
to, with no page scrolling while you edit.

Stillroom is a free, local alternative to a photo-editing subscription: 24
curated looks plus a neutral Original preset and the fine-tuning tools that
matter, with no account, no upload, and no server.

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
- **Docked editing layout**: the photo stays pinned on top and every tool lives in
  the panel below — presets, intensity, crop, and adjustments are always reachable
  without scrolling, on phones and desktop alike.
- Press-and-hold the photo (or hold <kbd>Space</kbd>) to see the original.
- Choose from **24 looks plus an Original preset**. See `docs/filter-recipes.md`
  for the library reference.
- One **intensity slider** for the selected look, always visible in the dock.
- Nine fine-tuning controls in a single flat panel: exposure, contrast,
  temperature, tint, saturation, sharpen, fade, grain, and vignette. Deeper
  controls (whites, blacks, split toning, grain size) exist only inside the
  preset recipes, where the engine uses them to build each look.
- Crop with aspect ratios, 90° rotation, horizontal/vertical flip, fine-angle
  straighten, zoom (slider or two-finger pinch), and one-finger pan.
- Undo/redo with grouped slider edits.
- Save any edit as a named preset, rename it, or delete it.
- Reset the selected look to its starting recipe.
- Export a new JPG (94% quality) or lossless PNG. JPG exports flatten transparent
  pixels against white.
- Choose Large or Web size. Large preserves the source dimensions up to a longest
  edge of **3200 px on phone/tablet-sized viewports** or **5000 px on desktop**;
  Web caps the longest edge at 2500 px. Smaller originals are never upscaled.
- The current session — photo, preset, adjustments, crop, and history — is
  restored on reload from `localStorage`.
- Installable as a home-screen app (manifest, icons, theme color).
- Responsive layout checked at 320, 375, 390, 768, and 1440 px widths.

All editing happens in this browser. No photo-processing API, analytics, external
font request, or image upload is used. The bundled demo photo (development builds
only) was provided by the project author.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| <kbd>Ctrl/Cmd</kbd> + <kbd>Z</kbd> | Undo |
| <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo |
| <kbd>Ctrl/Cmd</kbd> + <kbd>S</kbd> | Open export |
| <kbd>Space</kbd> (hold) | Compare with original |
| <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> | Presets / Crop / Adjust |

## How the preset engine works

`src/filters.js` holds the preset library. Each look is an original Stillroom
recipe — not a copied third-party preset — mapped onto the canvas pipeline in
`src/image-processing.js`. Filter thumbnails use the same engine as the main
preview, generated one at a time (and debounced behind crop gestures) so a large
library never blocks the page.

The Adjust controls fine-tune the selected recipe. The difference from its
starting values is applied independently of preset intensity; lowering the
preset strength does not dilute a manual tweak. Selecting a different preset
starts its recipe afresh.

Previews use a longest edge of 1500 px. The unfiltered framing canvas only
re-renders when the photo or crop changes, so slider drags never redraw it.
Exports process short strips of pixels and yield between strips, reducing
temporary ImageData allocations and keeping progress responsive. Clarity and
sharpen run one whole-image blur pass before the strip loop, so previews and
exports agree and strips never show seams. Film grain is deterministic and has
an adjustable size inside recipes. Grain, vignette, and HSL are computed in
output-pixel space, so very fine detail can look slightly different at different
output resolutions.

## Saved data

The session and any saved presets live in `localStorage` (`stillroom.session.v1`,
`stillroom.presets.v1`). Because browsers cap local storage near 5 MB, photos
above a few megabytes restore their settings but not the image; re-import the
file to continue cropping or exporting it.

## Tests

```bash
npm test
```

Run the dev server first. Tests use system Chromium when available; otherwise
install the Playwright browser with `npx playwright install chromium`. Set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a specific Chromium installation.

The suite covers all 25 preset selections, intensity, press-and-hold and
keyboard comparison, every adjustment's pixel effect, crop ratios, pinch/pan,
zoom/pan, rotation, straighten, flip, undo/redo, saved presets, session restore,
the docked layout at every breakpoint, keyboard shortcuts, local import and
aspect ratio, valid JPG/PNG downloads, invalid-image errors, dialog keyboard
dismissal, and responsive overflow. Screenshots and export samples are written
to `artifacts/`.

## Current limits / not implemented

- No batch editing, multi-photo library, or user accounts.
- No RAW/HEIC decoder. Convert these to a supported format before import.
- No original EXIF/location metadata preservation, ICC-profile editing, or
  print-oriented color management; canvas exports are browser-rendered images.
- Opening another preset resets manual tweaks and grading.
- Source-photo decoding still depends on the browser's memory; very large
  imports can exceed an older phone's limits despite tiled export processing.
- Automated checks use Chromium and simulated phone viewports, not physical
  iOS/Android devices or a full Safari/Firefox compatibility pass.

## Files

- `src/App.jsx` — editor state, docked layout, interactions, shortcuts, persistence
- `src/image-processing.js` — local color/tone engine, crop geometry, tiled export
- `src/filters.js` — preset library and the user-facing adjustment definitions
- `src/storage.js` — localStorage session and saved-preset persistence
- `src/index.css` — docked shell, tool panels, and design tokens
- `docs/filter-recipes.md` — preset and tool reference
- `tests/` — browser and image-engine regression checks
