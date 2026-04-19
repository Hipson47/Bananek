import type { PropsWithChildren } from "react";

type FieldProps = PropsWithChildren<{
  label: string;
}>;

export function Field({ children, label }: FieldProps) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}
