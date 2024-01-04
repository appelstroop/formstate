import vue from "@vitejs/plugin-vue";
import * as path from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [vue(), dts()],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "VueFormState",
      fileName: "vue-formstate",
      
    },
    rollupOptions: {
      
      external: ["vue", '@nuxt/kit'],
      output: {
        inlineDynamicImports: false,
        globals: {
          vue: "Vue"
        }
      },
      // input: {
      //   entry: path.resolve(__dirname, "src/module.ts"),
      //   fileName: "module"
      // }
    }
  },
  resolve: {
    dedupe: [
      'vue'
    ],
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});