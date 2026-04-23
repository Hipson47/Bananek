import { describe, expect, it } from "vitest";

import {
  extractClientIp,
  isAllowedHost,
  isAllowedOrigin,
  parseTrustedProxyRules,
} from "../src/security/request-trust.js";

describe("request trust", () => {
  it("ignores spoofed forwarding headers when no trusted proxy is configured", () => {
    const clientIp = extractClientIp({
      remoteAddress: "198.51.100.20",
      xForwardedFor: "203.0.113.55",
      xRealIp: "203.0.113.56",
      trustedProxyRules: [],
    });

    expect(clientIp).toBe("198.51.100.20");
  });

  it("uses the forwarded client IP only when the remote address is trusted", () => {
    const clientIp = extractClientIp({
      remoteAddress: "127.0.0.1",
      xForwardedFor: "203.0.113.55, 127.0.0.1",
      xRealIp: "203.0.113.56",
      trustedProxyRules: parseTrustedProxyRules(["loopback"]),
    });

    expect(clientIp).toBe("203.0.113.55");
  });

  it("ignores forwarded headers from untrusted proxies even when trust rules exist", () => {
    const clientIp = extractClientIp({
      remoteAddress: "198.51.100.20",
      xForwardedFor: "203.0.113.55",
      xRealIp: "203.0.113.56",
      trustedProxyRules: parseTrustedProxyRules(["127.0.0.1/32"]),
    });

    expect(clientIp).toBe("198.51.100.20");
  });

  it("supports exact host and origin allowlists", () => {
    expect(isAllowedHost("127.0.0.1:3001", ["127.0.0.1:3001"])).toBe(true);
    expect(isAllowedHost("evil.example", ["127.0.0.1:3001"])).toBe(false);
    expect(isAllowedOrigin("http://localhost:5173", ["http://localhost:5173"])).toBe(true);
    expect(isAllowedOrigin("https://evil.example", ["http://localhost:5173"])).toBe(false);
  });
});
