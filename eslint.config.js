import path from "node:path";
import { svelteKitConfig } from "./eslint.shared.js";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

const packageTsFiles = [
  "packages/admin-runtime/**/*.{js,ts}",
  "packages/cli/**/*.{js,ts}",
  "packages/codegen/**/*.{js,ts}",
  "packages/compiler/**/*.{js,ts}",
  "packages/runtime/**/*.{js,ts}",
  "packages/schema/**/*.{js,ts}",
  "packages/vite-plugin/**/*.{js,ts}",
];

export default [
  // CLI scaffold templates are copied verbatim into a host app; they reference that
  // app's $app/$lib aliases, so they aren't linted here.
  { ignores: ["packages/cli/templates/**"] },
  ...svelteKitConfig({
    gitignorePath,
    tsconfigRootDir: import.meta.dirname,
  }),
  {
    files: packageTsFiles,
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
  {
    files: ["packages/ui/**/*.svelte"],
    rules: {
      "svelte/no-navigation-without-resolve": "off",
    },
  },
];
