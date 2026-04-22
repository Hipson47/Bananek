export function decodeProcessedDataUrl(dataUrl: string, expectedMimeType: string): Buffer {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match || match[1] !== expectedMimeType) {
    throw {
      kind: "processing" as const,
      message: "Processor returned an invalid asset payload.",
    };
  }

  return Buffer.from(match[2], "base64");
}

export function encodeProcessedDataUrl(bytes: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}
