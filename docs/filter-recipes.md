# Stillroom — preset & tool reference

Stillroom ships **39 looks in 8 collections**, plus a neutral **Original** preset
at the start of the strip that applies no effect. The look codes (A6, M5, C1 …)
mirror the naming people recognise from VSCO so a familiar starting point is
easy to find. Every look is Stillroom's **own numeric recipe** running on its
own canvas pipeline — no third-party preset data is copied or reproduced.

The preset strip shows the collections as small labeled groups (Original, Film,
Cinema, Golden, Moody, Airy, Vivid, Retro, Mono; saved looks get their own
group), so browsing jumps between clearly distinct styles instead of variations
on one look.

## Collections at a glance

| Collection | Looks | Identity |
| --- | --- | --- |
| **Original** | Original | Applies nothing; manual tweaks start from zero |
| **Film** | A6, M5, AL3, F2, HB1, KE1 | Quiet analog character for everyday shooting |
| **Cinema** | CN1–CN6 | Graded, dramatic, movie-poster color (teal & orange, bleach bypass, nightfall, thriller green, cold noir, warm cinema) |
| **Golden** | G1–G5 | Built for sunlight, sunset, and dusk |
| **Moody** | T1, SS1, D1–D3 | Darker, desaturated, atmospheric |
| **Airy** | L1–L3, WE4 | Bright, lifted, clean, matte |
| **Vivid** | C1, C2, V1, V2 | Saturated and punchy |
| **Retro** | KP1, P5, R1–R3 | Expired-film warmth, cross-processing, polar fade |
| **Mono** | B1, B5, B7, B9 | Black & white from gentle to hard, matte to grainy |

## Look reference

| Code | Collection | Mood | Character |
| --- | --- | --- | --- |
| A6 | Film | Editorial warm · rich midtones | Warm midtones, protected highlights, amber shadow toning. |
| M5 | Film | Bright golden · the popular one | Brighter exposure, warm, restrained color. |
| AL3 | Film | Golden film · glowing light | Golden highlights and coarse grain. |
| F2 | Film | Cool faded · soft shadows | Cool cast, lifted shadows, gentle fade. |
| HB1 | Film | Clean muted · even light | Restrained saturation, even light. |
| KE1 | Film | Faded film · coarse grain | Heavy fade with large grain. |
| CN1 | Cinema | Teal & orange · the blockbuster grade | Warm skin and highlights against teal shadows. |
| CN2 | Cinema | Bleach bypass · washed silver | High contrast, heavily desaturated, gritty. |
| CN3 | Cinema | Nightfall · day turned to night | Deep exposure cut, cold blue shadows, strong vignette. |
| CN4 | Cinema | Thriller green · uneasy shadows | Desaturated with a green cast in the shadows. |
| CN5 | Cinema | Cold noir · steel and silence | Cold, dense, low color. |
| CN6 | Cinema | Warm cinema · amber over teal | Amber highlights balanced by cool shadows. |
| G1 | Golden | Golden glow · endless summer | Warm glow with lifted shadows. |
| G2 | Golden | Sunset amber · low warm sun | Strong amber highlights, gentle vignette. |
| G3 | Golden | Warm lift · soft golden shadows | Warm tint with quiet color and lifted shadows. |
| G4 | Golden | Honey soft · gentle warmth | Soft warm matte, easy on skin. |
| G5 | Golden | Dusk gold · the last warm light | Underexposed warmth with golden highlights. |
| T1 | Moody | Moody fade · cool shadows | Slightly underexposed, cool blue shadows. |
| SS1 | Moody | Creamy moody · soft falloff | Soft contrast and a creamy fade. |
| D1 | Moody | Dark fog · muted and misty | Dark, flat, quiet greens. |
| D2 | Moody | Forest deep · green and heavy | Heavy green shadows, crushed blacks. |
| D3 | Moody | Storm · grey with weight | Cold grey, dense shadows, vignette. |
| L1 | Airy | Airy portrait · soft high key | Lifted shadows and whites, pastel color. |
| L2 | Airy | Pastel wash · light and pink | Bright with a soft magenta cast. |
| L3 | Airy | Clean daylight · crisp and neutral | Neutral brightness with light sharpening. |
| WE4 | Airy | Soft matte · lifted blacks | Matte look with cool-toned shadows. |
| C1 | Vivid | Vibrant warm · saturated color | Higher contrast and saturation. |
| C2 | Vivid | Cool vibrant · clean blues | Cool cast with clean blues. |
| V1 | Vivid | Pop · maximum color | Saturation, vibrance, and contrast together. |
| V2 | Vivid | Punch · loud reds and blues | Selective per-channel saturation boost. |
| KP1 | Retro | Retro warm · soft amber | Warm retro with amber shadows. |
| P5 | Retro | Warm vintage · amber shadows | Amber split-toned shadows and a visible fade. |
| R1 | Retro | Cross-process · green and magenta | Green shadows, magenta highlights, heavy fade. |
| R2 | Retro | Disco 70s · orange haze and coarse grain | Orange haze, big grain, vignette. |
| R3 | Retro | Polar fade · washed and cyan | Faded low contrast with cyan shadows. |
| B1 | Mono | Muted mono · gentle contrast | Desaturated with a light fade and fine grain. |
| B5 | Mono | Hard mono · high contrast | Deeper blacks, held highlights, more grain. |
| B7 | Mono | Grain mono · classic film stock | Balanced contrast with prominent grain. |
| B9 | Mono | Matte mono · soft blacks | Faded matte black & white. |

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
| Per-channel HSL (authored per look) | −100 … +100 | — |

A preset is only a **starting point**. Intensity scales the preset from 0–100% —
including the split-toning and authored HSL grading, so intensity 0 always
returns the untouched photo. Manual tweaks are applied on top at full strength,
so dialling a preset down never dilutes a correction you made by hand.

## Editing tools

- **Presets** — Original plus 39 built-in looks plus any you save yourself,
  docked at the bottom of the screen as labeled collections with live
  thumbnails. Original applies nothing and starts every manual adjustment
  from zero.
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
