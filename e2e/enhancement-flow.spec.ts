import { expect, test } from "@playwright/test";

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGM4MS0FjhiI4wAA4dIcIR+QGUQAAAAASUVORK5CYII=";

test("user can upload, process, and download an enhanced image", async ({ page }) => {
  await page.goto("/app/enhance");

  await expect(page.getByText(/Credits remaining:/)).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "product.png",
    mimeType: "image/png",
    buffer: Buffer.from(TINY_PNG_B64, "base64"),
  });

  await page.getByRole("button", { name: "Clean Background" }).click();
  await page.getByRole("button", { name: "Enhance photo" }).click();

  await expect(page.getByRole("button", { name: "Processing..." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Enhanced output" })).toBeVisible();
  await expect(page.getByText("product-clean-background.png")).toBeVisible();
  await expect(page.getByText("Credits remaining: 2")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download enhanced image" }).click(),
  ]);

  expect(download.suggestedFilename()).toBe("product-clean-background.png");
  expect(await download.path()).toBeTruthy();
});

test("user sees a validation error for unsupported uploads", async ({ page }) => {
  await page.goto("/app/enhance");

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not-an-image"),
  });

  await expect(page.getByRole("alert")).toContainText("PNG, JPEG, or WEBP");
  await expect(page.getByRole("button", { name: "Enhance photo" })).toBeDisabled();
});

test("landing renders the cinematic story system and mode shortcuts", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".cinematic-landing-wrapper")).toBeVisible();
  await expect(page.locator(".cinematic-landing-viewport")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enhancement" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marketplace" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Studio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Catalog" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product Photo" })).toBeVisible();
  await expect(page.getByText("Enhancement").first()).toBeVisible();
});

test("landing does not bootstrap a backend session", async ({ page }) => {
  const sessionRequests: string[] = [];

  page.on("request", (request) => {
    if (request.url().includes("/api/session")) {
      sessionRequests.push(request.url());
    }
  });

  await page.goto("/");

  await expect(page.locator(".cinematic-landing-wrapper")).toBeVisible();
  await page.waitForTimeout(500);
  expect(sessionRequests).toHaveLength(0);
});

test("landing mode shortcuts update the active story chapter", async ({ page }) => {
  await page.goto("/");

  const marketplaceShortcut = page.getByRole("button", { name: "Marketplace" });

  await marketplaceShortcut.click();

  await expect(marketplaceShortcut).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("heading", { name: "Marketplace Ready" })).toBeVisible();
});

test("landing visual structure stays inside desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.locator(".cinematic-landing-wrapper")).toBeVisible();
  await expect(page.locator(".cinematic-nav")).toBeVisible();
  await expect(page.locator(".cinematic-progress-bar")).toHaveCount(1);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.36));
  await page.waitForTimeout(100);

  const hasScrolledHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  expect(hasScrolledHorizontalOverflow).toBe(false);
});

test("mobile landing keeps the primary heading readable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.06));
  await page.waitForTimeout(100);

  const heading = page.getByRole("heading", { name: "Product Photo" });
  await expect(heading).toBeVisible();

  const box = await heading.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-2);
  expect(box!.x + box!.width).toBeLessThanOrEqual(392);
});

test("app route uses the premium product shell", async ({ page }) => {
  await page.goto("/app/enhance");

  await expect(page.locator(".product-app-shell")).toBeVisible();
  await expect(page.locator(".app-topbar")).toBeVisible();
  await expect(page.locator(".enhancer-tool")).toBeVisible();
  await expect(page.locator(".panel").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Story/i })).toBeVisible();
});

test("landing CTA opens the enhancer tool", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Enhance a photo" }).first().click();

  await expect(page).toHaveURL(/\/app\/enhance$/);
  await expect(
    page.getByRole("heading", { name: "Create a cleaner listing image." }),
  ).toBeVisible();
  await expect(page.getByText(/Credits remaining:/)).toBeVisible();
});

test("landing reduced-motion fallback renders product story and CTA", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator(".cinematic-landing-wrapper.is-reduced-motion")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product Photo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
  await page.getByRole("link", { name: "Enhance a photo" }).first().click();
  await expect(page).toHaveURL(/\/app\/enhance$/);
});
