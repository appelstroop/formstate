import { computed, nextTick, ref, watch } from "vue";
import type { Ref } from "vue";
import { cloneDeep } from "../utils/cloneDeep";
import { createFields, createValidationObject } from "./lib/createFields";
import {
  collectErrors,
  validateForm,
  validateFormInternal,
  validationWatcher,
} from "./lib/validation";

export type Field<V, T extends Record<string, unknown>> = {
  value: V;
  name: string;
  rules: (Rule<V, T> | RuleFunction<V, T>)[];
  dirty: boolean;
  touched: boolean;
  valid: boolean;
  focused: boolean;
  errors: any[];
  pending: boolean;

  focus: (evt: FocusEvent) => void;
  blur: (evt: FocusEvent) => void;
  validate: (fns?: RuleFunction<V, T>[]) => Promise<ValidationResult>;
  reset: () => void;
};

export const fieldRules = Symbol("fieldRules");
export const fieldPrevValue = Symbol("fieldPrevValue");

export type InternalField<V, T extends Record<string, unknown>> = Field<
  V,
  T
> & {
  [fieldRules]: Rule<V, T>[];
  [fieldPrevValue]: Rule<V, T>[];
};

export type RuleFunction<V, T extends Record<string, unknown>> = (
  value: V,
  fieldName: string,
  formState: Ref<FormState<T>>
) => (ErrorMessages | undefined) | Promise<ErrorMessages | undefined>;

export type InternalRuleFunction<V> = (
  ...args: any[]
) => (ErrorMessages | undefined) | Promise<ErrorMessages | undefined>;

export type FormRuleFunction<T extends Record<string, unknown>> = (
  formState: Ref<FormState<T>>
) => (ErrorMessages | undefined) | Promise<ErrorMessages | undefined>;

export type InternalRule<V> = {
  rule: InternalRuleFunction<V>;
  autoValidate?: boolean;
};

export type Rule<V, T extends Record<string, unknown>> = {
  rule: RuleFunction<V, T>;
  autoValidate?: boolean;
};

export type FormRule<T extends Record<string, unknown>> = {
  rule: FormRuleFunction<T>;
  autoValidate?: boolean;
};

export type KindOfRule<V, T extends Record<string, unknown>> =
  | RuleFunction<T[keyof T], T>
  | Rule<T[keyof T], T>
  | FormRule<T>
  | FormRuleFunction<T>;

type InitialFormStateField<V, T extends Record<string, unknown>> = {
  value: V;
  rules?: (Rule<V, T> | RuleFunction<V, T>)[];
};

type ValidationResult = {
  valid: boolean;
  errors: ErrorMessages;
};

type FormValidationResult<T extends Record<string, unknown>> = {
  valid: boolean;
  errors: ErrorMessages;
  errorFields: { [P in keyof T]: ErrorMessages };
};

export type InternalValidationResult = {
  valid: boolean;
  errors: ErrorMessages;
};

type Fields<T extends Record<string, unknown>> = {
  [P in keyof T]: Field<T[P], T>;
};
type FieldsInit<T extends Record<string, unknown>> = {
  [P in keyof T]: InitialFormStateField<T[P], T> | T[P];
};

export type InitialFormState<T extends Record<string, unknown>> = FieldsInit<T>;

export type ErrorMessages = any | any[];

export type FormState<T extends Record<string, unknown>> = {
  fields: Fields<T>;
  valid: boolean;
  dirty: boolean;
  touched: boolean;
  errors: ErrorMessages;
  pending: boolean;
  initialFields: Fields<T>;
  errorFields: { [P in keyof T]: ErrorMessages };
  formRules: (FormRule<T> | FormRuleFunction<T>)[];
  context: Record<string, unknown>;
};

export const formIgnoreDirty = Symbol("formIgnoreDirty");
export const formIgnoreValidation = Symbol("formIgnoreValidation");
export const formValidationLock = Symbol("formValidationLock");
export const formRules = Symbol("formRules");

