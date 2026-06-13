import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';
import { fieldstone } from '@fieldstone/vite-plugin';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const databaseURL = env.DATABASE_URL ?? process.env.DATABASE_URL ?? 'local.db';

	return {
		plugins: [
			tailwindcss(),
			fieldstone({
				db: {
					dialect: 'sqlite',
					url: databaseURL
				}
			}),
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
					experimental: { async: true }
				},

				// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
				// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
				// See https://svelte.dev/docs/kit/adapters for more information about adapters.
				adapter: adapter(),

				experimental: {
					remoteFunctions: true,
					handleRenderingErrors: true,
					forkPreloads: true
				},
				typescript: {
					config: (config) => ({
						...config,
						include: [...config.include, '../drizzle.config.ts', '../.fieldstone/types.d.ts']
					})
				}
			})
		],
		test: {
			expect: { requireAssertions: true },
			projects: [
				{
					extends: './vite.config.ts',
					test: {
						name: 'client',
						browser: {
							enabled: true,
							provider: playwright(),
							instances: [{ browser: 'chromium', headless: true }]
						},
						include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
						exclude: ['src/lib/server/**']
					}
				},

				{
					extends: './vite.config.ts',
					test: {
						name: 'server',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
					}
				}
			]
		}
	};
});
