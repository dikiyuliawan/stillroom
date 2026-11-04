// Stillroom preset library.
//
// The look codes (A6, M5, C1 …) mirror the naming people recognise from VSCO so
// a familiar starting point is easy to find. Every look here is Stillroom's own
// numeric recipe mapped onto its own canvas pipeline — no third-party preset
// data is copied. The `free` / `pro` tiers mirror which looks VSCO gives away
// versus which sit behind a subscription; in this app every look is unlocked
// because the editing never leaves the device.

// Every preset carries the full recipe so switching looks never leaves a stale
// slider behind. Anything omitted falls back to neutral.
const recipe = (overrides) => ({
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temp: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  vibrance: 0,
  clarity: 0,
  sharpen: 0,
  fade: 0,
  grain: 0,
  grainSize: 0,
  vignette: 0,
  splitShadowHue: 0,
  splitShadowStrength: 0,
  splitHighlightHue: 0,
  splitHighlightStrength: 0,
  ...overrides,
})

export const PRESET_TIERS = {
  free: 'Free',
  pro: 'Pro',
  original: 'Original',
}

// The neutral preset at the start of the strip: no filter effect, so the
// photo shows exactly as imported (before any manual tweaks).
export const ORIGINAL = {
  id: 'original',
  code: 'Original',
  name: 'Original',
  mood: 'No filter · the photo as imported',
  tier: 'original',
  swatch: '#e6e4dc',
  recipe: recipe({}),
}

