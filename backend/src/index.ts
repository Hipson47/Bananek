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

// Body size limit — 20 MB backstop (single 10 MB image encodes to ~13.3 MB base64 + JSON overhead)
app.use("/api/*", bodyLimit({ maxSize: 20 * 1024 * 1024 }));

// Routes
app.route("/api", enhanceRouter);

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Backend listening on http://localhost:${info.port}`);
});

export { app };
