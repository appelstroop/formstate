// sum.test.js
import flushPromises from "flush-promises";
import { describe, expect, test, vi } from "vitest";
import { nextTick, watch } from "vue";
import { formValidationLock, getInitState, setIsServer, store, useForm } from "./useForm";



export const customSerializer = {
  test(val: any) {
    return (
      typeof val === "object" &&
      val !== null
    );
  },
  print(val: any) {
    return JSON.stringify(
      { ...val, [formValidationLock]: "random"  },
      null,
      2
    );
  },
};

expect.addSnapshotSerializer(customSerializer);

describe("useForm", () => {
  describe("Initial state", () => {
    test("sets initial state with short input", () => {
      const initState = {
        textInput: "hello",
        numberInput: 2,
      };
      expect(getInitState(initState)).toEqual({
        fields: { textInput: { value: "hello" }, numberInput: { value: 2 } },
      });
    });

    test("sets initial state with long input", () => {
      const validationFunction = () => "some error";
      const initState = {
        textInput: { value: "hello", validate: validationFunction },
        numberInput: { value: 2 },
      };
      expect(getInitState(initState)).toEqual({
        fields: {
          textInput: { value: "hello", validate: validationFunction },
          numberInput: { value: 2 },
        },
      });
    });

    test("raises error on initial state when a reserved keyword is used", () => {
      const initState = {
        formState: "hello",
      };
      try {
        getInitState(initState);
      } catch (error: any) {
        expect(error).toEqual(
          new Error("UseForm: You cannot use the reserved key: formState")
        );
      }
    });

    test("errors are empty when nothing return in validation function", () => {
      const { numberInput } = useForm({
        numberInput: { value: 2, rules: [() => {}] },
      });
      expect(numberInput.errors).toEqual([]);
    });

    test("useForm has proper initial state", () => {
      const { formState } = useForm({
        textInput: "hello",
        numberInput: { value: 2, rules: [() => "some error"] },
      });

      expect(formState.value).toMatchInlineSnapshot(`
        {
          "fields": {
            "textInput": {
              "value": "hello",
              "name": "textInput",
              "dirty": false,
              "touched": false,
              "valid": true,
              "focused": false,
              "errors": [],
              "pending": false
            },
            "numberInput": {
              "value": 2,
              "rules": [
                {}
              ],
              "name": "numberInput",
              "dirty": false,
              "touched": false,
              "valid": true,
              "focused": false,
              "errors": [],
              "pending": false
            }
          },
          "initialFields": {
            "textInput": "hello",
            "numberInput": {
              "value": 2,
              "rules": [
                null
              ]
            }
          },
          "context": {},
          "dirty": false,
          "valid": true,
          "pending": false,
          "touched": false,
          "errors": [],
          "errorFields": {}
        }
      `);
    });
  });

  describe("external watchers", () => {
    test("watch test", () => {
      const { someInput } = useForm({ someInput: "hallo" });
      watch(
        () => someInput.value,
        (value) => {
          expect(value).toEqual("hi");
        }
      );
      someInput.value = "hi";
    });
  });

  describe("useForm works with global state", () => {
    test("store is set", () => {
      setIsServer(false);
      const { someInput } = useForm("form", { someInput: "hallo" });
      expect(store).toBeDefined();
    });

    test("it shares state between useForm instances", () => {
      useForm("form", { someInput: "hallo" });
      const { someInput } = useForm<{ someInput: string }>("form");
      expect(someInput.value).toEqual("hallo");
    });
  });

  describe("validations", () => {
    test("setValidations", async () => {
      const { someInput, setRules, formState, validateForm } = useForm("form", {
        someInput: "",
      });

      const isRequired = (value: string) => (value === "" ? "required" : true);
      const isNumber = (value: string) =>
        typeof value !== "number" ? "not a number" : true;
      const formRule = () => {
        return "form validation error";
      };
      setRules({ someInput: [isRequired], formRules: [formRule] });
      await validateForm();
      expect(someInput.errors).toEqual(["required"]);
      expect(formState.value.errors).toEqual([
        "required",
        "form validation error",
      ]);

      setRules({ someInput: [isRequired, isNumber] });
      await validateForm();
      expect(someInput.errors).toEqual(["required", "not a number"]);

      someInput.value = "halloo";
      await flushPromises();
      expect(someInput.errors).toEqual(["not a number"]);
      expect(formState.value.errors).toEqual([
        "not a number",
        "form validation error",
      ]);
    });

    test("async validations work ", async () => {
      const { someInput, setRules, formState } = useForm("form", {
        someInput: "",
      });
      const asyncValidation = async (value: string) => "async error";
      const isRequired = (value: string) => (value === "" ? "required" : true);
      const isHallo = (value: string) =>
        value === "hallo" ? "hallo now allowed" : true;
      setRules({ someInput: [asyncValidation, isRequired, isHallo] });

      someInput.value = "hallo";
      await flushPromises();
      expect(someInput.errors).toEqual(["async error", "hallo now allowed"]);
    });

    test("async validateForm works", async () => {
      const { someInput, setRules, formState, validateForm } = useForm("form", {
        someInput: "",
      });
      const asyncValidation = async () => "async error";
      setRules({ formRules: [asyncValidation] });
      expect(formState.value.errors).toEqual([]);
      await validateForm();
      expect(formState.value.errors).toEqual(["async error"]);
    });

    test("handles manual validation", async () => {
      const { someInput, setRules, formState } = useForm("form", {
        someInput: "ja hoi",
      });
      const isRequired = (value: string) => (value === "" ? "required" : true);
      setRules({ someInput: [{ rule: isRequired }] });
      someInput.value = "";
      await flushPromises();

      expect(someInput.errors).toEqual(["required"]);
      someInput.errors = [];
      setRules({
        someInput: [{ rule: isRequired, autoValidate: false }],
      });
      await nextTick();
      expect(someInput.errors).toEqual([]);
      await someInput.validate();
      expect(someInput.errors).toEqual(["required"]);
    });

    test("ignores autovalidate false rules", async() => {
      const { someInput, setRules, formState } = useForm("form", {
        someInput: "hi",
      });

      setRules({
        someInput: [
          { rule: () => "required", autoValidate: false },
          async() => "other error",
        ],
      });
      someInput.value = '';
      await someInput.validate();
      expect(someInput.errors).toEqual(['other error'])
    });
  });

  describe("form reset", () => {
    test("form reset function works", async () => {
      const { someInput, setRules, resetForm, formState } = useForm("form", {
        someInput: "",
      });
      const isRequired = (value: string) => (value === "" ? "required" : true);
      const asyncValidation = async () => "async error";
      setRules({ someInput: [isRequired, asyncValidation] });
      someInput.focus("event" as any);
      someInput.value = "hallo";

      await nextTick();
      expect(formState.value.dirty).toBe(true);
      expect(someInput.dirty).toBe(true);
      expect(someInput.focused).toBe(true);
      expect(someInput.touched).toBe(false);
      someInput.blur("event" as any);
      await nextTick();
      expect(someInput.touched).toBe(true);
      await resetForm();
      await flushPromises();
      expect(formState.value.dirty).toBe(false);
      expect(formState.value.touched).toBe(false);
      expect(someInput.errors).toEqual([]);
      expect(someInput).toMatchInlineSnapshot(`
        {
          "value": "",
          "name": "someInput",
          "dirty": false,
          "touched": false,
          "valid": true,
          "focused": false,
          "errors": [],
          "pending": false
        }
      `);
      expect(formState.value).toMatchInlineSnapshot(`
        {
          "fields": {
            "someInput": {
              "value": "",
              "name": "someInput",
              "dirty": false,
              "touched": false,
              "valid": true,
              "focused": false,
              "errors": [],
              "pending": false
            }
          },
          "initialFields": {
            "someInput": ""
          },
          "context": {},
          "dirty": false,
          "valid": true,
          "pending": false,
          "touched": false,
          "errors": [],
          "errorFields": {}
        }
      `);
    });
  });
});
