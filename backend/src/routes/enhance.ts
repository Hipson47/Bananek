import { Hono } from "hono";

import { getPreset } from "../presets.js";
import { processImage } from "../processors/mock-processor.js";
import { isAppError, validateEnhanceRequest } from "../validation.js";

const router = new Hono();

router.get("/health", (c) => c.json({ status: "ok" }));

router.post("/enhance", async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { error: { kind: "validation", message: "Invalid JSON body." } },
      400,
    );
  }

  const result = validateEnhanceRequest(body);

  if ("kind" in result) {
    return c.json({ error: result }, 400);
  }

  const { parsed } = result;
  const preset = getPreset(parsed.presetId);

  if (!preset) {
    return c.json(
      { error: { kind: "validation", message: "Unknown preset." } },
      400,
    );
  }

  // Decode the data URL into a Buffer
  const commaIndex = parsed.image.indexOf(",");
  const base64Data = parsed.image.slice(commaIndex + 1);
  const mimeMatch = parsed.image.match(/^data:(image\/[a-z+]+);base64,/);
  const originalMime = mimeMatch?.[1] ?? "image/jpeg";
  const imageBuffer = Buffer.from(base64Data, "base64");

  try {
    const processed = await processImage(
      imageBuffer,
      originalMime,
      parsed.presetId,
    );

    return c.json(processed, 200);
  } catch (err) {
    const appError = isAppError(err)
      ? err
      : { kind: "processing" as const, message: "Image processing failed." };

    return c.json({ error: appError }, 500);
  }
});

export { router as enhanceRouter };
