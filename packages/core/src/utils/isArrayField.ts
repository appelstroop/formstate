import { InternalFieldOrArrayField } from "../composables/useForm";

export function isArrayField<T extends Record<string, unknown>>(
  field: InternalFieldOrArrayField<T, keyof T>
) {
  return (
    Array.isArray(field) &&
    field.every((item) => typeof item === "object" && item !== null)
  );
}
