# Stillroom

A mobile-first, local photo editor built with **React + Vite + JavaScript + Tailwind CSS**. The visual direction follows the approved Stillroom mobile mockup: warm paper, olive accents, a large photo preview, quiet typography, and a horizontal signature-filter strip.

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

## Working in this version

- Import a local JPG, PNG, WebP, or browser-supported AVIF; drag-and-drop also works.
- Preview the full photo without cropping, including portrait, square, and landscape aspect ratios.
- Hold the comparison button to see the original. Keyboard users can hold Space or Enter on it.
- Select the eight original looks: Linen Veil, Greenroom, Apricot Glass, Blue Hour, Soft Current, 4:16 PM, Red Ledger, and Rose Dust.
- Adjust filter intensity and nine basic controls: exposure, temperature, tint, contrast, saturation, highlights, shadows, fade, and grain.
- Reset the selected look to its starting recipe.
- Export a new JPG (94% quality) or lossless PNG. JPG exports flatten transparent pixels against white.
- Choose Large or Web size. Large preserves the source dimensions up to a longest edge of **3200 px on phone/tablet-sized viewports** or **5000 px on desktop**; Web caps the longest edge at 2500 px. Smaller originals are never upscaled.
- Responsive layout checked at 320, 375, 390, 768, and 1440 px widths.

All editing happens in this browser. No photo-processing API, analytics, external font request, or image upload is used. The bundled starting portrait is a synthetic demo from the approved filter study.

## How the filter engine works

`src/filters.js` contains the approved starting recipes. They are original Stillroom looks, not copied VSCO presets. The app maps those numeric recipes to its own canvas-based tonal/color pipeline. Filter thumbnails use the same engine as the main preview.

The Adjust controls fine-tune the selected recipe. The difference from its starting values is applied independently of filter intensity; lowering the preset strength does not dilute a manual tweak. Selecting a different filter starts its recipe afresh.

Previews use a longest edge of 1500 px. Exports process short strips of pixels and yield between strips, reducing temporary ImageData allocations and keeping progress responsive. Film grain is deterministic. Preview and export use the same processing math; fine grain can appear slightly different at different output resolutions.

## Tests

```bash
npm test
```

Run the dev server first. Tests use system Chromium when available; otherwise install the Playwright browser with `npx playwright install chromium`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use a specific Chromium installation.

The suite covers all eight filter selections, intensity, pointer comparison, adjustments/reset, every basic control's pixel effect, independent manual tweaks, tiled/synchronous renderer consistency, local import and aspect ratio, valid JPG/PNG downloads, invalid-image errors, keyboard dismissal, and responsive overflow. Screenshots and export samples are written to `artifacts/`.

## Current limits / not implemented

- No crop/rotate, undo/redo timeline, batch editing, saved sessions, or user accounts yet.
- No RAW/HEIC decoder. Convert these to a supported format before import.
- No original EXIF/location metadata preservation, ICC-profile editing, or print-oriented color management; canvas exports are browser-rendered images.
- Opening another filter resets manual tweaks, and reloading the page clears the session.
- Source-photo decoding still depends on the browser's memory; very large imports can exceed an older phone's limits despite tiled export processing.
- Automated checks use Chromium and simulated phone viewports, not physical iOS/Android devices or a full Safari/Firefox compatibility pass.

## Files

- `src/App.jsx` — editor state and interactions
- `src/image-processing.js` — local color/tone engine and tiled export
- `src/filters.js` — original recipes and adjustment definitions
- `src/index.css` — responsive styling and Tailwind integration
- `docs/filter-recipes.md` — supplied recipe reference
- `tests/` — browser and image-engine regression checks

No Git commit or push has been made for this project.
