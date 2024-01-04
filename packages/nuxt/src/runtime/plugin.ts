import { defineNuxtPlugin, useState } from "#app";
import { setStore, getStore } from "@formstate/core";

export default defineNuxtPlugin((nuxtApp) => {
  setStore(useState(() => ({})));

  nuxtApp.hook("app:rendered", () => {
    getStore().value = {};
  });
});
