import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command:
			'rm -f e2e.db && DATABASE_URL=e2e.db ORIGIN=http://localhost:4173 BETTER_AUTH_SECRET=R7xV2mQ9pL4sN8tY3bC6dF1gH5jK0zXw npm run db:push -- --force && DATABASE_URL=e2e.db ORIGIN=http://localhost:4173 BETTER_AUTH_SECRET=R7xV2mQ9pL4sN8tY3bC6dF1gH5jK0zXw npm run build && DATABASE_URL=e2e.db ORIGIN=http://localhost:4173 BETTER_AUTH_SECRET=R7xV2mQ9pL4sN8tY3bC6dF1gH5jK0zXw npm run preview',
		port: 4173
	},
	testMatch: '**/*.e2e.{ts,js}'
});
