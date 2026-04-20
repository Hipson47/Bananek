const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return "Unsupported image type. Use a PNG, JPEG, or WEBP product photo.";
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Image is too large. Upload a file smaller than 10 MB.";
  }

  return null;
}
