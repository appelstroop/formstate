import { beforeEach, describe, expect, test, vi } from "vitest";
import { Ref, nextTick, ref } from "vue";
import { InternalFormState, InternalField, formIgnoreDirty, Rule } from "../useForm";
import { createFields } from "./createFields";

const createMockFormState = (values: Record<string, any> = {}) => {
  return ref({
    fields: { someTextField: { value: "hello world" } },
    valid: false,
    dirty: false,
    errors: [],
    pending: false,
    errorFields: {},
    formRules: [],
    context: {},
   _internals:  {
    ignoreValidation: false,
    ignoreDirty: false,
   },
    initialFields: { someTextField: "hello world" },
    ...values,
  });
};

describe("createFields", () => {
  let formState: Ref<InternalFormState<{ someTextField: string }>>;
  beforeEach(() => {
    formState = createMockFormState() as any;
    createFields(formState);
  });
  test("works", () => {
    expect(formState.value.fields.someTextField).toMatchInlineSnapshot(`
      {
        "blur": [Function],
        "dirty": false,
        "errors": [],
        "focus": [Function],
        "focused": false,
        "name": "someTextField",
        "pending": false,
        "reset": [Function],
        "touched": false,
        "valid": true,
        "validate": [Function],
        "value": "hello world",
        Symbol(fieldRules): [],
        Symbol(fieldPrevValue): "hello world",
      }
    `);
  });
  test('sets "dirty" to true when value changes', async () => {
    const field = formState.value.fields.someTextField as InternalField<string,any>;
    field.value = "some new value";
    await nextTick();
    expect(field.dirty).toBe(true);
  });
  test('ignores "dirty" when ignoreDirty is true', async () => {
    const field = formState.value.fields.someTextField as InternalField<string,any>;
    formState.value[formIgnoreDirty] = true;
    field.value = "some new value";
    await nextTick();
    expect(field.dirty).toBe(false);
  });
  test('sets "touched" and "focused" to true when focus is called', async () => {
    const field = formState.value.fields.someTextField as InternalField<string,any>;
    field.focus({} as any);
    await nextTick();

    expect(field.focused).toBe(true);
  });
  test('sets "focused" to false when blur is called', async () => {
    const field = formState.value.fields.someTextField as InternalField<string, any>;
    field.blur({} as any);
    await nextTick();
    expect(field.focused).toBe(false);
    expect(field.touched).toBe(true);
    expect(formState.value.touched).toBe(true);
  });

  test("does get/set property on field rules", async () => {
    const field = formState.value.fields.someTextField as InternalField<string, any>;
    expect(field.valid).toBe(true);
    field.rules = [() => "some error"];
    expect(field.valid).toBe(true);
    expect(field).toMatchInlineSnapshot(`
      {
        "blur": [Function],
        "dirty": false,
        "errors": [],
        "focus": [Function],
        "focused": false,
        "name": "someTextField",
        "pending": false,
        "reset": [Function],
        "touched": false,
        "valid": true,
        "validate": [Function],
        "value": "hello world",
        Symbol(fieldRules): [
          {
            "rule": [Function],
          },
        ],
        Symbol(fieldPrevValue): "hello world",
      }
    `);

    expect(field.rules).toMatchInlineSnapshot(`
      [
        {
          "rule": [Function],
        },
      ]
    `);
    // verify that rule is set in array and is the right function
    expect(((field.rules)[0] as any).rule()).toBe("some error");
  });

  test("resets field", async () => {
    const field = formState.value.fields.someTextField as InternalField<string, any>;
    field.value = "some new value";
    field.focus({} as any);
    await nextTick();
    expect(field.dirty).toBe(true);
    expect(field.focused).toBe(true);
    field.reset();
    await nextTick();
    expect(field).toMatchInlineSnapshot(`
      {
        "blur": [Function],
        "dirty": false,
        "errors": [],
        "focus": [Function],
        "focused": false,
        "name": "someTextField",
        "pending": false,
        "reset": [Function],
        "touched": false,
        "valid": true,
        "validate": [Function],
        "value": "hello world",
        Symbol(fieldRules): [],
        Symbol(fieldPrevValue): "hello world",
      }
    `);
  });

  test("calls validation function with right params", async () => {
    const field = formState.value.fields.someTextField as InternalField<string, any>;
    const spy = vi.fn();
    field.rules = [spy];
    const results = await field.validate();
    expect(spy).toHaveBeenCalledWith("hello world", "someTextField", formState);
  });

});
