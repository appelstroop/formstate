import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  collectErrors,
  createInternalValidationResults,
  processValidationObject,
  validateInternal,
} from "./validation";
import {
  InternalField,
  InternalFormState,
  InternalRule,
  Rule,
  useForm,
} from "../useForm";
import { Ref } from "vue";

describe("validation", () => {
  test("createInternalValidationResults", () => {
    expect(createInternalValidationResults("some error")).toEqual({
      valid: false,
      errors: ["some error"],
    });
    expect(createInternalValidationResults(["some error"])).toEqual({
      valid: false,
      errors: ["some error"],
    });
    expect(
      createInternalValidationResults(["some error", { someOther: "error" }])
    ).toEqual({
      valid: false,
      errors: ["some error", { someOther: "error" }],
    });
    expect(createInternalValidationResults(false)).toEqual({
      valid: false,
      errors: ["not valid"],
    });
    expect(createInternalValidationResults(true)).toEqual({
      valid: true,
      errors: [],
    });
    expect(createInternalValidationResults(undefined)).toEqual({
      valid: true,
      errors: [],
    });
    expect(createInternalValidationResults(["some error", undefined])).toEqual({
      valid: false,
      errors: ["some error"],
    });
    expect(createInternalValidationResults(null)).toEqual({
      valid: true,
      errors: [],
    });
  });

  describe("processValidationObject", () => {
    const spy = vi.fn().mockReturnValue("some error");
    let rule: Rule<any, any>;

    beforeEach(() => {
      spy.mockClear();
      rule = {
        rule: spy,
        autoValidate: true,
      };
    });

    test("calls validation with proper arguments", () => {
      const result = processValidationObject(
        rule,
        ["arg1", "arg2"],
        true,
        false
      );
      expect(spy).toHaveBeenCalledWith("arg1", "arg2");
      expect(result).toBe("some error");
    });

    test("calls validation when rule autovalidate is false and should validate is true", () => {
      rule.autoValidate = false;
      const result = processValidationObject(
        rule,
        ["arg1", "arg2"],
        true,
        false
      );
      expect(spy).toHaveBeenCalledWith("arg1", "arg2");
      expect(result).toBe("some error");
    });
    test("it doesnt call validation when both rule autovalidate is false and should validate is false", () => {
      rule.autoValidate = false;
      const result = processValidationObject(
        rule,
        ["arg1", "arg2"],
        false,
        false
      );
      expect(spy).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    test("doesnt call validation when rule is undefined", () => {
      (rule.rule as any) = undefined;
      processValidationObject(rule, ["arg1", "arg2"], true, false);
      expect(spy).not.toHaveBeenCalled();
    });

    test("calls validation when rule is async function and promise is true", () => {
      const spy = async () => "some error";
      rule.rule = spy;
      const result = processValidationObject(
        rule,
        ["arg1", "arg2"],
        true,
        true
      );
      expect(result).toBeInstanceOf(Promise);
    });
    test("doesnt call validation when rule is async function and promise is false", () => {
      const spy = async () => "some error";
      rule.rule = spy;
      const result = processValidationObject(
        rule,
        ["arg1", "arg2"],
        true,
        false
      );
      expect(result).toBeUndefined();
    });
    test("calls validation when rule returns promise and promise is true", () => {
      const spy = () =>
        new Promise((resolve) => {
          resolve("some error");
        });
      rule.rule = spy;
      const result = processValidationObject(
        rule,
        ["arg1", "arg2"],
        true,
        true
      );
      expect(result).toBeInstanceOf(Promise);
    });

    test("calls validation when rule returns promise and promise is true", () => {
      const spy = () =>
        new Promise((resolve) => {
          resolve("some error");
        });
      rule.rule = spy;
      const result = processValidationObject(
        rule,
        ["arg1", "arg2"],
        true,
        false
      );
      expect(result).toBeUndefined();
    });
  });

  describe("validateInternal", () => {
    test("validateInternal returns valid if rule is undefined", async () => {
      const result = validateInternal(undefined);
      expect(result).toEqual({ valid: true, errors: [] });
      const results2 = await validateInternal(undefined, [], { promise: true });
      expect(results2).toEqual({ valid: true, errors: [] });
    });
    test("validateInternals validates sync rules", async () => {
      const spy = vi.fn().mockReturnValue("some error");
      const asyncSpy = vi.fn().mockResolvedValue("other error");
      const rule = {
        rule: spy,
      } as InternalRule<any>;
      const result = validateInternal([rule], [1, 2]);
      expect(spy).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual({ valid: false, errors: ["some error"] });
      const rule2 = {
        rule: asyncSpy,
      } as InternalRule<any>;
      const result2 = validateInternal([rule, rule2]);
      expect(result2).toEqual({ valid: false, errors: ["some error"] });
      const result3 = await validateInternal([rule, rule2], [1, 2], {
        promise: true,
      });
      expect(result3).toEqual({
        valid: false,
        errors: ["some error", "other error"],
      });
      expect(spy).toHaveBeenCalledWith(1, 2);
      expect(asyncSpy).toHaveBeenCalledWith(1, 2);
    });

    describe("collectErrors", () => {
      let formState: Ref<InternalFormState<any>>;
      let input1: InternalField<any, any>;
      let input2: InternalField<any, any>;
      beforeEach(() => {
        const use = useForm({
          input1: "hello",
          input2: "world",
        });
        formState = use.formState as any;
        input1 = use.input1 as any;
        input2 = use.input2 as any;
      });

      test("valid and no errors when fields have no errors", () => {
        const result = collectErrors(formState, {
          valid: true,
          errors: [],
        });
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
        expect(result.errorFields).toEqual({});
      });

      test("invalid and errors when fields have errors", () => {
        input1.errors = ["error1", "error2"];
        input1.valid = false;
        input2.valid = false;
        input2.errors = ["error3"];
        const result = collectErrors(formState, {
          valid: true,
          errors: [],
        });
        expect(result.errors).toEqual(["error1", "error2", "error3"]);
        expect(result.valid).toBe(false);
        expect(result.errorFields).toEqual({
          input1: ["error1", "error2"],
          input2: ["error3"],
        });
      });

      test("invalid and errors form errors present", () => {
        const result = collectErrors(formState, {
          valid: false,
          errors: ["formError"],
        });
        expect(result.errors).toEqual(["formError"]);
        expect(result.valid).toBe(false);
        expect(result.errorFields).toEqual({});
      });

      test("combines errors from fields and form", () => {
        input1.errors = ["error1"];
        input1.valid = false;
        const result = collectErrors(formState, {
          valid: false,
          errors: ["formError"],
        });
        expect(result.errors).toEqual([ "error1", "formError"]);
        expect(result.valid).toBe(false);
        expect(result.errorFields).toEqual({ input1: ["error1"]});
      });
    });
  });
});
