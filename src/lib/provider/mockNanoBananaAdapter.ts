import type { AppError, AspectRatioId, ResolutionId } from "../types";
import type { GenerateRequest, GenerateResponse } from "./contracts";
import type { ProviderAdapter } from "./providerAdapter";

const MODEL_COLORS: Record<string, [string, string]> = {
  "Nano Banana 2 — Fast": ["#dbeafe", "#eff6ff"],
  "Nano Banana 2 — Thinking": ["#ecfeff", "#f0fdfa"],
  "Nano Banana Pro": ["#f5f5f4", "#fafaf9"],
};

const RESOLUTION_BASE: Record<ResolutionId, number> = {
  default: 1280,
  "0.5k": 768,
  "1k": 1024,
  "2k": 2048,
  "4k": 4096,
};

const ASPECT_RATIO_MAP: Record<AspectRatioId, [number, number]> = {
  auto: [1, 1],
  "21:9": [21, 9],
  "16:9": [16, 9],
  "3:2": [3, 2],
  "4:3": [4, 3],
  "5:4": [5, 4],
  "1:1": [1, 1],
  "4:5": [4, 5],
  "3:4": [3, 4],
  "2:3": [2, 3],
  "9:16": [9, 16],
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const createMockError = (kind: AppError["kind"], message: string): AppError => ({
  kind,
  message,
});

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const toDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function getOutputDimensions(aspectRatio: AspectRatioId, resolution: ResolutionId) {
  const [ratioWidth, ratioHeight] = ASPECT_RATIO_MAP[aspectRatio];
  const targetLongEdge = RESOLUTION_BASE[resolution];
  const widthScale = targetLongEdge / Math.max(ratioWidth, ratioHeight);

  return {
    width: Math.round(ratioWidth * widthScale),
    height: Math.round(ratioHeight * widthScale),
  };
}

function createSvg(request: GenerateRequest) {
  const [start, end] = MODEL_COLORS[request.model.label] ?? ["#e2e8f0", "#f8fafc"];
  const promptPreview = escapeXml(request.prompt.slice(0, 180) || "Untitled prompt");
  const keyTail = request.apiKey.slice(-4).padStart(4, "•");
  const { width, height } = getOutputDimensions(request.aspectRatio, request.resolution);
  const inset = 28;
  const frameWidth = width - inset * 2;
  const frameHeight = height - inset * 2;
  const titleY = inset + 56;
  const promptY = inset + 146;
  const detailsY = height - 138;
  const details = [
    `Mode ${request.mode}`,
    `Model ${request.model.label}`,
    `Aspect ${request.aspectRatio}`,
    `Resolution ${request.resolution}`,
    `Quality ${request.quality}`,
    `References ${request.references.length}`,
    `Key ••••${keyTail}`,
  ];

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="#e2e8f0" />
      <rect x="${inset}" y="${inset}" width="${frameWidth}" height="${frameHeight}" rx="24" fill="url(#bg)" stroke="#cbd5e1" />
      <rect x="${inset + 24}" y="${inset + 24}" width="${frameWidth - 48}" height="78" rx="14" fill="#ffffff" stroke="#cbd5e1" />
      <text x="${inset + 46}" y="${titleY}" fill="#0f172a" font-size="24" font-family="IBM Plex Sans, Segoe UI, sans-serif">Mock adapter output</text>
      <text x="${inset + 46}" y="${titleY + 28}" fill="#64748b" font-size="16" font-family="IBM Plex Sans, Segoe UI, sans-serif">Replace src/lib/provider/createProviderAdapter.ts to wire the real Gemini client.</text>
      <text x="${inset + 20}" y="${promptY}" fill="#0f172a" font-size="34" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-weight="700">${escapeXml(
        request.model.label,
      )}</text>
      <foreignObject x="${inset + 20}" y="${promptY + 26}" width="${Math.max(frameWidth - 120, 360)}" height="${Math.max(frameHeight - 280, 160)}">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: IBM Plex Sans, Segoe UI, sans-serif; color: #0f172a; font-size: 28px; line-height: 1.35; font-weight: 600;">
          ${promptPreview}
        </div>
      </foreignObject>
      <g transform="translate(${inset + 20}, ${detailsY})">
        ${details
          .map(
            (detail, index) => `
              <text x="0" y="${index * 24}" fill="#334155" font-size="18" font-family="IBM Plex Sans, Segoe UI, sans-serif">${escapeXml(
                detail,
              )}</text>
            `,
          )
          .join("")}
      </g>
    </svg>
  `;
}

export class MockNanoBananaAdapter implements ProviderAdapter {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    await wait(900);

    if (!request.apiKey.trim()) {
      throw createMockError("validation", "API key is required before generating.");
    }

    const lowerPrompt = request.prompt.toLowerCase();

    if (lowerPrompt.includes("::network-error")) {
      throw createMockError("network", "Mock network error triggered by prompt.");
    }

    if (lowerPrompt.includes("::provider-error")) {
      throw createMockError("provider", "Mock provider error triggered by prompt.");
    }

    if (lowerPrompt.includes("::malformed")) {
      throw createMockError(
        "malformed",
        "Mock malformed provider response triggered by prompt.",
      );
    }

    if (lowerPrompt.includes("::empty")) {
      return {
        createdAt: Date.now(),
        filename: "nano-banana-empty.png",
        imageUrl: "",
        mimeType: "image/png",
        sourceModelLabel: request.model.label,
      };
    }

    return {
      createdAt: Date.now(),
      filename: `nano-banana-${request.model.id}-${Date.now()}.svg`,
      imageUrl: toDataUrl(createSvg(request)),
      mimeType: "image/svg+xml",
      sourceModelLabel: request.model.label,
    };
  }
}
