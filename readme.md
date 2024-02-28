# formstate

formstate is a small vue3 library that makes it easy to handle your form state and perform validations. It features:

- A small footprint (2.7kb gzip)
- No tight coupling with inputs, you have all the liberty to build your own inputs
- Full Typescript support, with returned fields typed based on your initial state
- Easy zod or other validation libraries support
- You can directly manipulate your field values (e.g. value, dirty, focused etc)
- Shared state of useForm -> you can reuse the same form in another component by naming your form
- Async validation support
- Custom error objects, you can return any object from a validation rule

# Installation

For a vue 3 project:

```sh
npm install @formstate/core
yarn add @formstate/core
pnpm add @formstate/core
```

For nuxt:

```sh
npm install @formstate/core @formstate/nuxt
yarn add @formstate/core @formstate/nuxt
pnpm add @formstate/core @formstate/nuxt
```

And add the @formstate/nuxt package to your modules in nuxt.config.ts:

```typescript
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ["@formstate/nuxt"],
});
```

# Usage

```typescript
<script lang="ts" setup>
import { useForm } from "@formstate/core";

const { someText, formState } = useForm({
  someText: "initial value",
});

</script>

<template>
  <input type="text" v-model="someText.value" />
</template>
```

```typescript
  <div>Input is dirty: {{ someText.dirty }}</div>
  <div>Input is valid: {{ someText.valid }}</div>
  <div>Complete state: {{ formState }}</div>

```

The formState ref contains the complete state of the form:

```typescript
console.log(formState.value)

// result:
 {
      "context": {},
      "dirty": false,
      "fields": {
        "someText": {
          "blur": [Function],
          "dirty": false,
          "errors": [],
          "focus": [Function],
          "focused": false,
          "name": "someText",
          "pending": false,
          "reset": [Function],
          "touched": false,
          "valid": true,
          "validate": [Function],
          "value": "initial value",
        },
      },
      "initialFields": {
        "numberInput": {
          "rules": [Function],
          "value": 2,
        },
        "someText": "hello",
      },
      "pending": false,
      "touched": false,
      "valid": true,
    }
```

We can also get all the inputs with their values from the form as a ref:

```typescript
const { values } = useForm({
  someText: "initial value",
  checkboxes: ["Jack"],
});

console.log(values.value);
// output: { "someText": "initial value", "checkbox": ["Jack"] }
```

# Validation

## Rules

Anything you return from a rule function means that the field is invalid. If you return nothing, undefined or false, it will be considered valid.

```typescript
// if you false, it will generate an error message of required
const isRequired = (value: string) => !!value;

function rule(value: string, fieldName: string) {
  if (value.length > 5) {
    return "requires more than 5 characters";
  }
  // or return array
  if (value.length > 5) {
    return ["requires more than 5 characters", "some other error"];
  }

  // or any custom object
  if (value.length > 5) {
    return { error: "requires more than 5 characters", code: "too short" };
  }
}

// or do something like this
function rule(value: string) {
  let errors: string[] = [];
  if (value.length < 5) {
    errors.push("min 5 chars");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push("invalid email");
  }
  return errors;
}
```

We can use the _setRules_ function to add rules in one go:

```typescript
const { someRadio, someTextInput, formState, setRules } = useForm({
  someText: ""
  someRadio: "John",
});


setRules( {
  someTextInput: [isRequired, validateIfJohn],
  someRadio: [validateIfJohn],
});
```

You can also set the rules directly on the fields:

```typescript
import { isRequired, isNotJohn } from '../some-validations'

const { someRadio } = useForm({
  someText: ""
  someRadio: "John",
});

someText.rules = [isRequired, isNotJohn]


</script>

<template>
  <label for="John">John</label>
  <input id="John" type="radio" v-model="someRadio.value" value="John" />
  <label for="John">Jack</label>
  <input id="Jack" type="radio" v-model="someRadio.value" value="Jack" />

  <div>Error messages: {{ someRadio.errors }}</div>
</template>

```

## Adding a rule later on

We can add a rule later on as well:

```typescript
// set a new array on .rules, push doesnt work
someText.rules = [...someText.rules, someOtherValidation];
```

