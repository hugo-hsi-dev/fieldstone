import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command:
			'rm -f local.db auth.db && BETTER_AUTH_URL=http://localhost:4173 DATABASE_URL=local.db FIELDSTONE_PUSH_ON_CONFIGURE=true npm run dev -- --host 127.0.0.1 --port 4173',
		port: 4173,
		// Locally, reuse an already-running dev server for a fast inner loop; in CI always
		// start a clean one so the run is hermetic.
		reuseExistingServer: !process.env.CI
	},
	// Fail the build if a committed `test.only` would silently skip the rest of the suite.
	forbidOnly: !!process.env.CI,
	// The dev server is backed by a single SQLite database, so run specs serially
	// to avoid cross-spec contention on one shared backend.
	workers: 1,
	fullyParallel: false,
	// vite dev lazily re-optimizes dependencies on first request to a route, which can
	// surface a one-off "Failed to fetch" while a module graph rebuilds. Retry so a
	// cold-start optimization pass doesn't fail an otherwise-passing spec (extra retry in CI).
	retries: process.env.CI ? 2 : 1,
	use: { baseURL: 'http://localhost:4173' },
	projects: [
		// Registers the first admin user and saves its session for the suite.
		{ name: 'setup', testMatch: /auth\.setup\.ts$/ },
		{
			name: 'authenticated',
			testMatch: /.*\.e2e\.(ts|js)$/,
			dependencies: ['setup'],
			use: { storageState: 'playwright/.auth/user.json' }
		}
	]
});
