import { createHmac, timingSafeEqual } from "node:crypto";

function digest(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signValue(value: string, secret: string): string {
  return `${value}.${digest(secret, value)}`;
}

export function unsignValue(
  signedValue: string,
  secret: string,
): string | null {
  const separatorIndex = signedValue.lastIndexOf(".");

  if (separatorIndex <= 0) {
    return null;
  }

  const rawValue = signedValue.slice(0, separatorIndex);
  const signature = signedValue.slice(separatorIndex + 1);
  const expectedSignature = digest(secret, rawValue);

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (actualBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  return rawValue;
}
