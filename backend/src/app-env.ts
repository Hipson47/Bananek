import type { HttpBindings } from "@hono/node-server";
import type { SessionRecord } from "./storage/session-store.js";

export type AppEnv = {
  Bindings: HttpBindings;
  Variables: {
    requestId: string;
    session: SessionRecord | null;
    clientIp: string;
  };
};
