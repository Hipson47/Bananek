import type { SessionRecord } from "./storage/session-store.js";

export type AppEnv = {
  Variables: {
    requestId: string;
    session: SessionRecord | null;
    clientIp: string;
  };
};
