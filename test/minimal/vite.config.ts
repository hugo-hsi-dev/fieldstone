import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { fieldstone } from '@fieldstone/vite-plugin';

export default defineConfig(() => {
	return {
		// Pre-bundle the Better Auth client at dev-server start. Otherwise Vite discovers
		// and optimizes it on the first /login interaction and force-reloads the page,
		// which can interrupt the sign-in redirect on a cold CI runner (flaky auth e2e).
		optimizeDeps: {
			include: ['better-auth/svelte']
		},
		plugins: [
			fieldstone({
				db: {
					dialect: 'sqlite',
					url: 'local.db'
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
						include: [...config.include, '../.fieldstone/types.d.ts']
					})
				}
			})
		]
	};
});
