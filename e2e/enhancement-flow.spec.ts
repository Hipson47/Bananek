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
