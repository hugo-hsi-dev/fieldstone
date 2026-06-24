import path from 'node:path';
import { svelteKitConfig } from '@hugo-hsi-dev/eslint-config';

const gitignorePath = path.resolve(import.meta.dirname, '../../.gitignore');

export default svelteKitConfig({
	gitignorePath,
	tsconfigRootDir: import.meta.dirname,
	rules: {
		'svelte/no-navigation-without-resolve': 'off'
	}
});
