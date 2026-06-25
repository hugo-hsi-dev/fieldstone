import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import ts from "typescript-eslint";

export function svelteKitConfig({
  gitignorePath,
  rules = {},
  tsconfigRootDir,
} = {}) {
  const parserOptions = tsconfigRootDir ? { tsconfigRootDir } : {};
  const configs = [
    {
      languageOptions: {
        parserOptions,
      },
    },
    js.configs.recommended,
    ts.configs.recommended,
    svelte.configs.recommended,
    prettier,
    svelte.configs.prettier,
    {
      languageOptions: {
        parserOptions,
      },
      rules: {
        // typescript-eslint recommends disabling no-undef for TypeScript projects.
        "no-undef": "off",
      },
    },
    {
      files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
      languageOptions: {
        parserOptions: {
          ...parserOptions,
          projectService: true,
          extraFileExtensions: [".svelte"],
          parser: ts.parser,
        },
      },
    },
    {
      rules,
    },
  ];

  if (gitignorePath) {
    configs.unshift(includeIgnoreFile(gitignorePath));
  }

  return defineConfig(...configs);
}
