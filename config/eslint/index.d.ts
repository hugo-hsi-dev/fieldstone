import type { Linter } from 'eslint';

export interface SvelteKitConfigOptions {
  gitignorePath?: string;
  rules?: Linter.RulesRecord;
  tsconfigRootDir?: string;
}

export declare function svelteKitConfig(
  options?: SvelteKitConfigOptions
): Linter.Config[];
