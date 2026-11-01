export const FILTERS = [
  {
    id: 'linen-veil', name: 'Linen Veil', mood: 'Soft neutral · creamy highlights',
    recipe: { exposure: 0.10, contrast: -12, saturation: -10, temp: 5, tint: 0, highlights: -8, shadows: 10, fade: 7, grain: 12 },
    swatch: 'linen', preview: 'sepia(.12) saturate(.86) brightness(1.035) contrast(.92)',
  },
  {
    id: 'greenroom', name: 'Greenroom', mood: 'Quiet greens · natural color',
    recipe: { exposure: 0.05, contrast: -8, saturation: -13, temp: -3, tint: -2, highlights: -8, shadows: 10, fade: 4, grain: 16 },
    swatch: 'green', preview: 'sepia(.06) hue-rotate(15deg) saturate(.78) brightness(1.02) contrast(.94)',
  },
  {
    id: 'apricot-glass', name: 'Apricot Glass', mood: 'Warm window light · soft skin',
    recipe: { exposure: 0.12, contrast: 3, saturation: -4, temp: 9, tint: 2, highlights: -13, shadows: 7, fade: 3, grain: 12 },
    swatch: 'apricot', preview: 'sepia(.2) saturate(1.02) brightness(1.04) contrast(1.02)',
  },
  {
    id: 'blue-hour', name: 'Blue Hour', mood: 'Blue-grey shade · held color',
    recipe: { exposure: -0.05, contrast: 12, saturation: -16, temp: -9, tint: 1, highlights: -12, shadows: 6, fade: 2, grain: 20 },
    swatch: 'blue', preview: 'hue-rotate(185deg) saturate(.76) brightness(.94) contrast(1.12)',
  },
  {
    id: 'soft-current', name: 'Soft Current', mood: 'Cool and open · gentle matte',
    recipe: { exposure: 0.12, contrast: -13, saturation: -16, temp: -6, tint: -1, highlights: -8, shadows: 15, fade: 10, grain: 9 },
    swatch: 'current', preview: 'hue-rotate(185deg) saturate(.82) brightness(1.06) contrast(.88)',
  },
  {
    id: 'four-sixteen', name: '4:16 PM', mood: 'Clear afternoon · warm sun',
    recipe: { exposure: 0.08, contrast: 8, saturation: 2, temp: 11, tint: 1, highlights: -17, shadows: 4, fade: 2, grain: 12 },
    swatch: 'sunset', preview: 'sepia(.25) saturate(1.13) brightness(1.04) contrast(1.06)',
  },
  {
    id: 'red-ledger', name: 'Red Ledger', mood: 'Crisp contrast · vivid detail',
    recipe: { exposure: 0, contrast: 17, saturation: 6, temp: 1, tint: 1, highlights: -11, shadows: -4, fade: 0, grain: 23 },
    swatch: 'ledger', preview: 'sepia(.05) saturate(1.15) brightness(.98) contrast(1.18)',
  },
  {
    id: 'rose-dust', name: 'Rose Dust', mood: 'Faded edges · a hint of rose',
    recipe: { exposure: 0.07, contrast: -10, saturation: -13, temp: 4, tint: 4, highlights: -9, shadows: 9, fade: 10, grain: 14 },
    swatch: 'rose', preview: 'sepia(.14) hue-rotate(325deg) saturate(.82) brightness(1.04) contrast(.9)',
  },
]

export const ADJUSTMENTS = [
  { key: 'exposure', label: 'Exposure', min: -1, max: 1, step: 0.01, unit: ' EV', display: (n) => `${n > 0 ? '+' : ''}${n.toFixed(2)} EV` },
  { key: 'temp', label: 'Temperature', min: -100, max: 100, step: 1, unit: '', display: (n) => `${n > 0 ? '+' : ''}${n}` },
  { key: 'tint', label: 'Tint', min: -100, max: 100, step: 1, unit: '', display: (n) => `${n > 0 ? '+' : ''}${n}` },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1, unit: '', display: (n) => `${n > 0 ? '+' : ''}${n}` },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1, unit: '', display: (n) => `${n > 0 ? '+' : ''}${n}` },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1, unit: '', display: (n) => `${n > 0 ? '+' : ''}${n}` },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, step: 1, unit: '', display: (n) => `${n > 0 ? '+' : ''}${n}` },
  { key: 'fade', label: 'Fade', min: 0, max: 100, step: 1, unit: '', display: (n) => `${n}` },
  { key: 'grain', label: 'Grain', min: 0, max: 100, step: 1, unit: '', display: (n) => `${n}` },
]