## When are rules validated?

- If no rule is present, the field is considered valid
- By default rules are validated when a field value changes
- You can customize when a validation is performed, see // TODO add link to custom validation behaviour

## Cross field validation and validating complete form

Sometimes we want to validate a group of fields, or have rules depend on each other. You can set the _formRules_ property on the formState object to do this. Form rules work in addition
to field rules and produce extra errors.

```typescript
const formRule = () => {
  if (someTextInput.value === "John" && someRadio.value === "John") {
    return "John is not allowed on both fields";
  }
};

formState.value.formRules = [formRule];

// or

setRules({
  someTextInput: [required],
  formRules: [formRule],
});
```

## Zod (or other validation libraries)

Because validations are just simple functions, you can use any validation library you'd like

```typescript
const MyFormValidation = z.object({
  someTextInput: z.string().min(1),
  someRadio: z.string(),
  someRange: z.union([z.string(), z.number()]),
});

type MyForm = z.infer<typeof MyFormValidation>;

// formState type is defered from zod
const { formState, setRules } = useForm<MyForm>({
  someTextInput: "",
  someRadio: "John",
  someRange: 5,
});

const zodValidation = (value: unknown, name: string) => {
  // we pick the value from zod, as we don't want to validate whole formstate
  const result = ZodType.pick({ [name]: true }).safeParse({ [name]: value });
  if (!result.success) {
    return result.error.errors;
  }
};

setRules({
  someTextInput: [zodValidation],
  someRadio: [zodValidation],
  someRange: [zodValidation],
});
```

## Async validation

formstate has async validation built in. You can add an async function to a field or use async validation as a form rule.

```typescript
const userNameExists = async (value: string) => {
  const exists = await callToApi(value);
  if (exists) {
    return "Username already exists";
  }
};

setRules({ username: [userNameExists] });
```

### Debounce async validation

Most often don't want to do a request on each change of a text field, as it would mean many calls to your api. You can debounce a rule, as long as the rule always returns a promise.

```typescript
import debounce from "debounce-promise";

const someAsyncValidation = debounce(async (value: string) => {
  // if length is less than 5 characters, don't do a request
  if (value.length < 5) {
    return "username should be longer than 5 characters";
  }

  const exists = await callToApi(value);
  if (exists) {
    return "Username already exists";
  }
}, 500);

setRules({ username: [someAsyncValidation] });
```

## Turning off autovalidation

By default, validations on a field are performed when the field value changes. You can turn off this behaviour and write your own implementation when validation is performed:

```typescript
setRules({
  someTextInput: [{ rule: someAsyncValidation, autoValidate: false }],
});

watch(
  () => someTextInput.focused,
  async () => {
    if (!someTextInput.focused) {
      await someTextInput.validate();
    }
  }
);
```

## Using lazy v-model

TODO

# Changing field and form values

## Field values

```typescript
const { someText, setFields } = useForm({
  someText: "",
});

// editing .value will change dirty state and perform validation
someText.value = "hello world!";

// using setFields function will not change dirty or perform validation
setFields({ someText: "hello world!" });

// you can also change this behavior:
setFields({ someText: "hello world!" }, { setDirty: true, validate: true });

// other values can also be changed
someText.dirty = true;
someText.touched = true;
someText.focused = true;
someText.pending = true;
someText.valid = true;
```

## Form values

```typescript
const { formState } = useForm({
  someText: "",
});

formState.value.dirty = true;
formState.value.pending = true;
formState.value.touched = true;
formState.value.valid = true;
```

# Populating async data

Often we would like to populate a form from an async request. The easiest way is to wrap the component were the form is located in a Suspense and async/await for the data:

```typescript
const data: ResponseType = await anAsyncRequest();

const { someInput } = useForm(data);
```

We can also use the _setFields_ function to later update the data

```typescript
const { numberInput, textInput, setFields } = useForm({
  numberInput: 0,
  textInput: "",
});

onMounted(async () => {
  // data would be something like { numberInput: 6, textInput: 'hello world' }
  const data: ResponseType = await anAsyncRequest();
  setFields(data);
});
```

# Adding focus and blur functions