// The 24 looks (no Original), kept separate for engine tests.
export const LOOKS = [
  // ── Free tier ────────────────────────────────────────────────────────────
  {
    id: 'b1',
    code: 'B1',
    name: 'B1',
    mood: 'Muted black & white · gentle contrast',
    tier: 'free',
    swatch: '#c9c7c0',
    recipe: recipe({ saturation: -100, contrast: 8, exposure: 0.02, fade: 6, grain: 14 }),
  },
  {
    id: 'b5',
    code: 'B5',
    name: 'B5',
    mood: 'High-contrast black & white',
    tier: 'free',
    swatch: '#9b9a96',
    recipe: recipe({ saturation: -100, contrast: 28, highlights: -12, shadows: -8, grain: 18 }),
  },
  {
    id: 'f2',
    code: 'F2',
    name: 'F2',
    mood: 'Cool and faded · soft shadows',
    tier: 'free',
    swatch: '#b9c6c8',
    recipe: recipe({ temp: -6, contrast: -6, saturation: -12, shadows: 12, fade: 12, grain: 12 }),
  },
  {
    id: 'g3',
    code: 'G3',
    name: 'G3',
    mood: 'Warm with lifted shadows',
    tier: 'free',
    swatch: '#c9bd9d',
    recipe: recipe({ temp: 6, contrast: -4, saturation: -10, shadows: 14, fade: 9, grain: 15 }),
  },
  {
    id: 'm3',
    code: 'M3',
    name: 'M3',
    mood: 'Soft and muted · quiet color',
    tier: 'free',
    swatch: '#c4bfae',
    recipe: recipe({ exposure: 0.05, contrast: -10, saturation: -16, highlights: -8, shadows: 10, fade: 8, grain: 10 }),
  },
  {
    id: 'm5',
    code: 'M5',
    name: 'M5',
    mood: 'Bright golden · the popular one',
    tier: 'free',
    swatch: '#dcc39a',
    recipe: recipe({ exposure: 0.15, temp: 10, contrast: -4, saturation: -6, highlights: -12, shadows: 8, fade: 5, grain: 12 }),
  },
  {
    id: 'p5',
    code: 'P5',
    name: 'P5',
    mood: 'Warm vintage · amber shadows',
    tier: 'free',
    swatch: '#d0a97f',
    recipe: recipe({
      temp: 8,
      tint: 3,
      contrast: -2,
      saturation: -8,
      fade: 14,
      grain: 16,
      splitShadowHue: 30,
      splitShadowStrength: 18,
    }),
  },
  {
    id: 't1',
    code: 'T1',
    name: 'T1',
    mood: 'Moody fade · cool shadows',
    tier: 'free',
    swatch: '#8f9a9c',
    recipe: recipe({
      exposure: -0.06,
      contrast: 6,
      saturation: -18,
      temp: -3,
      shadows: 6,
      highlights: -10,
      fade: 16,
      grain: 20,
      splitShadowHue: 220,
      splitShadowStrength: 20,
    }),
  },
  {
    id: 'x1',
    code: 'X1',
    name: 'X1',
    mood: 'Punchy warm · crisp detail',
    tier: 'free',
    swatch: '#c8a06f',
    recipe: recipe({ exposure: 0.04, contrast: 16, saturation: 8, temp: 7, highlights: -10, grain: 10 }),
  },

  // ── Pro tier (subscription looks) ────────────────────────────────────────
  {
    id: 'a4',
    code: 'A4',
    name: 'A4',
    mood: 'Clean neutral · balanced skin',
    tier: 'pro',
    swatch: '#cdc2ac',
    recipe: recipe({ contrast: 6, saturation: -4, temp: 2, highlights: -8, shadows: 6, grain: 6 }),
  },
  {
    id: 'a5',
    code: 'A5',
    name: 'A5',
    mood: 'Warm vintage · creamy highlights',
    tier: 'pro',
    swatch: '#d6bd96',
    recipe: recipe({
      temp: 9,
      contrast: 2,
      saturation: -8,
      highlights: -14,
      shadows: 8,
      fade: 8,
      grain: 12,
      splitHighlightHue: 38,
      splitHighlightStrength: 14,
    }),
  },
  {
    id: 'a6',
    code: 'A6',
    name: 'A6',
    mood: 'Editorial warm · rich midtones',
    tier: 'pro',
    swatch: '#c9a878',
    recipe: recipe({
      exposure: 0.06,
      temp: 10,
      contrast: 8,
      saturation: -6,
      highlights: -16,
      shadows: 5,
      fade: 6,
      grain: 14,
      splitShadowHue: 25,
      splitShadowStrength: 16,
    }),
  },
  {
    id: 'c1',
    code: 'C1',
    name: 'C1',
    mood: 'Vibrant warm · saturated color',
    tier: 'pro',
    swatch: '#c98f6a',
    recipe: recipe({ contrast: 14, saturation: 14, temp: 5, highlights: -8, grain: 8 }),
  },
  {
    id: 'c2',
    code: 'C2',
    name: 'C2',
    mood: 'Cool vibrant · clean blues',
    tier: 'pro',
    swatch: '#93aebd',
    recipe: recipe({ contrast: 16, saturation: 10, temp: -6, tint: 2, highlights: -10, grain: 10 }),
  },
  {
    id: 'c3',
    code: 'C3',
    name: 'C3',
    mood: 'Deep punch · dense shadows',
    tier: 'pro',
    swatch: '#a08a7d',
    recipe: recipe({ contrast: 22, saturation: 6, temp: -2, blacks: -12, grain: 12 }),
  },
  {
    id: 'g6',
    code: 'G6',
    name: 'G6',
    mood: 'Rich warm · film shadows',
    tier: 'pro',
    swatch: '#bfa583',
    recipe: recipe({
      temp: 7,
      contrast: 10,
      saturation: -4,
      shadows: 8,
      highlights: -12,
      grain: 14,
      splitShadowHue: 30,
      splitShadowStrength: 20,
    }),
  },
  {
    id: 'hb1',
    code: 'HB1',
    name: 'HB1',
    mood: 'Clean muted · even light',
    tier: 'pro',
    swatch: '#c6c0b0',
    recipe: recipe({ saturation: -14, contrast: 4, temp: 2, highlights: -8, fade: 6, grain: 8 }),
  },
  {
    id: 'hb2',
    code: 'HB2',
    name: 'HB2',
    mood: 'Cool clean · restrained color',
    tier: 'pro',
    swatch: '#b3bcc0',
    recipe: recipe({ saturation: -10, contrast: 6, temp: -5, highlights: -10, fade: 4, grain: 8 }),
  },
  {
    id: 'al1',
    code: 'AL1',
    name: 'AL1',
    mood: 'Warm editorial · soft contrast',
    tier: 'pro',
    swatch: '#c8b393',
    recipe: recipe({ temp: 8, contrast: 6, saturation: -6, highlights: -10, shadows: 8, fade: 8, grain: 14 }),
  },
  {
    id: 'al3',
    code: 'AL3',
    name: 'AL3',
    mood: 'Golden film · glowing light',
    tier: 'pro',
    swatch: '#d9b57f',
    recipe: recipe({
      exposure: 0.08,
      temp: 12,
      tint: 3,
      contrast: 2,
      saturation: -4,
      highlights: -16,
      fade: 10,
      grain: 18,
      splitHighlightHue: 42,
      splitHighlightStrength: 20,
    }),
  },
  {
    id: 'ss1',
    code: 'SS1',
    name: 'SS1',
    mood: 'Creamy moody · soft falloff',
    tier: 'pro',
    swatch: '#cbbba8',
    recipe: recipe({
      exposure: 0.02,
      contrast: -8,
      saturation: -12,
      temp: 4,
      highlights: -10,
      shadows: 12,
      fade: 12,
      grain: 16,
    }),
  },
  {
    id: 'we4',
    code: 'WE4',
    name: 'WE4',
    mood: 'Soft matte · lifted blacks',
    tier: 'pro',
    swatch: '#b9b7ab',
    recipe: recipe({
      contrast: -12,
      saturation: -14,
      fade: 14,
      shadows: 14,
      grain: 18,
      splitShadowHue: 200,
      splitShadowStrength: 14,
    }),
  },
  {
    id: 'ke1',
    code: 'KE1',
    name: 'KE1',
    mood: 'Faded film · coarse grain',
    tier: 'pro',
    swatch: '#b5ac9c',
    recipe: recipe({ contrast: -6, saturation: -16, temp: 3, fade: 18, grain: 22, grainSize: 40 }),
  },
  {
    id: 'kp1',
    code: 'KP1',
    name: 'KP1',
    mood: 'Retro warm · soft amber',
    tier: 'pro',
    swatch: '#cfa87d',
    recipe: recipe({
      exposure: 0.05,
      temp: 11,
      tint: 4,
      contrast: -2,
      saturation: -10,
      fade: 16,
      grain: 20,
      splitShadowHue: 28,
      splitShadowStrength: 22,
    }),
  },
]