export type InternalFormState<T extends Record<string, unknown>> =
  FormState<T> & {
    [formIgnoreDirty]: boolean;
    [formIgnoreValidation]: boolean;
    [formValidationLock]: string | undefined;

    [formRules]: FormRule<T>[];
  };

export type FormResult<T extends Record<string, unknown>> = {
  formState: Ref<FormState<T>>;
  values: Ref<T>;
  context: Record<string, unknown>;
  /**
   * Sets the rules for the form or for specific fields. Add { formRules: [yourRule] } to set the rules for the complet formform
   *
   * @param {} values - The rules to set.
   */
  setRules: ReturnType<typeof setRules<T>>;
  setFields: ReturnType<typeof setFields<T>>;
  resetForm: ReturnType<typeof resetForm<T>>;
  validateForm: () => Promise<
    ReturnType<ReturnType<typeof validateFormInternal>>
  >;
} & FormResultField<T>;

type FormResultField<T extends Record<string, unknown>> = {
  [P in keyof T]: Field<T[P], T>;
};

type Options = {
  context?: Record<string, unknown>;
  formRules?: (() => ErrorMessages | undefined)[];
};

export let store: Ref<Record<string, any>>;

export let isServer = false;
try {
  // @ts-expect-error process.server not known on vite
  isServer = process.server;
} catch {}

const reservedKeys = ["formState", "values", "context"];

/**
 * Reuse an exiting form
 *
 * @param {string} formName - The name of the existing form
 * @returns {FormResult<T>} The result of the form.
 */
export function useForm<T extends Record<string, unknown>>(
  formName: string
): FormResult<T>;

/**
 * Initializes the form with the given initial state and options.
 *
 * @param {InitialFormState<T>} [initState] - The initial state of the form.
 * @param {Options} [options] - The options for the form.
 * @returns {FormResult<T>} The result of the form.
 */
export function useForm<T extends Record<string, unknown>>(
  initState?: InitialFormState<T>,
  options?: Options
): FormResult<T>;
/**
 * Uses the form with the given name and initializes it with the given initial state and options.
 *
 * @param {string} formName - The name of the form.
 * @param {InitialFormState<T>} [initState] - The initial state of the form.
 * @param {Options} [options] - The options for the form.
 * @returns {FormResult<T>} The result of the form.
 */
export function useForm<T extends Record<string, unknown>>(
  formName: string,
  initState?: InitialFormState<T>,
  options?: Options
): FormResult<T>;

export function useForm<T extends Record<string, unknown>>(
  ...args: any
): FormResult<T> {
  if (typeof args[0] !== "string") {
    args.unshift(undefined);
  }

  const [formName, initState, options]: [
    string | undefined,
    InitialFormState<T>,
    Options
  ] = args;

  const shouldUseState = typeof formName === "string";

  if (!isServer && !store && shouldUseState) {
    setStore(ref({}));
  }

  if (!initState && shouldUseState) {
    const _state = store.value[formName];
    if (!_state) {
      throw new Error(
        `UseForm: Form with name ${formName} does not exist. Did you forget to initialize it?`
      );
    }
    return _state;
  }

  const transformedInitState = getInitState(initState);
  const formState = ref({
    ...transformedInitState,
    initialFields: cloneDeep(initState),
    context: options?.context ?? {},
  }) as Ref<InternalFormState<T>>;

  const values = computed(
    () =>
      Object.keys(formState.value.fields).reduce(
        (acc, key) => ({
          ...acc,
          [key]: formState.value.fields[key].value,
        }),
        {}
      ) as T
  );

  const returnValue = {
    formState: formState,
    values,
    context: formState.value.context,
    setRules: setRules<T>(formState),
    setFields: setFields<T>(formState),
    validateForm: validateForm<T>(formState),
    resetForm: resetForm<T>(formState),
    ...formState.value.fields,
  };

  if (formName) {
    store.value[formName] = returnValue;
  }

  (formState.value as any)[formRules] = createValidationObject(
    options?.formRules
  );

  Object.defineProperty(formState.value, "formRules", {
    set: function (newValidate) {
      (this as InternalFormState<T>)[formRules] = createValidationObject(
        newValidate
      ) as FormRule<T>[];
    },
    get: function () {
      return (this as InternalFormState<T>)[formRules];
    },
  });

  formState.value.dirty = false;
  formState.value.valid = true;
  formState.value.pending = false;
  formState.value.touched = false;
  formState.value.errors = [];
  formState.value.errorFields = {} as any;

  createFields(formState);

  const pendingArray = computed(() => {
    return [
      ...Object.values(formState.value.fields).map((field) => field.pending),
      formState.value.pending,
    ];
  });

  watch(pendingArray, () => {
    formState.value.pending = pendingArray.value.some((valid) =>
      Boolean(valid)
    );
  });

  watch(values, validationWatcher(formState), { deep: true });

  watch(
    () => formState.value.errors,
    (errors) => {
      const valid =
        (
          Object.values(formState.value.fields) as InternalField<
            T[keyof T],
            T
          >[]
        ).every((field) => field.valid) && errors.length === 0;
      formState.value.valid = valid;
    }
  );

  return returnValue;
}