Every input has touched and boolean properties. But in order to automatically update these properties we need to attach the input events to the formState. Note that in some browsers (looking at you safari), some types of inputs (e.g. radio) do not trigger the focus events.

```typescript
<script lang="ts" setup>
import { useForm, Input } from "@formstate/core";

const { someText } = useForm({
  someText: "initial value",
});

</script>

<template>
  <input
    type="text"
    v-model="someText.value"
    @focus="someText.focus"
    @blur="someText.blur"
  />

  <div>Input is focused: {{ someText.focused }}</div>
  <div>Input has been touched: {{ someText.touched }}</div>
</template>

```

# Submitting

Submitting your form can be as simple as:

```typescript
const { values } = useForm({ someTextInput: "hello" });

async function submit() {
   const { valid, errors, errorFields } = await validateForm();
   if (valid) {
      await yourPostRequest(values);
   }
}
<template>
 <button @click="sumbit">Submit</button>
</template>
```

Or you can choose to use the \<form> element:

```typescript

<template>
 <form @submit.prevent="sumbit">
    <button>Submit</button>
  </form>
</template>
```

# Reset form and fields

To reset the complete form to its initial state, you can use the resetForm function:

```typescript
const { resetForm } = useForm({ someText: "" });

<template>
  <button @click="resetForm">Reset form</button>
</template>
```

## Reset individual fields

```typescript
const { someText } = useForm({ someText: "" });

<template>
  <button @click="someText.reset">Reset text field</button>
</template>
```

# Array values

## Using array values in formstate

In order to dynamically create form elements you can add an array as input

```typescript
  const { someArray } = useForm({
    someArray: [
    { name: "somename", email: "" },
    { name: "", email: "" },
  ]});

  <fieldset v-for="(v, i) of someArray.value" :key="i">
    <legend>array</legend>
    <input
      type="text"
      v-model="v.name"
    />
    <input
      type="text"
      v-model="v.email"
    />
  </fieldset>

```

## Adding and removing array values

You can directly modify the array (push, pop). But in order to not directly trigger validation everytime, it is better to update using the _setFields_ function.

```typescript
function addToArray() {
  setFields({
    someArray: [...someArray.value, { name: "", email: "" }],
  });
}
function remove(index: number) {
  setFields({
    someArray: someArray.value.filter((_, i) => i !== index),
  });
}

 <fieldset v-for="(v, i) of someArray.value" :key="i">
    <legend>array</legend>
    <input
      type="text"
      v-model="v.name"
    />
    <input
      type="text"
      v-model="v.email"
    />
    <button @click="remove(i)">Remove</button>
  </fieldset>


<button @click="addToArray">Add to array</button>
```

## Validating array fields

```typescript
const ZodType = z.object({
  someArray: z.array(
    z.object({
      name: z.string().min(3),
      email: z.string().email(),
    })
  ),
});

const zodValidation = (value: unknown, name: string) => {
  // we pick the value from zod, as we don't want to validate whole formstate
  const result = ZodType.pick({ [name]: true }).safeParse({ [name]: value });
  if (!result.success) {
    return result.error.errors;
  }
};

setRules({
  someArray: [zodValidation],
});

<fieldset v-for="(v, i) of someArray.value" :key="i">
  <legend>array</legend>
  <input
    type="text"
    v-model="v.name"
    :class="{
      invalid: someArray.errors.filter((e) => e.path[1] === i && e.path[2] === 'name').length > 0,
    }"
  />
  <input
    type="text"
    v-model="v.email"
    :class="{
      invalid: someArray.errors.filter((e) => e.path[1] === i && e.path[2] === 'email').length > 0,
    }"
  />
</fieldset>
```

# Reusing form

Formstate is built to reuse your form logic in different components! Simply add add a name to your form. 
If you use a form in another component and you want to infer types automatically, you should add add a
type for the form structure:

```typescript

// App.vue
import { useForm } from "@formstate/core";

const { someText, formState } = useForm('my-form', {
  someText: "initial value",
});


// SomeComponent.vue

type Form = {
  someText: string;
};

const { someText } = useForm<Form>('my-form')


```
