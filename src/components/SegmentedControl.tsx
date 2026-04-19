type SegmentedControlProps = {
  name: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
};

export function SegmentedControl({
  name,
  onChange,
  options,
  value,
}: SegmentedControlProps) {
  return (
    <div className="segmented-control" role="radiogroup" aria-label={name}>
      {options.map((option) => (
        <button
          aria-pressed={value === option.value}
          className={`segmented-control__button${
            value === option.value ? " is-active" : ""
          }`}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
