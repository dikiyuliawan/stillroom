import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const filterNames = [
  "Original",
  "A6",
  "M5",
  "AL3",
  "F2",
  "HB1",
  "KE1",
  "CN1",
  "CN2",
  "CN3",
  "CN4",
  "CN5",
  "CN6",
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "T1",
  "SS1",
  "D1",
  "D2",
  "D3",
  "L1",
  "L2",
  "L3",
  "WE4",
  "C1",
  "C2",
  "V1",
  "V2",
  "KP1",
  "P5",
  "R1",
  "R2",
  "R3",
  "B1",
  "B5",
  "B7",
  "B9",
];
const artifacts = path.resolve("artifacts");

async function ready(page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => {
    const framing = document.querySelector(".original-framing");
    const canvas = document.querySelector(".processed-photo");
    return framing?.width > 0 && canvas?.width > 0 && canvas?.height > 0;
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
    page.getByRole("heading", { name: "Original", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#intensity-range")).toBeDisabled();
  await expect(
    page.getByText("Demo sample photo provided by the author."),
  ).toBeVisible();
  await expect(
    page.getByRole("tabpanel", { name: "Presets" }).getByRole("button"),
  ).toHaveCount(40);
  // The strip reads as labeled collections; saved looks append their own.
  await expect(page.locator(".filter-group-label")).toHaveText([
    "Original",
    "Film",
    "Cinema",
    "Golden",
    "Moody",
    "Airy",
    "Vivid",
    "Retro",
    "Mono",
  ]);
  // The free app shows no subscription badges anywhere.
  await expect(page.locator(".tier-badge, .tier-chip")).toHaveCount(0);
  await page.screenshot({
    path: path.join(artifacts, "stillroom-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Crop", exact: true }).click();
  await expect(page.locator(".image-meta")).toBeVisible();
  await page.getByRole("button", { name: "4:5", exact: true }).click();
  await page.screenshot({
    path: path.join(artifacts, "stillroom-crop-review.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Presets", exact: true }).click();
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.evaluate(() => ({
      width: window.innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(layout.content).toBeLessThanOrEqual(layout.width);
    await expect(
      page.getByRole("button", { name: "Export", exact: true }),
    ).toBeVisible();
    // The docked tools must sit inside the viewport without page scrolling.
    const dock = await page.locator(".tabbar").evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, viewport: window.innerHeight };
    });
    expect(dock.top).toBeGreaterThanOrEqual(0);
    expect(dock.bottom).toBeLessThanOrEqual(dock.viewport + 1);
  }
  await page.screenshot({
    path: path.join(artifacts, "stillroom-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("every preset changes the preview; intensity, compare, and adjustments work", async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const checksums = [];
  const allCodes = filterNames.slice(1);
  for (const name of allCodes) {
    const previous = await fingerprint(page);
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => fingerprint(page)).not.toBe(previous);
    checksums.push(await fingerprint(page));
  }
  expect(new Set(checksums).size).toBe(allCodes.length);

  const intensity = page.locator("#intensity-range");
  await intensity.press("Home");
  await expect(intensity).toHaveValue("0");
  const original = await fingerprint(page);
  await intensity.press("End");
  await expect(intensity).toHaveValue("100");
  await expect.poll(() => fingerprint(page)).not.toBe(original);

  const stage = page.locator(".photo-stage");
  await stage.scrollIntoViewIfNeeded();
  const stageBox = await stage.boundingBox();
  await page.mouse.move(
    stageBox.x + stageBox.width / 2,
    stageBox.y + stageBox.height / 2,
  );
  await page.mouse.down();
  await expect(page.locator(".compare-tag")).toBeVisible();
  await expect(page.locator(".processed-photo")).toHaveClass(/is-hidden/);
  await page.mouse.up();
  await expect(page.locator(".compare-tag")).toHaveCount(0);
  await expect(page.locator(".processed-photo")).not.toHaveClass(/is-hidden/);

  await page.getByRole("tab", { name: "Adjust", exact: true }).click();
  const temperature = page.getByRole("slider", {
    name: "Temperature",
    exact: true,
  });
  await temperature.press("End");
  await expect(temperature).toHaveValue("100");
  await page.screenshot({
    path: path.join(artifacts, "stillroom-adjustments.png"),
    fullPage: true,
  });
  // Quick controls live on the presets tab and mirror the recipe.
  await page.getByRole("tab", { name: "Presets", exact: true }).click();
  await expect(page.locator(".quick-control").first()).toContainText("+100");
  await page.getByRole("tab", { name: "Adjust", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  // The loop ended on B9: resetting returns its full recipe, not zero.
  await expect(temperature).toHaveValue("0");
  await expect(
    page.getByRole("slider", { name: "Saturation", exact: true }),
  ).toHaveValue("-100");
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
    () => document.querySelector(".original-framing")?.width === 1280,
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
  const zoom = page.getByRole("slider", { name: "Zoom", exact: true });
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
      const source = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("fixture failed to load"));
        img.src = "/tests/fixtures/landscape.png";
      });
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
  await page.getByRole("button", { name: "Export", exact: true }).click();
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
  await page.waitForFunction(
    () => document.querySelector(".processed-photo")?.width === 1280,
  );
  // The aspect label only appears while the crop tab is active.
  await page.getByRole("tab", { name: "Crop", exact: true }).click();
  await expect(page.locator(".image-meta")).toContainText("Landscape");
  await page.getByRole("tab", { name: "Presets", exact: true }).click();
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

  await page.getByRole("button", { name: "Export", exact: true }).click();
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

  await page.getByRole("button", { name: "Export", exact: true }).click();
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

test("straighten and flip change the framing without empty corners", async ({ page }) => {
  await ready(page);
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.resolve("tests/fixtures/landscape.png"));
  await page.waitForFunction(
    () => document.querySelector(".original-framing")?.width === 1280,
  );
  await page.getByRole("tab", { name: "Crop", exact: true }).click();

  const before = await fingerprint(page);
  const straighten = page.getByRole("slider", { name: "Straighten", exact: true });
  await straighten.fill("12");
  await expect(straighten).toHaveValue("12");
  await expect.poll(() => fingerprint(page)).not.toBe(before);

  // Every corner must still hold image content, never transparent canvas.
  const cornersOpaque = await page.locator(".original-framing").evaluate((canvas) => {
    const ctx = canvas.getContext("2d");
    const points = [
      [1, 1],
      [canvas.width - 2, 1],
      [1, canvas.height - 2],
      [canvas.width - 2, canvas.height - 2],
    ];
    return points.every(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] === 255);
  });
  expect(cornersOpaque).toBe(true);

  await page.getByRole("button", { name: "Reset framing", exact: true }).click();
  const flippedBefore = await fingerprint(page);
  await page.getByRole("button", { name: "Flip horizontally", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Flip horizontally", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => fingerprint(page)).not.toBe(flippedBefore);
});

test("saved looks and session restore work", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "A6", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A6", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Save look", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Save this look" })).toBeVisible();
  await page.locator(".preset-name-field input").fill("Morning");
  await page.getByRole("button", { name: "Save look", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Morning", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "A6", exact: true }).first()).toBeVisible();

  // Re-applying the saved look runs it at full strength; built-ins sit at the
  // strip default.
  const intensity = page.locator("#intensity-range");
  await page.getByRole("button", { name: "Morning", exact: true }).click();
  await expect(intensity).toHaveValue("100");
  await page.getByRole("button", { name: "B5", exact: true }).click();
  await expect(page.getByRole("heading", { name: "B5", exact: true })).toBeVisible();
  await expect(intensity).toHaveValue("72");

  // The saved look survives a reload, and the session restores the selection.
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector(".processed-photo")?.width > 0,
  );
  await expect(page.getByRole("button", { name: "Morning", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "B5", exact: true })).toBeVisible();
});

test("keyboard shortcuts drive history, export, and preview", async ({ page }) => {
  await ready(page);
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeDisabled();

  await page.getByRole("button", { name: "C1", exact: true }).click();
  await page.getByRole("heading", { name: "C1", exact: true }).click();
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("heading", { name: "Original", exact: true })).toBeVisible();
  await page.keyboard.press("Control+Shift+z");
  await expect(page.getByRole("heading", { name: "C1", exact: true })).toBeVisible();

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("dialog", { name: "Export your edit" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.keyboard.press("2");
  await expect(page.getByRole("tab", { name: "Crop", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("3");
  await expect(page.getByRole("tab", { name: "Adjust", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // Space compares against the original while held.
  await page.keyboard.press("1");
  await page.keyboard.down(" ");
  await expect(page.locator(".compare-tag")).toBeVisible();
  await page.keyboard.up(" ");
  await expect(page.locator(".compare-tag")).toHaveCount(0);
});

test("the adjust panel exposes exactly nine sliders and none beyond it", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("tab", { name: "Adjust", exact: true }).click();
  const sliders = page.locator("#panel-adjust input[type='range']");
  await expect(sliders).toHaveCount(9);
  await expect(
    page.getByRole("slider", { name: "Exposure", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Vignette", exact: true }),
  ).toBeVisible();
  // Grading tools live inside the preset recipes, not in the UI.
  await expect(
    page.getByRole("slider", { name: "Shadow tone", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("slider", { name: /Hue/, exact: true }),
  ).toHaveCount(0);
});

test("intensity zero neutralizes preset grading, including authored HSL", async ({
  page,
}) => {
  await ready(page);
  const untouched = await fingerprint(page);
  await page.getByRole("button", { name: "CN1", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "CN1", exact: true }),
  ).toBeVisible();
  await expect.poll(() => fingerprint(page)).not.toBe(untouched);
  const intensity = page.locator("#intensity-range");
  await intensity.press("Home");
  await expect(intensity).toHaveValue("0");
  await expect.poll(() => fingerprint(page)).toBe(untouched);
});
