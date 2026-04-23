type TrustedProxyRule =
  | { type: "exact"; value: string }
  | { type: "cidr"; network: number; mask: number; raw: string }
  | { type: "loopback" };

function normaliseIpCandidate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const bracketed = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/);
  const unwrapped = bracketed ? bracketed[1] : trimmed;
  const ipv4WithPort = unwrapped.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  const candidate = (ipv4WithPort ? ipv4WithPort[1] : unwrapped).replace(/^::ffff:/i, "");

  if (isIpv4(candidate) || candidate === "::1") {
    return candidate;
  }

  return null;
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) {
      return false;
    }

    const parsed = Number(part);
    return parsed >= 0 && parsed <= 255;
  });
}

function ipv4ToInt(value: string): number {
  return value.split(".").reduce((accumulator, segment) => (
    (accumulator << 8) + Number(segment)
  ), 0) >>> 0;
}

function parseTrustedProxyRule(value: string): TrustedProxyRule {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    throw new Error("Trusted proxy rules must not be blank.");
  }

  if (trimmed === "loopback") {
    return { type: "loopback" };
  }

  if (trimmed.includes("/")) {
    const [network, mask] = trimmed.split("/", 2);
    if (!isIpv4(network)) {
      throw new Error(`Invalid trusted proxy CIDR "${value}". Only IPv4 CIDRs are supported.`);
    }

    const parsedMask = Number(mask);
    if (!Number.isInteger(parsedMask) || parsedMask < 0 || parsedMask > 32) {
      throw new Error(`Invalid trusted proxy mask in "${value}".`);
    }

    const maskBits = parsedMask === 0
      ? 0
      : (0xffffffff << (32 - parsedMask)) >>> 0;

    return {
      type: "cidr",
      raw: value,
      network: ipv4ToInt(network) & maskBits,
      mask: maskBits,
    };
  }

  const normalised = normaliseIpCandidate(trimmed);
  if (!normalised) {
    throw new Error(`Invalid trusted proxy IP "${value}".`);
  }

  return {
    type: "exact",
    value: normalised,
  };
}

export function parseTrustedProxyRules(values: string[]): TrustedProxyRule[] {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => parseTrustedProxyRule(value));
}

function isLoopbackIp(value: string): boolean {
  return value === "::1" || value.startsWith("127.");
}

function matchesTrustedProxyRule(remoteIp: string, rule: TrustedProxyRule): boolean {
  if (rule.type === "loopback") {
    return isLoopbackIp(remoteIp);
  }

  if (rule.type === "exact") {
    return remoteIp === rule.value;
  }

  if (!isIpv4(remoteIp)) {
    return false;
  }

  return (ipv4ToInt(remoteIp) & rule.mask) === rule.network;
}

function pickFirstForwardedIp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  for (const candidate of value.split(",")) {
    const normalised = normaliseIpCandidate(candidate);
    if (normalised) {
      return normalised;
    }
  }

  return null;
}

export function extractClientIp(args: {
  remoteAddress?: string | null;
  xForwardedFor?: string | null;
  xRealIp?: string | null;
  trustedProxyRules: TrustedProxyRule[];
}): string {
  const remoteIp = normaliseIpCandidate(args.remoteAddress) ?? "unknown";

  if (remoteIp === "unknown") {
    return "unknown";
  }

  if (args.trustedProxyRules.length === 0) {
    return remoteIp;
  }

  const trustedProxy = args.trustedProxyRules.some((rule) => matchesTrustedProxyRule(remoteIp, rule));
  if (!trustedProxy) {
    return remoteIp;
  }

  return pickFirstForwardedIp(args.xForwardedFor)
    ?? normaliseIpCandidate(args.xRealIp)
    ?? remoteIp;
}

function normaliseHost(value: string): string {
  return value.trim().toLowerCase();
}

export function isAllowedHost(hostHeader: string | null | undefined, allowedHosts: string[]): boolean {
  if (!hostHeader || allowedHosts.length === 0) {
    return true;
  }

  const host = normaliseHost(hostHeader);
  return allowedHosts.some((allowedHost) => normaliseHost(allowedHost) === host);
}

export function isAllowedOrigin(originHeader: string | null | undefined, allowedOrigins: string[]): boolean {
  if (!originHeader) {
    return true;
  }

  const origin = originHeader.trim().toLowerCase();
  return allowedOrigins.some((allowedOrigin) => allowedOrigin.trim().toLowerCase() === origin);
}
