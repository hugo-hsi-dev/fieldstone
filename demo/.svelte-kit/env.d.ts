// This file is generated from ../src/env.ts.
// See https://svelte.dev/docs/kit/environment-variables for more information

declare module '$app/env/private' {
	/**
	 * The database connection string.
	 */
	export const DATABASE_URL: string;
	/**
	 * The app origin (base URL), e.g. `http://localhost:5173`.
	 */
	export const ORIGIN: string;
	/**
	 * Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).
	 */
	export const BETTER_AUTH_SECRET: string;
}

declare module '$app/env/public' {
	// no public environment variables were defined
}