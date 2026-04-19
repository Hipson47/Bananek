export function downloadImage(imageUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = imageUrl;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
