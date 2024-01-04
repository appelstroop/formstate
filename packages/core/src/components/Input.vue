<template>
  <textarea
    v-if="type === 'textarea'"
    v-model="_input.value"
    @focus="input.focus"
    @blur="input.blur"
  ></textarea>
  <select
    v-else-if="type === 'select'"
    v-model="input.value"
    @focus="input.focus"
    @blur="input.blur"
  >
    <slot />
  </select>
  <input
    v-else-if="type === 'file'"
    :type="type"
    @focus="input.focus"
    @blur="input.blur"
    :value="value"
  />
  <input
    v-else-if="value"
    :type="type"
    v-model="input.value"
    @focus="input.focus"
    @blur="input.blur"
    :value="value"
  />

  <input
    v-else
    :type="type"
    v-model="input.value"
    @focus="input.focus"
    @blur="input.blur"
  />
</template>

<script lang="ts" setup generic="T extends unknown">
import { defineProps } from "vue";
import type { Field } from "../composables/useForm";
import { useAttrs, watch } from "vue";

interface Props {
  type:
    | "checkbox"
    | "color"
    | "date"
    | "datetime-local"
    | "email"
    | "file"
    | "hidden"
    | "image"
    | "month"
    | "number"
    | "password"
    | "radio"
    | "range"
    | "search"
    | "tel"
    | "text"
    | "time"
    | "url"
    | "week"
    | "textarea"
    | "select";
  input: Field<T, any>;
  validate?: Field<T, any>["validate"];
  value?: string;
}

const props = defineProps<Props>();
const _input = props.input as any;
if (props.validate) {
  props.input.validate = props.validate;
}

const { type: _type, ...attrs } = useAttrs();
</script>

<style></style>
