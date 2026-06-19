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
	baseURL: env.BETTER_AUTH_URL ?? 'http://127.0.0.1:4173',
	trustedOrigins: [
		'http://127.0.0.1:4173',
		'http://localhost:4173',
		'http://localhost:5173'
	]
});
