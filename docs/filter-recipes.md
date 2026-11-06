# Stillroom — preset & tool reference

Stillroom ships a **24-look preset library**, plus a neutral **Original** preset at the
start of the strip that applies no effect. The look codes (A6, M5, C1 …) mirror
the naming people recognise from VSCO so a familiar starting point is easy to
find. Every look is Stillroom's **own numeric recipe** running on its own canvas
pipeline — no third-party preset data is copied or reproduced.

## Library groups

The looks are organized in two groups — the split the subscription apps use —
but **everything is unlocked** and no badges are shown in the app. The grouping
is only a way to browse the reference below.

| Group | Looks |
| --- | --- |
| **Original** | Original (applies nothing) |
| **Free** | B1, B5, F2, G3, M3, M5, P5, T1, X1 |
| **Pro** | A4, A5, A6, C1, C2, C3, G6, HB1, HB2, AL1, AL3, SS1, WE4, KE1, KP1 |

## Free-group looks

| Code | Mood | Character |
| --- | --- | --- |
| B1 | Muted black & white · gentle contrast | Desaturated with a light fade and fine grain. |
| B5 | High-contrast black & white | Deeper blacks, held highlights, more grain. |
| F2 | Cool and faded · soft shadows | Cool cast, lifted shadows, gentle fade. |
| G3 | Warm with lifted shadows | Warm tint with quiet greens and a soft fade. |
| M3 | Soft and muted · quiet color | Low saturation with creamy highlights. |
| M5 | Bright golden · the popular one | Brighter exposure, warm, restrained color. |
| P5 | Warm vintage · amber shadows | Amber split-toned shadows and a visible fade. |
| T1 | Moody fade · cool shadows | Slightly underexposed, cool blue shadows. |
| X1 | Punchy warm · crisp detail | Strong contrast with warm, vivid color. |

## Pro-group looks

| Code | Mood | Character |
| --- | --- | --- |
| A4 | Clean neutral · balanced skin | Balanced contrast, near-neutral colour. |
| A5 | Warm vintage · creamy highlights | Warm highlights via split toning. |
| A6 | Editorial warm · rich midtones | Warm midtones, protected highlights. |
| C1 | Vibrant warm · saturated color | Higher contrast and saturation. |
| C2 | Cool vibrant · clean blues | Cool cast with clean blues. |
| C3 | Deep punch · dense shadows | Strong contrast with crushed blacks. |
| G6 | Rich warm · film shadows | Warm with amber shadow toning. |
| HB1 | Clean muted · even light | Restrained saturation, even light. |
| HB2 | Cool clean · restrained color | Cool, clean, low saturation. |
| AL1 | Warm editorial · soft contrast | Warm editorial with a soft fade. |
| AL3 | Golden film · glowing light | Golden highlights and coarse grain. |
| SS1 | Creamy moody · soft falloff | Soft contrast and a creamy fade. |
| WE4 | Soft matte · lifted blacks | Matte look with cool-toned shadows. |
| KE1 | Faded film · coarse grain | Heavy fade with large grain. |
| KP1 | Retro warm · soft amber | Warm retro with amber shadows. |

## Scale of the recipe values

| Control | Range | Unit |
| --- | --- | --- |
| Exposure | −1 … +1 | EV |
| Temp, Tint, Contrast, Saturation | −100 … +100 | — |
| Highlights, Shadows, Whites, Blacks | −100 … +100 | — |
| Clarity, Sharpen, Fade, Grain, Grain size | 0 … 100 | — |
| Vignette | −100 … +100 | — |
| Split-tone strength | 0 … 100 | — |
| Split-tone hue | 0 … 359 | degrees |

A preset is only a **starting point**. Intensity scales the preset from 0–100%;
manual tweaks are applied on top at full strength, so dialling a preset down
never dilutes a correction you made by hand.

## Editing tools

- **Presets** — Original plus 24 built-in looks plus any you save yourself,
  docked at the bottom of the screen with live thumbnails. Original applies
  nothing and starts every manual adjustment from zero.
- **Intensity** — one slider for the selected look, always visible in the dock.
- **Compare** — press and hold the photo (or hold <kbd>Space</kbd>) to see the
  untouched original until release.
- **Crop** — aspect ratios, rotate 90°, horizontal/vertical flip, fine-angle
  straighten (the frame auto-shrinks so no empty corners appear), zoom by
  slider or two-finger pinch, and one-finger pan.
- **Adjust** — nine sliders in one flat panel: exposure, contrast, temperature,
  tint, saturation, sharpen, fade, grain, vignette. The engine keeps the deeper
  recipe keys (whites, blacks, highlights, shadows, vibrance, clarity, split
  toning, grain size, per-channel HSL) for the preset library and for restoring
  saved sessions; they are not exposed as editor controls.
- **Save look** — store your current recipe as a reusable preset.

## Notes

- Saved looks and the current session live in this browser's `localStorage`.
  Large imports restore their settings but not the photo itself, because browsers
  cap local storage near 5 MB.
- Clarity and sharpen use a whole-image blur pass, so previews and exports always
  agree and tiled export never shows seams.
- Grain is deterministic: the same edit exports identically every time.
