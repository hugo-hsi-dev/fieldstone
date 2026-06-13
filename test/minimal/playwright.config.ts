import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command:
			'rm -f local.db && DATABASE_URL=local.db FIELDSTONE_PUSH_ON_CONFIGURE=true npm run dev -- --host 127.0.0.1 --port 4173',
		port: 4173
	},
	testMatch: '**/*.e2e.{ts,js}'
});
