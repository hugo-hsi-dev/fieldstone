import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { env } from '$env/dynamic/private';

import { authDb } from './server/auth-db';
import * as schema from './server/auth-schema';

export const auth = betterAuth({
	database: drizzleAdapter(authDb, { provider: 'sqlite', schema }),
	emailAndPassword: { enabled: true },
	// A real deployment sets BETTER_AUTH_SECRET; this dev fallback keeps setup zero-config.
	secret: env.BETTER_AUTH_SECRET ?? 'fieldstone-dev-secret-change-me-0123456789abcdef',
	// Only pin baseURL when explicitly set (e.g. the e2e webServer); otherwise let Better
	// Auth infer it from the request so it works on any dev port (5173, 4173, ...).
	...(env.BETTER_AUTH_URL ? { baseURL: env.BETTER_AUTH_URL } : {}),
	trustedOrigins: [
		'http://localhost:5173',
		'http://127.0.0.1:5173',
		'http://localhost:4173',
		'http://127.0.0.1:4173'
	]
});
