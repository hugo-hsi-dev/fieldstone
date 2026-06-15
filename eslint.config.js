import path from "node:path";
import { svelteKitConfig } from "./config/eslint/index.js";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

const oxlintPackages = [
  "packages/admin-runtime/**/*.{js,ts}",
  "packages/cli/**/*.{js,ts}",
  "packages/codegen/**/*.{js,ts}",
  "packages/compiler/**/*.{js,ts}",
  "packages/remotes/**/*.{js,ts}",
  "packages/routes/**/*.{js,ts}",
  "packages/runtime/**/*.{js,ts}",
  "packages/schema/**/*.{js,ts}",
  "packages/vite-plugin/**/*.{js,ts}",
];

export default [
  ...svelteKitConfig({
    gitignorePath,
    tsconfigRootDir: import.meta.dirname,
  }),
  {
    files: oxlintPackages,
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
