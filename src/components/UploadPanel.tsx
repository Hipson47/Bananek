import { useRef } from "react";

import { validateImageFile } from "../features/enhancer/lib/validateImageFile";

type UploadPanelProps = {
  file: File | null;
  previewUrl: string | null;
  processing: boolean;
  onValidationError: (message: string) => void;
  onFileSelect: (file: File | null) => void;
};

export function UploadPanel({
  file,
  previewUrl,
  processing,
  onValidationError,
  onFileSelect,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;

    if (!nextFile) {
      onFileSelect(null);
      return;
    }

    const validationError = validateImageFile(nextFile);

    if (validationError) {
      event.target.value = "";
      onFileSelect(null);
      onValidationError(validationError);
      return;
    }

    onFileSelect(nextFile);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="panel-label">Step 1</p>
          <h2>Upload product image</h2>
        </div>
      </div>

      <div
        className={`upload-dropzone${previewUrl ? " has-preview" : ""}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-disabled={processing}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={handleFileChange}
          disabled={processing}
        />

        {previewUrl ? (
          <div className="upload-preview">
            <img src={previewUrl} alt="Uploaded product preview" />
            <div className="upload-meta">
              <strong>{file?.name}</strong>
              <span>{file ? `${Math.round(file.size / 1024)} KB` : ""}</span>
            </div>
          </div>
        ) : (
          <div className="upload-empty">
            <strong>Click to select a product photo</strong>
            <span>Supports PNG, JPEG, and WEBP up to 10 MB.</span>
          </div>
        )}
      </div>
    </section>
  );
}
