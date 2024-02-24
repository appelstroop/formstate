import { Ref, nextTick, watch } from "vue";
import {
  Fields,
  FormRule,
  InternalField,
  InternalFieldOrArrayField,
  InternalFormState,
  KindOfRule,
  Rule,
  fieldPrevValue,
  fieldRules,
  formIgnoreDirty,
  formIgnoreValidation,
  formValidationLock,
  resetField,
} from "../useForm";
import { collectErrors, validateField } from "./validation";
import { cloneDeep } from "../../utils/cloneDeep";

export function push<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>
) {
  return function() {
    
  }
}

export function createFields<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>
) {
  for (const [key, field] of Object.entries(formState.value.fields) as [
    keyof T,
    InternalFieldOrArrayField<T, keyof T>
  ][]) {
    if (
      Array.isArray(field) &&
      field.every((item) => typeof item === "object" && item !== null)
    ) {
      (field as Fields<T>[]).forEach((f) => {
        Object.entries(f).forEach(([key, value]) => {
          createField(key, value, formState);
        });
      });
      continue;
    }
    createField(key, field, formState);
  }

  function createField<T extends Record<string, unknown>>(
    key: keyof T,
    field: InternalField<T[keyof T], T>,
    formState: Ref<InternalFormState<T>>
  ) {
    field[fieldRules] = createValidationObject(field.rules) as Rule<
      T[keyof T],
      T
    >[];
    field.name = key as string;
    field.dirty = false;
    field.touched = false;
    field.valid = true;
    field.focused = false;
    field.errors = [];
    field.pending = false;

    field[fieldPrevValue] = cloneDeep(field.value);
    field.reset = () => {
      formState.value[formIgnoreDirty] = true;
      formState.value[formIgnoreValidation] = true;
      resetField(formState, field.name, field);
      formState.value[formValidationLock] = undefined;
      nextTick(() => {
        collectErrors(formState);
        formState.value[formIgnoreDirty] = false;
      });
    };

    field.focus = (evt: FocusEvent) => {
      field.focused = true;
    };

    field.blur = (evt: FocusEvent) => {
      field.touched = true;
      field.focused = false;
      formState.value.touched = true;
    };

    Object.defineProperty(field, "rules", {
      set: function (newValidate) {
        (this as InternalField<T[keyof T], T>)[fieldRules] =
          createValidationObject(newValidate) as Rule<T[keyof T], T>[];
      },
      get: function () {
        return (this as InternalField<T[keyof T], T>)[fieldRules];
      },
    });

    field.validate = validateField(formState, field);

    watch(
      () => field.value,
      () => {
        if (!formState.value[formIgnoreDirty]) {
          field.dirty = true;
          formState.value.dirty = true;
        }
      },
      { deep: true }
    );
  }
}

export function createValidationObject<T extends Record<string, unknown>>(
  fn: KindOfRule<T[keyof T], T>[] | undefined
) {
  if (fn === undefined) {
    return [];
  }
  const mapper = (
    value: KindOfRule<T[keyof T], T> | KindOfRule<T[keyof T], T>[] | undefined
  ) => {
    if (value?.hasOwnProperty("rule")) {
      return value as Rule<T[keyof T], T>;
    }
    return {
      rule: value,
    };
  };
  return fn.map(mapper) as (Rule<T[keyof T], T> | FormRule<T>)[];
}
