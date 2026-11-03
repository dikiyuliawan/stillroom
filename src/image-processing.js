const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const clamp8 = (value) => clamp(value, 0, 255)
const CROP_ASPECTS = { "1:1": 1, "3:2": 3 / 2, "4:5": 4 / 5, "9:16": 9 / 16 };
const MAX_STRAIGHTEN = 45;
const TAU = Math.PI * 2;

// Keys whose neutral value is zero but which never go negative.
const NON_NEGATIVE = new Set([
  "fade",
  "grain",
  "grainSize",
  "clarity",
  "sharpen",
  "splitShadowStrength",
  "splitHighlightStrength",
]);

export function fittedSize(width, height, maxEdge = 1800) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function getCropGeometry(width, height, crop = {}) {
  const rotation = (((Number(crop.rotation) || 0) % 360) + 360) % 360;
  const straighten = clamp(Number(crop.straighten) || 0, -MAX_STRAIGHTEN, MAX_STRAIGHTEN);
  const radians = ((rotation + straighten) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  // Bounding box of the rotated source. For quarter turns this collapses to the
  // familiar width/height swap, so existing ratios stay exact.
  const orientedWidth = width * cos + height * sin;
  const orientedHeight = width * sin + height * cos;

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
  let cropWidth = baseWidth / zoom;
  let cropHeight = baseHeight / zoom;

  // Straightening swings the frame inside the source, so edges would show empty
  // corners. Shrink the frame just enough for the rotated source to cover it.
  if (straighten !== 0) {
    const frameCos = Math.abs(Math.cos((straighten * Math.PI) / 180));
    const frameSin = Math.abs(Math.sin((straighten * Math.PI) / 180));
    const neededWidth = cropWidth * frameCos + cropHeight * frameSin;
    const neededHeight = cropWidth * frameSin + cropHeight * frameCos;
    const cover = Math.max(1, neededWidth / width, neededHeight / height);
    cropWidth /= cover;
    cropHeight /= cover;
  }

  const offsetX = clamp(Number(crop.offsetX) || 0, -1, 1);
  const offsetY = clamp(Number(crop.offsetY) || 0, -1, 1);

  return {
    rotation,
    straighten,
    radians,
    flippedX: Boolean(crop.flipH),
    flippedY: Boolean(crop.flipV),
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
        key === "exposure" ? -1 : NON_NEGATIVE.has(key) ? 0 : -100;
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
    vibrance: recipe.vibrance / 100,
    temp: recipe.temp,
    tint: recipe.tint,
    highlights: recipe.highlights / 100,
    shadows: recipe.shadows / 100,
    whites: (recipe.whites || 0) / 100,
    blacks: (recipe.blacks || 0) / 100,
    clarity: (recipe.clarity || 0) / 100,
    sharpen: (recipe.sharpen || 0) / 100,
    fade: recipe.fade / 100,
    grain: recipe.grain,
    grainSize: recipe.grainSize || 0,
    vignette: (recipe.vignette || 0) / 100,
    splitShadowHue: recipe.splitShadowHue || 0,
    splitShadowStrength: (recipe.splitShadowStrength || 0) / 100,
    splitHighlightHue: recipe.splitHighlightHue || 0,
    splitHighlightStrength: (recipe.splitHighlightStrength || 0) / 100,
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
  if (!context) {
    throw new Error("This browser could not allocate a photo canvas.");
  }

  // Map the crop rect (in rotated-bounding-box space) onto the canvas, then draw
  // the source centred and rotated about its own centre.
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.translate(-frame.left * scale, -frame.top * scale);
  context.scale(scale, scale);
  context.translate(frame.orientedWidth / 2, frame.orientedHeight / 2);
  context.rotate(frame.radians);
  context.scale(frame.flippedX ? -1 : 1, frame.flippedY ? -1 : 1);
  context.translate(-sourceWidth / 2, -sourceHeight / 2);
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  context.setTransform(1, 0, 0, 1, 0, 0);

  return { context, frame };
}

// ── HSL helpers for per-channel and split-tone grading ──────────────────────

function hueToRgb(hue) {
  const h = (((hue % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  if (h < 1) return [1, x, 0];
  if (h < 2) return [x, 1, 0];
  if (h < 3) return [0, 1, x];
  if (h < 4) return [0, x, 1];
  if (h < 5) return [x, 0, 1];
  return [1, 0, x];
}

export function hueDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// Build a compact table so the hot loop avoids object allocation per pixel.
export function buildHslTable(hsl) {
  if (!hsl) return null;
  const channels = [];
  for (const id of Object.keys(hsl)) {
    const value = hsl[id];
    if (!value || (!value.h && !value.s && !value.l)) continue;
    const baseHue = {
      red: 0,
      orange: 30,
      yellow: 60,
      green: 120,
      blue: 240,
      purple: 300,
    }[id];
    if (baseHue === undefined) continue;
    channels.push({
      hue: baseHue,
      shift: (value.h * 40) / 100,
      sat: value.s / 100,
      lum: value.l / 100,
    });
  }
  return channels.length ? channels : null;
}

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (((h % 360) + 360) % 360) / 360;
  const channel = (t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [channel(hue + 1 / 3) * 255, channel(hue) * 255, channel(hue - 1 / 3) * 255];
}

// ── Spatial passes (blur sources for clarity / sharpen) ─────────────────────

function blurRadius(kind) {
  // Fixed pixel radii keep preview and export reading the same, and stay above
  // the sub-pixel floor where canvas blur silently rounds to nothing.
  return kind === "sharpen" ? 1.5 : 8;
}

function blurredPixels(canvas, radius) {
  const scratch = document.createElement("canvas");
  scratch.width = canvas.width;
  scratch.height = canvas.height;
  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.filter = `blur(${radius}px)`;
  context.drawImage(canvas, 0, 0);
  context.filter = "none";
  return context.getImageData(0, 0, scratch.width, scratch.height).data;
}

// ── Pixel pipeline ─────────────────────────────────────────────────────────

function processPixels(pixels, settings, options = {}) {
  const {
    exposure,
    contrast,
    saturation,
    vibrance,
    temp,
    tint,
    highlights,
    shadows,
    whites,
    blacks,
    clarity,
    sharpen,
    fade,
    grain,
    grainSize,
    vignette,
    splitShadowHue,
    splitShadowStrength,
    splitHighlightHue,
    splitHighlightStrength,
  } = settings;

  const {
    pixelOffset = 0,
    width = 0,
    height = 1,
    blurLarge = null,
    blurSmall = null,
    hslChannels = null,
  } = options;

  const doGrain = grain > 0;
  const doFade = fade > 0;
  const doVignette = vignette !== 0;
  const doSplit = splitShadowStrength > 0 || splitHighlightStrength > 0;
  const doWhites = whites !== 0;
  const doBlacks = blacks !== 0;
  const doVibrance = vibrance !== 0;
  const doClarity = clarity > 0 && blurLarge;
  const doSharpen = sharpen > 0 && blurSmall;

  const shadowTint = doSplit ? hueToRgb(splitShadowHue) : null;
  const highlightTint = doSplit ? hueToRgb(splitHighlightHue) : null;

  // Vignette centre distance is normalised once so preview and export agree.
  const halfW = width / 2 || 0.5;
  const halfH = height / 2 || 0.5;
  const norm = Math.hypot(halfW, halfH) || 1;
  const grainBlock = Math.max(1, Math.round(1 + (grainSize / 100) * 5));

  for (let i = 0, p = pixelOffset; i < pixels.length; i += 4, p += 1) {
    let r = pixels[i] * exposure;
    let g = pixels[i + 1] * exposure;
    let b = pixels[i + 2] * exposure;

    // Gentle channel offsets keep the recipes photographic rather than overlay-like.
    r += temp * 0.48 + tint * 0.17;
    g += tint * -0.08;
    b -= temp * 0.48 - tint * 0.17;

    if (doClarity || doSharpen) {
      const offset = i;
      if (doClarity) {
        const amount = clarity * 0.85;
        r += (r - blurLarge[offset]) * amount;
        g += (g - blurLarge[offset + 1]) * amount;
        b += (b - blurLarge[offset + 2]) * amount;
      }
      if (doSharpen) {
        const amount = sharpen * 1.15;
        r += (r - blurSmall[offset]) * amount;
        g += (g - blurSmall[offset + 1]) * amount;
        b += (b - blurSmall[offset + 2]) * amount;
      }
    }

    r = (r - 127.5) * contrast + 127.5;
    g = (g - 127.5) * contrast + 127.5;
    b = (b - 127.5) * contrast + 127.5;

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luminance + (r - luminance) * saturation;
    g = luminance + (g - luminance) * saturation;
    b = luminance + (b - luminance) * saturation;

    if (doVibrance) {
      // Weight toward muted pixels so already-vivid areas move less.
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = clamp(Math.abs(max - min) / 255, 0, 1);
      const weight = vibrance * (1 - chroma) * 0.55;
      const l2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l2 + (r - l2) * (1 + weight);
      g = l2 + (g - l2) * (1 + weight);
      b = l2 + (b - l2) * (1 + weight);
    }

    const y = clamp(luminance / 255, 0, 1);
    const shadowWeight = Math.pow(1 - y, 2);
    const highlightWeight = Math.pow(y, 2);
    const tonalShift =
      shadows * 34 * shadowWeight + highlights * 34 * highlightWeight;
    r += tonalShift;
    g += tonalShift;
    b += tonalShift;

    // Whites push the bright end; blacks lift or crush the dark end.
    if (doWhites) {
      const weight = Math.pow(y, 3);
      const shift = whites * 46 * weight;
      r += shift;
      g += shift;
      b += shift;
    }
    if (doBlacks) {
      const weight = Math.pow(1 - y, 3);
      const shift = blacks * 46 * weight;
      r += shift;
      g += shift;
      b += shift;
    }

    if (doSplit) {
      const shadowMix = splitShadowStrength * shadowWeight;
      if (shadowMix > 0) {
        r = r * (1 - shadowMix) + (r * 0.35 + shadowTint[0] * 255 * 0.65) * shadowMix;
        g = g * (1 - shadowMix) + (g * 0.35 + shadowTint[1] * 255 * 0.65) * shadowMix;
        b = b * (1 - shadowMix) + (b * 0.35 + shadowTint[2] * 255 * 0.65) * shadowMix;
      }
      const highlightMix = splitHighlightStrength * highlightWeight;
      if (highlightMix > 0) {
        r =
          r * (1 - highlightMix) +
          (r * 0.35 + highlightTint[0] * 255 * 0.65) * highlightMix;
        g =
          g * (1 - highlightMix) +
          (g * 0.35 + highlightTint[1] * 255 * 0.65) * highlightMix;
        b =
          b * (1 - highlightMix) +
          (b * 0.35 + highlightTint[2] * 255 * 0.65) * highlightMix;
      }
    }

    if (hslChannels) {
      const [h, s, l] = rgbToHsl(
        clamp(r, 0, 255) / 255,
        clamp(g, 0, 255) / 255,
        clamp(b, 0, 255) / 255,
      );
      let hueShift = 0;
      let satScale = 1;
      let lumShift = 0;
      for (let c = 0; c < hslChannels.length; c += 1) {
        const channel = hslChannels[c];
        const dist = hueDistance(h, channel.hue);
        if (dist >= 60) continue;
        const weight = 1 - dist / 60;
        hueShift += channel.shift * weight;
        satScale += channel.sat * weight;
        lumShift += channel.lum * weight;
      }
      if (hueShift || satScale !== 1 || lumShift) {
        const [nr, ng, nb] = hslToRgb(
          h + hueShift,
          clamp(s * satScale, 0, 1),
          clamp(l + lumShift * 0.25, 0, 1),
        );
        r = nr;
        g = ng;
        b = nb;
      }
    }

    if (doFade) {
      const lift = fade * 35;
      r = r * (1 - fade * 0.25) + lift;
      g = g * (1 - fade * 0.25) + lift;
      b = b * (1 - fade * 0.25) + lift;
    }

    if (doVignette) {
      const px = width ? p % width : 0;
      const py = width ? Math.floor(p / width) : 0;
      const dx = (px - halfW) / norm;
      const dy = (py - halfH) / norm;
      const d = clamp(Math.hypot(dx, dy), 0, 1);
      // Smooth falloff that only bites toward the corners.
      const falloff = d * d * d;
      const amount = vignette * falloff * 70;
      r -= amount;
      g -= amount;
      b -= amount;
    }

    // Deterministic, monochrome grain; the same edit always exports identically.
    if (doGrain) {
      const px = width ? p % width : p;
      const py = width ? Math.floor(p / width) : 0;
      const bx = Math.floor(px / grainBlock);
      const by = Math.floor(py / grainBlock);
      let seed = ((bx * 73856093) ^ (by * 19349663) ^ (p * 0x45d9f3b)) >>> 0;
      seed = (seed ^ (seed >>> 16)) >>> 0;
      const noise = (((seed & 1023) / 511.5) - 1) * grain * 0.16;
      r += noise;
      g += noise;
      b += noise;
    }

    pixels[i] = clamp8(r);
    pixels[i + 1] = clamp8(g);
    pixels[i + 2] = clamp8(b);
  }
}

function prepareSpatial(canvas, settings) {
  const blurLarge =
    settings.clarity > 0
      ? blurredPixels(canvas, blurRadius("clarity"))
      : null;
  const blurSmall =
    settings.sharpen > 0
      ? blurredPixels(canvas, blurRadius("sharpen"))
      : null;
  return { blurLarge, blurSmall };
}

export function renderFiltered(
  source,
  canvas,
  recipe,
  maxEdge = 1800,
  crop = { ratio: "original" },
  hsl = null,
) {
  const { context } = drawSource(source, canvas, maxEdge, crop);
  const settings = settingsFor(recipe);
  const hslChannels = buildHslTable(hsl);
  if (Object.values(recipe).every((value) => value === 0) && !hslChannels) return;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const spatial = prepareSpatial(canvas, settings);
  processPixels(image.data, settings, {
    width: canvas.width,
    height: canvas.height,
    blurLarge: spatial.blurLarge,
    blurSmall: spatial.blurSmall,
    hslChannels,
  });
  context.putImageData(image, 0, 0);
}

export async function renderFilteredAsync(
  source,
  canvas,
  recipe,
  maxEdge = 3200,
  onProgress = () => {},
  crop = { ratio: "original" },
  hsl = null,
) {
  const { context } = drawSource(source, canvas, maxEdge, crop);
  const settings = settingsFor(recipe);
  const hslChannels = buildHslTable(hsl);
  if (Object.values(recipe).every((value) => value === 0) && !hslChannels) {
    onProgress(100);
    return;
  }

  // Spatial passes run once over the whole canvas so strips never show seams.
  const spatial = prepareSpatial(canvas, settings);

  // Only one short strip of ImageData is allocated at a time. Yield between
  // strips so the phone can paint progress and respond instead of freezing.
  const stripHeight = 128;
  for (let y = 0; y < canvas.height; y += stripHeight) {
    const rows = Math.min(stripHeight, canvas.height - y);
    const strip = context.getImageData(0, y, canvas.width, rows);
    const start = y * canvas.width;
    const sliceFor = (blur) =>
      blur
        ? blur.subarray(start * 4, (start + strip.data.length / 4) * 4)
        : null;
    processPixels(strip.data, settings, {
      pixelOffset: start,
      width: canvas.width,
      height: canvas.height,
      blurLarge: sliceFor(spatial.blurLarge),
      blurSmall: sliceFor(spatial.blurSmall),
      hslChannels,
    });
    context.putImageData(strip, 0, y);
    onProgress(Math.round(((y + rows) / canvas.height) * 100));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
}
