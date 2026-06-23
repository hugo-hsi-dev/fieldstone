import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';

import { authDb } from './server/auth-db';
import * as schema from './server/auth-schema';

const authSecret = env.BETTER_AUTH_SECRET?.trim();
// The dev fallback keeps first-run setup zero-config, but a forgeable known secret
// must never reach production. `building` is excluded so `vite build` (which runs
// without secrets) succeeds — the guard fires when the server actually starts.
if (!authSecret && !dev && !building) {
	throw new Error('BETTER_AUTH_SECRET must be set in production.');
}

export const auth = betterAuth({
	database: drizzleAdapter(authDb, { provider: 'sqlite', schema }),
	emailAndPassword: { enabled: true },
	secret: authSecret || 'fieldstone-dev-secret-change-me-0123456789abcdef',
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
