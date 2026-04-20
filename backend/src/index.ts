import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";

import { config } from "./config.js";
import { enhanceRouter } from "./routes/enhance.js";

const app = new Hono();

// CORS — allow the Vite dev server origin
app.use(
  "/api/*",
  cors({ origin: config.allowedOrigins }),
);

// Body size limit — 15 MB is generous for a single image as data URL
app.use("/api/*", bodyLimit({ maxSize: 15 * 1024 * 1024 }));

// Routes
app.route("/api", enhanceRouter);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Backend listening on http://localhost:${info.port}`);
});

export { app };
