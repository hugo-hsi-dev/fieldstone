import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      $fields: path.resolve("src/fields.ts"),
    },
  },
});
