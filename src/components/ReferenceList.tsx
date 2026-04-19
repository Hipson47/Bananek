import type { ReferenceImage } from "../lib/types";

type ReferenceListProps = {
  references: ReferenceImage[];
  onRemove: (referenceId: string) => void;
};

export function ReferenceList({ references, onRemove }: ReferenceListProps) {
  if (references.length === 0) {
    return (
      <div className="reference-empty">
        No references selected for this session.
      </div>
    );
  }

  return (
    <ul className="reference-list">
      {references.map((reference) => (
        <li className="reference-card" key={reference.id}>
          <img alt={reference.name} src={reference.previewUrl} />
          <div className="reference-card__meta">
            <span>{reference.name}</span>
            <small>{reference.source === "generated" ? "Generated" : "Uploaded"}</small>
          </div>
          <button
            className="reference-card__remove"
            onClick={() => onRemove(reference.id)}
            type="button"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
