const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp8 = (value) => clamp(value, 0, 255);
const CROP_ASPECTS = { "1:1": 1, "3:2": 3 / 2, "4:5": 4 / 5, "9:16": 9 / 16 };

export function fittedSize(width, height, maxEdge = 1800) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function getCropGeometry(width, height, crop = {}) {
  const rotation = (((Number(crop.rotation) || 0) % 360) + 360) % 360;
  const swapped = rotation === 90 || rotation === 270;
  const orientedWidth = swapped ? height : width;
  const orientedHeight = swapped ? width : height;
  const ratio =
    crop.ratio === "original"
      ? orientedWidth / orientedHeight
      : CROP_ASPECTS[crop.ratio] || orientedWidth / orientedHeight;
  let baseWidth;
  let baseHeight;
  if (orientedWidth / orientedHeight > ratio) {
    baseHeight = orientedHeight;
    baseWidth = baseHeight * ratio;
  } else {
    baseWidth = orientedWidth;
    baseHeight = baseWidth / ratio;
  }
  const zoom = clamp(Number(crop.zoom) || 1, 1, 3);
  const cropWidth = baseWidth / zoom;
  const cropHeight = baseHeight / zoom;
  const offsetX = clamp(Number(crop.offsetX) || 0, -1, 1);
  const offsetY = clamp(Number(crop.offsetY) || 0, -1, 1);
  return {
    rotation,
    orientedWidth,
    orientedHeight,
    ratio,
    width: cropWidth,
    height: cropHeight,
    left: ((orientedWidth - cropWidth) * (offsetX + 1)) / 2,
    top: ((orientedHeight - cropHeight) * (offsetY + 1)) / 2,
  };
}

// Preset strength and the user's manual tweaks are independent. The UI presents
// the tuned recipe, while the difference from the starting recipe stays at full strength.
export function resolveRecipe(preset, tuned, intensity) {
  const amount = clamp(intensity / 100, 0, 1);
  return Object.fromEntries(
    Object.keys(preset).map((key) => {
      const value = preset[key] * amount + (tuned[key] - preset[key]);
      const min =
        key === "fade" || key === "grain" ? 0 : key === "exposure" ? -1 : -100;
      const max = key === "exposure" ? 1 : 100;
      return [key, clamp(value, min, max)];
    }),
  );
}

function settingsFor(recipe) {
  return {
    exposure: Math.pow(2, recipe.exposure),
    contrast: 1 + recipe.contrast / 100,
    saturation: 1 + recipe.saturation / 100,
    temp: recipe.temp,
    tint: recipe.tint,
    highlights: recipe.highlights / 100,
    shadows: recipe.shadows / 100,
    fade: recipe.fade / 100,
    grain: recipe.grain,
  };
}

function drawSource(source, canvas, maxEdge, crop) {
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  const frame = getCropGeometry(sourceWidth, sourceHeight, crop);
  const scale = Math.min(1, maxEdge / Math.max(frame.width, frame.height));
  canvas.width = Math.max(1, Math.round(frame.width * scale));
  canvas.height = Math.max(1, Math.round(frame.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context)
    throw new Error("This browser could not allocate a photo canvas.");
  let a = 1;
  let b = 0;
  let c = 0;
  let d = 1;
  let e = 0;
  let f = 0;
  if (frame.rotation === 90) {
    a = 0;
    b = 1;
    c = -1;
    d = 0;
    e = sourceHeight;
  } else if (frame.rotation === 180) {
    a = -1;
    d = -1;
    e = sourceWidth;
    f = sourceHeight;
  } else if (frame.rotation === 270) {
    a = 0;
    b = -1;
    c = 1;
    d = 0;
    f = sourceWidth;
  }
  context.setTransform(
    scale * a,
    scale * b,
    scale * c,
    scale * d,
    scale * (e - frame.left),
    scale * (f - frame.top),
  );
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  context.setTransform(1, 0, 0, 1, 0, 0);
  return context;
}

function processPixels(pixels, settings, pixelOffset = 0) {
  const {
    exposure,
    contrast,
    saturation,
    temp,
    tint,
    highlights,
    shadows,
    fade,
    grain,
  } = settings;
  for (let i = 0, p = pixelOffset; i < pixels.length; i += 4, p += 1) {
    let r = pixels[i] * exposure;
    let g = pixels[i + 1] * exposure;
    let b = pixels[i + 2] * exposure;

    // Gentle channel offsets keep the original recipes photographic rather than overlay-like.
    r += temp * 0.48 + tint * 0.17;
    g += tint * -0.08;
    b -= temp * 0.48 - tint * 0.17;

    r = (r - 127.5) * contrast + 127.5;
    g = (g - 127.5) * contrast + 127.5;
    b = (b - 127.5) * contrast + 127.5;

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luminance + (r - luminance) * saturation;
    g = luminance + (g - luminance) * saturation;
    b = luminance + (b - luminance) * saturation;

    const y = clamp(luminance / 255, 0, 1);
    const shadowWeight = Math.pow(1 - y, 2);
    const highlightWeight = Math.pow(y, 2);
    const tonalShift =
      shadows * 34 * shadowWeight + highlights * 34 * highlightWeight;
    r += tonalShift;
    g += tonalShift;
    b += tonalShift;

    if (fade > 0) {
      const lift = fade * 35;
      r = r * (1 - fade * 0.25) + lift;
      g = g * (1 - fade * 0.25) + lift;
      b = b * (1 - fade * 0.25) + lift;
    }

    // Deterministic, monochrome grain; the same edit always exports identically.
    if (grain > 0) {
      const seed = (p * 0x45d9f3b) >>> 0;
      const noise =
        (((seed ^ (seed >>> 16)) & 1023) / 511.5 - 1) * grain * 0.16;
      r += noise;
      g += noise;
      b += noise;
    }

    pixels[i] = clamp8(r);
    pixels[i + 1] = clamp8(g);
    pixels[i + 2] = clamp8(b);
  }
}

export function renderFiltered(
  source,
  canvas,
  recipe,
  maxEdge = 1800,
  crop = { ratio: "original" },
) {
  const context = drawSource(source, canvas, maxEdge, crop);
  if (Object.values(recipe).every((value) => value === 0)) return;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  processPixels(image.data, settingsFor(recipe));
  context.putImageData(image, 0, 0);
}

export async function renderFilteredAsync(
  source,
  canvas,
  recipe,
  maxEdge = 3200,
  onProgress = () => {},
  crop = { ratio: "original" },
) {
  const context = drawSource(source, canvas, maxEdge, crop);
  const settings = settingsFor(recipe);
  if (Object.values(recipe).every((value) => value === 0)) {
    onProgress(100);
    return;
  }
  // Only one short strip of ImageData is allocated at a time. Yield between
  // strips so the phone can paint progress and respond instead of freezing.
  const stripHeight = 128;
  for (let y = 0; y < canvas.height; y += stripHeight) {
    const rows = Math.min(stripHeight, canvas.height - y);
    const strip = context.getImageData(0, y, canvas.width, rows);
    processPixels(strip.data, settings, y * canvas.width);
    context.putImageData(strip, 0, y);
    onProgress(Math.round(((y + rows) / canvas.height) * 100));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
}