export const FILTERS = [ORIGINAL, ...LOOKS]

const signed = (value) => `${value > 0 ? '+' : ''}${value}`

export const ADJUSTMENT_GROUPS = [
  { id: 'light', label: 'Light' },
  { id: 'color', label: 'Color' },
  { id: 'effects', label: 'Effects' },
]

export const ADJUSTMENTS = [
  { key: 'exposure', label: 'Exposure', group: 'light', min: -1, max: 1, step: 0.01, display: (n) => `${n > 0 ? '+' : ''}${n.toFixed(2)} EV` },
  { key: 'contrast', label: 'Contrast', group: 'light', min: -100, max: 100, step: 1, display: signed },
  { key: 'highlights', label: 'Highlights', group: 'light', min: -100, max: 100, step: 1, display: signed },
  { key: 'shadows', label: 'Shadows', group: 'light', min: -100, max: 100, step: 1, display: signed },
  { key: 'whites', label: 'Whites', group: 'light', min: -100, max: 100, step: 1, display: signed },
  { key: 'blacks', label: 'Blacks', group: 'light', min: -100, max: 100, step: 1, display: signed },
  { key: 'temp', label: 'Temperature', group: 'color', min: -100, max: 100, step: 1, display: signed },
  { key: 'tint', label: 'Tint', group: 'color', min: -100, max: 100, step: 1, display: signed },
  { key: 'saturation', label: 'Saturation', group: 'color', min: -100, max: 100, step: 1, display: signed },
  { key: 'vibrance', label: 'Vibrance', group: 'color', min: -100, max: 100, step: 1, display: signed },
  { key: 'clarity', label: 'Clarity', group: 'effects', min: 0, max: 100, step: 1, display: (n) => `${n}` },
  { key: 'sharpen', label: 'Sharpen', group: 'effects', min: 0, max: 100, step: 1, display: (n) => `${n}` },
  { key: 'fade', label: 'Fade', group: 'effects', min: 0, max: 100, step: 1, display: (n) => `${n}` },
  { key: 'grain', label: 'Grain', group: 'effects', min: 0, max: 100, step: 1, display: (n) => `${n}` },
  { key: 'grainSize', label: 'Grain size', group: 'effects', min: 0, max: 100, step: 1, display: (n) => `${n}` },
  { key: 'vignette', label: 'Vignette', group: 'effects', min: -100, max: 100, step: 1, display: signed },
]

export const SPLIT_TONE_CONTROLS = [
  { key: 'splitShadowStrength', label: 'Shadow tone', hueKey: 'splitShadowHue', min: 0, max: 100, step: 1, display: (n) => `${n}` },
  { key: 'splitHighlightStrength', label: 'Highlight tone', hueKey: 'splitHighlightHue', min: 0, max: 100, step: 1, display: (n) => `${n}` },
]

export const HSL_CHANNELS = [
  { id: 'red', label: 'Red', hue: 0, swatch: '#c46a63' },
  { id: 'orange', label: 'Orange', hue: 30, swatch: '#c9965c' },
  { id: 'yellow', label: 'Yellow', hue: 60, swatch: '#c3b45c' },
  { id: 'green', label: 'Green', hue: 120, swatch: '#6f9c6a' },
  { id: 'blue', label: 'Blue', hue: 240, swatch: '#6384ad' },
  { id: 'purple', label: 'Purple', hue: 300, swatch: '#8f6fa6' },
]

export const HSL_CONTROLS = [
  { key: 'h', label: 'Hue', min: -100, max: 100, step: 1 },
  { key: 's', label: 'Saturation', min: -100, max: 100, step: 1 },
  { key: 'l', label: 'Luminance', min: -100, max: 100, step: 1 },
]

export const createHsl = () =>
  Object.fromEntries(HSL_CHANNELS.map((channel) => [channel.id, { h: 0, s: 0, l: 0 }]))

export const isHslNeutral = (hsl) =>
  !hsl ||
  HSL_CHANNELS.every((channel) => {
    const value = hsl[channel.id]
    return !value || (!value.h && !value.s && !value.l)
  })
