import { test, expect } from "@playwright/test";
import { FILTERS, LOOKS } from "../src/filters.js";
import {
  fittedSize,
  getCropGeometry,
  resolveRecipe,
} from "../src/image-processing.js";

test("crop geometry bounds supported aspect ratios, rotation, and straighten", () => {
  const square = getCropGeometry(1280, 800, { ratio: "1:1", zoom: 1 });
  expect(square.width).toBeCloseTo(800, 6);
  expect(square.height).toBeCloseTo(800, 6);
  const turned = getCropGeometry(1280, 800, {
    ratio: "original",
    rotation: 90,
  });
  expect(turned.orientedWidth).toBeCloseTo(800, 6);
  expect(turned.orientedHeight).toBeCloseTo(1280, 6);
  expect(turned.ratio).toBeCloseTo(0.625);
  const zoomed = getCropGeometry(1280, 800, {
    ratio: "3:2",
    zoom: 2,
    offsetX: 1,
    offsetY: -1,
  });
  expect(zoomed.width / zoomed.height).toBeCloseTo(1.5);
  expect(zoomed.left + zoomed.width).toBeLessThanOrEqual(1280);
  expect(zoomed.top).toBe(0);

  // Straightening widens the bounding box, so the covered frame must shrink to
  // avoid exposing empty canvas corners.
  const straight = getCropGeometry(1280, 800, {
    ratio: "original",
    straighten: 10,
  });
  expect(straight.radians).toBeCloseTo((10 * Math.PI) / 180);
  expect(straight.width).toBeLessThan(1280);
  expect(straight.height).toBeLessThan(800);
  const withinSource =
    straight.width * Math.cos(straight.radians) +
      straight.height * Math.sin(straight.radians) <=
    1280 + 0.001;
  expect(withinSource).toBe(true);
});

test("the preset library is Original-first, neutral, then 39 looks in collections", () => {
  expect(FILTERS).toHaveLength(40);
  expect(LOOKS).toHaveLength(39);
  expect(FILTERS[0].id).toBe("original");
  expect(FILTERS[0].tier).toBe("original");
  for (const value of Object.values(FILTERS[0].recipe)) {
    expect(value).toBe(0);
  }
  const ids = new Set(LOOKS.map((look) => look.id));
  expect(ids.size).toBe(LOOKS.length);
  for (const look of LOOKS) {
    expect(look.collection).toEqual(expect.any(String));
  }
});

test("preset intensity does not dilute manual tweaks", () => {
  const preset = LOOKS[0].recipe;
  const tuned = {
    ...preset,
    temp: preset.temp + 10,
    exposure: preset.exposure + 0.2,
  };
  const zero = resolveRecipe(preset, tuned, 0);
  const full = resolveRecipe(preset, tuned, 100);
  expect(zero.temp).toBe(10);
  expect(zero.exposure).toBeCloseTo(0.2);
  expect(full.temp).toBeCloseTo(preset.temp + 10);
  expect(full.exposure).toBeCloseTo(preset.exposure + 0.2);
  expect(resolveRecipe(preset, preset, 0)).toEqual(
    Object.fromEntries(Object.keys(preset).map((key) => [key, 0])),
  );
  expect(fittedSize(8000, 10000, 3200)).toEqual({ width: 2560, height: 3200 });
});

test("tiled export matches the preview engine and every control alters pixels", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(
    () => document.querySelector(".original-framing")?.width > 0,
  );
  const result = await page.evaluate(async () => {
    const { renderFiltered, renderFilteredAsync, resolveRecipe } =
      await import("/src/image-processing.js");
    const { LOOKS, createHsl } = await import("/src/filters.js");
    const source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("demo fixture failed to load"));
      img.src = "/tests/fixtures/demo-user-provided.webp";
    });
    const preset = LOOKS[5].recipe;
    const recipe = resolveRecipe(preset, preset, 72);
    const hsl = {
      ...createHsl(),
      blue: { h: 20, s: 30, l: -10 },
    };
    const sync = document.createElement("canvas");
    const tiled = document.createElement("canvas");
    renderFiltered(source, sync, recipe, 400, undefined, hsl);
    await renderFilteredAsync(source, tiled, recipe, 400, () => {}, undefined, hsl);
    const first = sync
      .getContext("2d")
      .getImageData(0, 0, sync.width, sync.height).data;
    const second = tiled
      .getContext("2d")
      .getImageData(0, 0, tiled.width, tiled.height).data;
    let differences = 0;
    for (let i = 0; i < first.length; i += 1)
      if (first[i] !== second[i]) differences += 1;
    const neutral = Object.fromEntries(
      Object.keys(preset).map((key) => [key, 0]),
    );
    const testValues = {
      exposure: 0.5,
      contrast: 30,
      saturation: 30,
      vibrance: 40,
      temp: 30,
      tint: 30,
      highlights: -30,
      shadows: 30,
      whites: 40,
      blacks: -40,
      clarity: 50,
      sharpen: 50,
      fade: 30,
      grain: 30,
      vignette: 60,
      splitShadowStrength: 60,
      splitHighlightStrength: 60,
    };
    const checksum = (canvas) => {
      const data = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0;
      for (let i = 0; i < data.length; i += 4)
        total += data[i] * 3 + data[i + 1] * 2 + data[i + 2];
      return total;
    };
    renderFiltered(source, sync, neutral, 180);
    const original = checksum(sync);
    const controls = Object.fromEntries(
      Object.entries(testValues).map(([key, value]) => {
        renderFiltered(source, sync, { ...neutral, [key]: value }, 180);
        return [key, checksum(sync) !== original];
      }),
    );
    // Grain size is a modifier: it reshapes grain rather than adding its own.
    renderFiltered(source, sync, { ...neutral, grain: 30 }, 180);
    const fineGrain = checksum(sync);
    renderFiltered(source, sync, { ...neutral, grain: 30, grainSize: 60 }, 180);
    controls.grainSize = checksum(sync) !== fineGrain;
    const hslPixels = (() => {
      renderFiltered(source, sync, neutral, 180, undefined, hsl);
      return checksum(sync) !== original;
    })();
    return { differences, controls, hslPixels };
  });
  expect(result.differences).toBe(0);
  expect(Object.values(result.controls).every(Boolean)).toBe(true);
  expect(result.hslPixels).toBe(true);
});

test("invalid images fail gracefully and export dialog supports keyboard dismissal", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(
    () => document.querySelector(".original-framing")?.width > 0,
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: "not-an-image.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Not an image"),
  });
  await expect(
    page.getByText("Please choose an image file.", { exact: true }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("Invalid image data"),
  });
  await expect(
    page.getByText("Could not open that photo. Try a JPG, PNG, or WebP.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Demo sample photo provided by the author."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
