<template>
  <input v-model="hallo.value" />
  {{ hallo.errorMessages }}
</template>

<script setup lang="ts">
import { useForm } from "@formstate/core";

const { hallo, setValidations } = useForm({ hallo: "doei" });

setValidations({
  hallo: (value) => {
    if (value === "hoi") {
      return ["hoi is niet toegestaan"];
    }
  },
});
</script>
