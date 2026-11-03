import { test, expect } from "@playwright/test";
import { FILTERS } from "../src/filters.js";
import {
  fittedSize,
  getCropGeometry,
  resolveRecipe,
} from "../src/image-processing.js";

test("crop geometry bounds supported aspect ratios and rotation", () => {
  const square = getCropGeometry(1280, 800, { ratio: "1:1", zoom: 1 });
  expect(square.width).toBe(800);
  expect(square.height).toBe(800);
  const turned = getCropGeometry(1280, 800, {
    ratio: "original",
    rotation: 90,
  });
  expect(turned.orientedWidth).toBe(800);
  expect(turned.orientedHeight).toBe(1280);
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
});

test("preset intensity does not dilute manual tweaks", () => {
  const preset = FILTERS[0].recipe;
  const tuned = {
    ...preset,
    temp: preset.temp + 10,
    exposure: preset.exposure + 0.2,
  };
  const zero = resolveRecipe(preset, tuned, 0);
  const full = resolveRecipe(preset, tuned, 100);
  expect(zero.temp).toBe(10);
  expect(zero.exposure).toBeCloseTo(0.2);
  expect(full.temp).toBe(15);
  expect(full.exposure).toBeCloseTo(0.3);
  expect(resolveRecipe(preset, preset, 0)).toEqual(
    Object.fromEntries(Object.keys(preset).map((key) => [key, 0])),
  );
  expect(fittedSize(8000, 10000, 3200)).toEqual({ width: 2560, height: 3200 });
});

test("tiled export matches the preview engine and all nine controls alter pixels", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(
    () => document.querySelector(".original-photo")?.naturalWidth > 0,
  );
  const result = await page.evaluate(async () => {
    const { renderFiltered, renderFilteredAsync, resolveRecipe } =
      await import("/src/image-processing.js");
    const { FILTERS } = await import("/src/filters.js");
    const source = document.querySelector(".original-photo");
    const preset = FILTERS[6].recipe;
    const recipe = resolveRecipe(preset, preset, 72);
    const sync = document.createElement("canvas");
    const tiled = document.createElement("canvas");
    renderFiltered(source, sync, recipe, 400);
    await renderFilteredAsync(source, tiled, recipe, 400);
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
      temp: 30,
      tint: 30,
      highlights: -30,
      shadows: 30,
      fade: 30,
      grain: 30,
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
    return { differences, controls };
  });
  expect(result.differences).toBe(0);
  expect(Object.values(result.controls).every(Boolean)).toBe(true);
});

test("invalid images fail gracefully and export dialog supports keyboard dismissal", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(
    () => document.querySelector(".original-photo")?.naturalWidth > 0,
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
  await expect(page.locator(".original-photo")).toHaveAttribute(
    "src",
    "/tests/fixtures/demo-user-provided.webp",
  );
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
