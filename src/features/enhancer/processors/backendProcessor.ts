import type {
  ImageProcessor,
  ProcessImageInput,
  ProcessedImageResult,
} from "../types";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read the uploaded image."));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => {
      reject(new Error("Could not read the uploaded image."));
    };
    reader.readAsDataURL(file);
  });
}

export class BackendProcessor implements ImageProcessor {
  async processImage({
    file,
    preset,
  }: ProcessImageInput): Promise<ProcessedImageResult> {
    const dataUrl = await fileToDataUrl(file);

    const response = await fetch("/api/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        presetId: preset.id,
        image: dataUrl,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message =
        errorBody?.error?.message ??
        `Enhancement failed (status ${response.status}).`;
      throw new Error(message);
    }

    const result: ProcessedImageResult = await response.json();
    return result;
  }
}
