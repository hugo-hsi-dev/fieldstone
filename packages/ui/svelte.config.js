import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	// Strip TS from `<script lang="ts">` when svelte-package emits the library so the
	// shipped `.svelte` files don't require the consumer to preprocess TypeScript.
	preprocess: vitePreprocess(),
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};
