import { expect, test } from "@playwright/test";

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGM4MS0FjhiI4wAA4dIcIR+QGUQAAAAASUVORK5CYII=";

test("user can upload, process, and download an enhanced image", async ({ page }) => {
  await page.goto("/");

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
  await page.goto("/");

  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not-an-image"),
  });

  await expect(page.getByRole("alert")).toContainText("PNG, JPEG, or WEBP");
  await expect(page.getByRole("button", { name: "Enhance photo" })).toBeDisabled();
});
