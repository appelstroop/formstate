import { Ref } from "vue";
import {
  InternalFormState,
  InternalField,
  InternalRule,
  InternalValidationResult,
  RuleFunction,
  fieldRules,
  fieldPrevValue,
  formIgnoreValidation,
  formValidationLock,
} from "../useForm";
import { generateRandomId } from "../../utils/randomId";
import { createValidationObject } from "./createFields";
import { cloneDeep } from "../../utils/cloneDeep";
import { deepEqual } from "../../utils/deepEqual";

export function validateField<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>,
  field: InternalField<T[keyof T], T>
) {
  return async function (validationFunction?: RuleFunction<T[keyof T], T>[]) {
    const rules = validationFunction
      ? createValidationObject(validationFunction)
      : field[fieldRules] ?? [];

    const { validationLockId, validate } =
      createValidateFieldFunction(formState);
    formState.value.pending = true;
    const validationResult = await validate(field, rules, validationLockId, {
      promise: true,
      alwaysValidate: true,
    });

    await validateFormInternal(formState)({ promise: true });
    formState.value.pending = false;
    return validationResult;
  };
}

export function validateForm<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>
) {
  return async function () {
    const { validationLockId, validate } =
      createValidateFieldFunction(formState);

    const promise = async (field: InternalField<T[keyof T], T>) => {
      await validate(field, field[fieldRules] ?? [], validationLockId, {
        promise: true,
        alwaysValidate: true,
      });
    };
    formState.value.pending = true;
    await Promise.all(getAllFields(formState).map(promise));

    const result = await validateFormInternal(formState)({ promise: true });
    formState.value.pending = false;
    return result;
  };
}

function getAllFields<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>
) {
  let fields = Object.values(formState.value.fields).filter(
    (field) =>
      !(
        Array.isArray(field) &&
        field.every((item) => typeof item === "object" && item !== null)
      )
  );
  fields = [
    ...fields,
    ...Object.values(formState.value.fields)
      .filter(
        (field) =>
          Array.isArray(field) &&
          field.every((item) => typeof item === "object" && item !== null)
      )
      .flatMap((field) => field)
      .map((field) => Object.values(field))
      .flatMap((field) => field),
  ];
  return fields;
}

export function validationWatcher<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>
) {
  return async () => {
    const fields = getAllFields(formState);
    const { validate, validationLockId } =
      createValidateFieldFunction(formState);

    // compare two array on which keys are unequal
    const unequalValues = fields.filter((field) => {
      if (!Array.isArray(field.value) || typeof field.value !== "object") {
        return field.value !== field[fieldPrevValue];
      }
      return !deepEqual(cloneDeep(field.value), field[fieldPrevValue]);
    });

    const promise = async (field: InternalField<T[keyof T], T>) => {
      // save prev value, as vue doesnt give back old values in watch if we change a deep object or array
      field[fieldPrevValue] = cloneDeep(field.value);
      if (formState.value[formIgnoreValidation]) {
        return;
      }
      await validate(field, field[fieldRules] ?? [], validationLockId, {
        promise: true,
        alwaysValidate: false,
      });
    };

    formState.value.pending = true;
    await Promise.all(unequalValues.map(promise));
    await validateFormInternal(formState)({ promise: true });
    formState.value.pending = false;
    formState.value[formIgnoreValidation] = false;
  };
}

export function createValidateFieldFunction<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>
) {
  const id = generateRandomId();
  formState.value[formValidationLock] = id;

  const validate = async (
    field: InternalField<T[keyof T], T>,
    rules: InternalRule<T[keyof T]>[],
    validationLockId: string,
    options: { promise?: boolean; alwaysValidate?: boolean }
  ) => {
    field.pending = true;

    const validationResult = await validateInternal(
      rules,
      [field.value, field.name, formState],
      options
    );

    // if the validationLock id doesnt match, it means another validation has
    // been trigger later
    if (formState.value[formValidationLock] === validationLockId) {
      field.valid = validationResult.valid;
      field.errors = validationResult.errors;
    }
    field.pending = false;
    return validationResult;
  };

  return { validate, validationLockId: id };
}

