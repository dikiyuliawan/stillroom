import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const filterNames = [
  "Linen Veil",
  "Greenroom",
  "Apricot Glass",
  "Blue Hour",
  "Soft Current",
  "4:16 PM",
  "Red Ledger",
  "Rose Dust",
];
const artifacts = path.resolve("artifacts");

async function ready(page) {
  await page.goto("/");
  await page.waitForFunction(() => {
    const image = document.querySelector(".original-photo");
    const canvas = document.querySelector(".processed-photo");
    return image?.naturalWidth > 0 && canvas?.width > 0 && canvas?.height > 0;
  });
}

async function fingerprint(page) {
  return page.locator(".processed-photo").evaluate((canvas) => {
    const data = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0;
    for (let i = 0; i < data.length; i += 400)
      total += data[i] * 3 + data[i + 1] * 2 + data[i + 2];
    return total;
  });
}

test.beforeAll(async () => fs.mkdir(artifacts, { recursive: true }));

test("mobile and desktop layouts stay within the viewport", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Linen Veil", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".original-photo")).toHaveAttribute(
    "src",
    "/tests/fixtures/demo-user-provided.webp",
  );
  await expect(
    page.getByText(/Demo sample: user-provided image/),
  ).toBeVisible();
  await expect(
    page.getByText(/Rights for public reuse have not been verified/),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Signature filters" }).getByRole("button"),
  ).toHaveCount(8);
  await page.screenshot({
    path: path.join(artifacts, "stillroom-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Crop", exact: true }).click();
  await page.getByRole("button", { name: "4:5", exact: true }).click();
  await page.screenshot({
    path: path.join(artifacts, "stillroom-crop-review.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Filters", exact: true }).click();
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => ({
      width: window.innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(layout.content).toBeLessThanOrEqual(layout.width);
    await expect(
      page.getByRole("button", { name: "Export image", exact: true }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: path.join(artifacts, "stillroom-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("every filter changes the preview; intensity, compare, and adjustments work", async ({
  page,
}) => {
  await ready(page);
  const checksums = [];
  for (const name of filterNames) {
    const previous = await fingerprint(page);
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    if (name !== "Linen Veil")
      await expect.poll(() => fingerprint(page)).not.toBe(previous);
    checksums.push(await fingerprint(page));
  }
  expect(new Set(checksums).size).toBe(8);

  const intensity = page.locator("#intensity-range");
  await intensity.press("Home");
  await expect(intensity).toHaveValue("0");
  const original = await fingerprint(page);
  await intensity.press("End");
  await expect(intensity).toHaveValue("100");
  await expect.poll(() => fingerprint(page)).not.toBe(original);

  const compare = page.getByRole("button", {
    name: "Hold to compare with original",
    exact: true,
  });
  await compare.scrollIntoViewIfNeeded();
  const box = await compare.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByText("Original", { exact: true })).toBeVisible();
  await expect(page.locator(".processed-photo")).toHaveClass(/is-hidden/);
  await page.mouse.up();
  await expect(page.locator(".processed-photo")).not.toHaveClass(/is-hidden/);

  await page.getByRole("tab", { name: "Adjust", exact: true }).click();
  const temperature = page.getByRole("slider", {
    name: "Temperature",
    exact: true,
  });
  await temperature.press("End");
  await expect(temperature).toHaveValue("100");
  await expect(page.locator(".quick-control").first()).toContainText("+100");
  await page.screenshot({
    path: path.join(artifacts, "stillroom-adjustments.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(temperature).toHaveValue("4");
  await expect(intensity).toHaveValue("72");
});

test("crop ratios, zoom/pan, rotation, undo/redo, and cropped PNG export work", async ({
  page,
}) => {
  await ready(page);
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("tests/fixtures/landscape.png"));
  await page.waitForFunction(
    () => document.querySelector(".original-photo")?.naturalWidth === 1280,
  );
  await page.getByRole("tab", { name: "Crop", exact: true }).click();
  await page.getByRole("button", { name: "1:1", exact: true }).click();
  await page.waitForFunction((expected) => {
    const box = document.querySelector(".photo-stage")?.getBoundingClientRect();
    return box && Math.abs(box.width / box.height - expected) < 0.01;
  }, 1);
  const initialRatio = await page
    .locator(".photo-stage")
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      return box.width / box.height;
    });
  expect(initialRatio).toBeCloseTo(1, 1);
  for (const [ratio, expected] of [
    ["4:5", 0.8],
    ["9:16", 9 / 16],
    ["3:2", 1.5],
    ["1:1", 1],
  ]) {
    await page.getByRole("button", { name: ratio, exact: true }).click();
    await page.waitForFunction((target) => {
      const box = document
        .querySelector(".photo-stage")
        ?.getBoundingClientRect();
      return box && Math.abs(box.width / box.height - target) < 0.01;
    }, expected);
    const actual = await page.locator(".photo-stage").evaluate((element) => {
      const box = element.getBoundingClientRect();
      return box.width / box.height;
    });
    expect(actual).toBeCloseTo(expected, 1);
  }
  const zoom = page.getByRole("slider", { name: "Crop zoom", exact: true });
  await zoom.press("End");
  await expect(zoom).toHaveValue("3");
  const canvasFingerprint = () =>
    page.locator(".original-framing").evaluate((canvas) => {
      const pixels = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0;
      for (let i = 0; i < pixels.length; i += 400)
        sum += pixels[i] * 3 + pixels[i + 1] * 2 + pixels[i + 2];
      return sum;
    });
  const beforePan = await canvasFingerprint();
  const stage = await page.locator(".photo-stage").boundingBox();
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    stage.x + stage.width / 2 + 30,
    stage.y + stage.height / 2 + 15,
  );
  await page.mouse.up();
  const panMatchesPointerDistance = () =>
    page.evaluate(async ({ dx, dy }) => {
      const { getCropGeometry, renderFiltered } =
        await import("/src/image-processing.js");
      const source = document.querySelector(".original-photo");
      const stage = document
        .querySelector(".photo-stage")
        .getBoundingClientRect();
      const frame = getCropGeometry(source.naturalWidth, source.naturalHeight, {
        ratio: "1:1",
        zoom: 3,
      });
      const crop = {
        ratio: "1:1",
        zoom: 3,
        offsetX: Math.max(
          -1,
          Math.min(
            1,
            (-2 * dx * frame.width) /
              (stage.width * (frame.orientedWidth - frame.width)),
          ),
        ),
        offsetY: Math.max(
          -1,
          Math.min(
            1,
            (-2 * dy * frame.height) /
              (stage.height * (frame.orientedHeight - frame.height)),
          ),
        ),
      };
      const expected = document.createElement("canvas");
      renderFiltered(
        source,
        expected,
        Object.fromEntries(
          [
            "exposure",
            "contrast",
            "saturation",
            "temp",
            "tint",
            "highlights",
            "shadows",
            "fade",
            "grain",
          ].map((key) => [key, 0]),
        ),
        1500,
        crop,
      );
      const actual = document.querySelector(".original-framing");
      if (actual.width !== expected.width || actual.height !== expected.height)
        return false;
      const actualPixels = actual
        .getContext("2d")
        .getImageData(0, 0, actual.width, actual.height).data;
      const expectedPixels = expected
        .getContext("2d")
        .getImageData(0, 0, expected.width, expected.height).data;
      return actualPixels.every(
        (pixel, index) => pixel === expectedPixels[index],
      );
    }, { dx: 30, dy: 15 });
  await expect.poll(panMatchesPointerDistance).toBe(true);
  await expect.poll(canvasFingerprint).not.toBe(beforePan);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(zoom).toHaveValue("3");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(zoom).toHaveValue("1");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(zoom).toHaveValue("3");
  await page
    .getByRole("button", { name: "Reset framing", exact: true })
    .click();
  await page.getByRole("button", { name: "Original", exact: true }).click();
  await page.getByRole("button", { name: "Rotate right", exact: true }).click();
  await page.waitForFunction(() => {
    const box = document.querySelector(".photo-stage")?.getBoundingClientRect();
    return box && Math.abs(box.width / box.height - 0.625) < 0.01;
  });
  const turnedRatio = await page.locator(".photo-stage").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.width / box.height;
  });
  expect(turnedRatio).toBeCloseTo(0.625, 2);
  await page
    .getByRole("button", { name: "Reset framing", exact: true })
    .click();
  await page.getByRole("button", { name: "1:1", exact: true }).click();
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  await page.getByRole("button", { name: /PNG Lossless/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save PNG to device", exact: true })
    .click();
  const download = await downloadPromise;
  const filePath = path.join(artifacts, "crop-export.png");
  await download.saveAs(filePath);
  const data = await fs.readFile(filePath);
  expect(data.readUInt32BE(16)).toBe(800);
  expect(data.readUInt32BE(20)).toBe(800);
});

test("local import keeps the image ratio and downloads valid PNG and JPG files", async ({
  page,
}) => {
  await ready(page);
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("tests/fixtures/landscape.png"));
  await expect(page.locator(".image-meta")).toContainText("Landscape");
  await page.waitForFunction(
    () => document.querySelector(".processed-photo")?.width === 1280,
  );
  const geometry = await page.locator(".photo-stage").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      ratio: box.width / box.height,
      width: box.width,
      height: box.height,
    };
  });
  expect(geometry.ratio).toBeCloseTo(1.6, 1);
  expect(geometry.width).toBeGreaterThan(300);

  await page.getByRole("button", { name: "Export image", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Export your edit" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /PNG Lossless/ }).click();
  await page.getByRole("button", { name: /Web Up to 2500/ }).click();
  const pngPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save PNG to device", exact: true })
    .click();
  const png = await pngPromise;
  const pngPath = path.join(artifacts, "export-local.png");
  await png.saveAs(pngPath);
  const pngData = await fs.readFile(pngPath);
  expect(pngData.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(pngData.readUInt32BE(16)).toBe(1280);
  expect(pngData.readUInt32BE(20)).toBe(800);

  await page.getByRole("button", { name: "Export image", exact: true }).click();
  await page.getByRole("button", { name: /JPG Smaller file/ }).click();
  const jpgPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save JPG to device", exact: true })
    .click();
  const jpg = await jpgPromise;
  const jpgPath = path.join(artifacts, "export-local.jpg");
  await jpg.saveAs(jpgPath);
  const jpgData = await fs.readFile(jpgPath);
  expect(jpgData.subarray(0, 2).toString("hex")).toBe("ffd8");
  expect(jpgData.length).toBeGreaterThan(1000);
});
