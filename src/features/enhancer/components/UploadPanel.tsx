import { useRef, useState } from "react";

import { validateImageFile } from "../lib/validateImageFile";

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
  const [isDragOver, setIsDragOver] = useState(false);

  function handleFile(nextFile: File | null) {
    if (!nextFile) {
      onFileSelect(null);
      return;
    }

    const validationError = validateImageFile(nextFile);

    if (validationError) {
      onFileSelect(null);
      onValidationError(validationError);
      return;
    }

    onFileSelect(nextFile);
  }

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

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (processing) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    // Only clear drag state when leaving the dropzone entirely (not a child)
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (processing) return;
    const dropped = event.dataTransfer.files[0] ?? null;
    handleFile(dropped);
  }

  const dropzoneClass = [
    "upload-dropzone",
    previewUrl ? "has-preview" : "",
    isDragOver ? "is-drag-over" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="panel-label">Step 1</p>
          <h2>Upload product image</h2>
        </div>
      </div>

      <div
        className={dropzoneClass}
        onClick={() => !processing && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!processing) inputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
            <strong>
              {isDragOver ? "Drop to upload" : "Click or drag a product photo here"}
            </strong>
            <span>Supports PNG, JPEG, and WEBP up to 10 MB.</span>
          </div>
        )}
      </div>
    </section>
  );
}