export function validateFormInternal<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>
) {
  return (options?: { promise: boolean }) => {
    const promise = options?.promise ?? false;
    if (formState.value[formIgnoreValidation]) {
      return { valid: true, errors: [], errorFields: {} };
    }
    formState.value.pending = true;

    const _isFormValid = validateInternal(
      formState.value.formRules as any,
      [formState],
      { promise }
    );

    const cb = (validationResults: InternalValidationResult) => {
      return collectErrors(formState, validationResults);
    };

    if (promise) {
      return (_isFormValid as Promise<InternalValidationResult>).then(cb);
    }

    return cb(_isFormValid as InternalValidationResult);
  };
}

export function collectErrors<T extends Record<string, unknown>>(
  formState: Ref<InternalFormState<T>>,
  validationResults?: InternalValidationResult
) {
  const fields = getAllFields(formState);
  const valid =
    (fields as InternalField<T[keyof T], T>[]).every((field) => field.valid) &&
    (validationResults?.valid ?? true);

  const errors = [
    ...(fields as InternalField<T[keyof T], T>[]).flatMap(
      (field) => field.errors ?? []
    ),
    ...(validationResults?.errors ?? []),
  ];
  formState.value.errors = errors;

  const errorFields = Object.keys(formState.value.fields).reduce((acc, key) => {
    if (!formState.value.fields[key].valid) {
      return {
        ...acc,
        [key]: formState.value.fields[key].errors,
      };
    } else {
      return acc;
    }
  }, {}) as { [P in keyof T]: string[] };

  formState.value.errorFields = errorFields;
  return { valid, errors, errorFields };
}

export function validateInternal<K extends unknown>(
  obj: InternalRule<K>[] | undefined,
  validateFnArguments: K[] = [],
  options?: {
    promise?: boolean;
    alwaysValidate?: boolean;
  }
) {
  const promise = options?.promise ?? false;
  if (!obj) {
    if (promise) {
      return Promise.resolve({ valid: true, errors: [] });
    }
    return { valid: true, errors: [] };
  } else {
    const validationResults = obj
      .map((v) =>
        processValidationObject(
          v,
          validateFnArguments,
          options?.alwaysValidate ?? false,
          promise
        )
      )
      .flat();
    if (promise) {
      return validationPromise(validationResults);
    }
    return createInternalValidationResults(validationResults.flat());
  }
}

export function processValidationObject<K extends unknown>(
  rule: InternalRule<K>,
  callArguments: K[],
  shouldValidate: boolean,
  promise: boolean
) {
  // autovalidation should trigger when autoValidate is false and shouldValidate is false
  const noAutoValidation = !(rule.autoValidate ?? true) && !shouldValidate;
  // if promise is false and the validation is a promise, don't validate
  const noPromiseValidation =
    rule.rule?.constructor.name === "AsyncFunction" && !promise;

  if (!rule.rule || noAutoValidation || noPromiseValidation) {
    return undefined;
  }

  // when normal function returns a promise
  const result = rule.rule(...callArguments);
  if (result instanceof Promise && !promise) {
    return undefined;
  }

  return rule.rule(...callArguments);
}

export function createInternalValidationResults(
  errors: unknown
): InternalValidationResult {
  const mapErrors = (e: unknown) => {
    if (e === false) {
      return "not valid";
    }
    if (e === true) {
      return undefined;
    }
    return e;
  };
  const errorFilter = (e: unknown) => e !== undefined && e !== null;
  const _errors = Array.isArray(errors)
    ? errors.map(mapErrors).filter(errorFilter)
    : [errors].map(mapErrors).filter(errorFilter);
  return {
    valid: !_errors?.length,
    errors: _errors ?? [],
  };
}

export function validationPromise(validation: unknown[]) {
  return Promise.all(validation)
    .then((result) => {
      return createInternalValidationResults(result.flat());
    })
    .catch(() => {
      return createInternalValidationResults([]);
    });
}
