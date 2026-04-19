import type { DragEvent, RefObject } from "react";

type ReferenceUploaderProps = {
  inputRef: RefObject<HTMLInputElement>;
  onFilesSelected: (files: FileList | null) => void;
};

export function ReferenceUploader({
  inputRef,
  onFilesSelected,
}: ReferenceUploaderProps) {
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    onFilesSelected(event.dataTransfer.files);
  };

  return (
    <label
      className="reference-uploader"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        accept="image/png,image/jpeg,image/webp"
        hidden
        multiple
        onChange={(event) => onFilesSelected(event.target.files)}
        ref={inputRef}
        type="file"
      />
      <span className="reference-uploader__title">Upload or drop images</span>
      <span className="reference-uploader__hint">
        PNG, JPEG, and WEBP are accepted.
      </span>
    </label>
  );
}
