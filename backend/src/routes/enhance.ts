import { Hono } from "hono";

import { getPreset } from "../presets.js";
import { processImage } from "../processors/index.js";
import { isAppError, validateEnhanceRequest } from "../validation.js";

const router = new Hono();
const PROCESSING_FAILURE_MESSAGE =
  "We couldn't complete this enhancement. Try again or use a different product image.";

function toPublicAppError(err: unknown) {
  const appError = isAppError(err)
    ? err
    : { kind: "processing" as const, message: "Image processing failed." };

  if (appError.kind === "validation") {
    return appError;
  }

  return {
    kind: "processing" as const,
    message: PROCESSING_FAILURE_MESSAGE,
  };
}

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

  // mimeType and image are already validated — no second regex needed
  const commaIndex = parsed.image.indexOf(",");
  const base64Data = parsed.image.slice(commaIndex + 1);
  const imageBuffer = Buffer.from(base64Data, "base64");

  try {
    const processed = await processImage(
      imageBuffer,
      parsed.mimeType,
      parsed.presetId,
    );

    return c.json(processed, 200);
  } catch (err) {
    console.error("[enhance] Processing failed:", err);
    const appError = toPublicAppError(err);

    return c.json({ error: appError }, 500);
  }
});

export { router as enhanceRouter };