export function setStore(ref: Ref) {
  store = ref;
}

export function getStore() {
  return store;
}

export function getInitState<T extends Record<string, unknown>>(
  initState: InitialFormState<T> | T
) {
  if (initState) {
    const initStateFields = Object.entries(initState).reduce(
      (acc, [key, value]) => {
        if (reservedKeys.includes(key)) {
          throw new Error(`UseForm: You cannot use the reserved key: ${key}`);
        }
        if (value?.hasOwnProperty("value")) {
          return {
            ...acc,
            [key]: { ...value },
          };
        } else {
          return { ...acc, [key]: { value } };
        }
      },
      {}
    );
    return { fields: initStateFields } as InternalFormState<T>;
  } else {
    throw new Error("UseForm: You must provide an initial state");
  }
}

export function setRules<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>
) {
  return function (
    values: Partial<
      {
        [P in keyof T]: (RuleFunction<T[P], T> | Rule<T[P], T>)[];
      } & {
        formRules: (FormRuleFunction<T> | FormRule<T>)[];
      }
    >
  ) {
    for (const [key, value] of Object.entries(values) as [keyof T, any[]][]) {
      if (key === "formRules") {
        formState.value.formRules = value;
        continue;
      }
      formState.value.fields[key].rules = value;
    }
  };
}

export function setFields<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>
) {
  return (
    values: Partial<{
      [P in keyof T]: T[P];
    }>,
    options?: { setDirty?: boolean; validate?: boolean }
  ) => {
    formState.value[formIgnoreValidation] = !(options?.validate ?? false);
    formState.value[formIgnoreDirty] = !(options?.setDirty ?? true);
    for (const [k, v] of Object.entries(values) as [keyof T, T[keyof T]][]) {
      formState.value.fields[k].value = v;
    }
    nextTick(() => {
      formState.value[formIgnoreDirty] = false;
    });
  };
}

export function setIsServer(value: boolean) {
  isServer = value;
}

export function resetField<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>,
  key: keyof T,
  field: InternalField<T[keyof T], T>
) {
  field.value = getInitState(cloneDeep(formState.value.initialFields)).fields[
    key
  ].value;

  field.dirty = false;
  field.errors = [];
  field.valid = true;
  field.name = key as string;
  field.dirty = false;
  field.touched = false;
  field.focused = false;
}

function resetForm<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>
) {
  return () => {
    formState.value[formIgnoreDirty] = true;
    formState.value[formIgnoreValidation] = true;
    formState.value[formValidationLock] = undefined;
    Object.entries(formState.value.fields).forEach(([k, v]) => {
      resetField(formState, k as keyof T, v);
    });
    formState.value.touched = false;
    formState.value.dirty = false;
    nextTick(() => {
      collectErrors(formState);
      formState.value[formIgnoreDirty] = false;
    });
  };
}
