import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';

import * as schema from './auth-schema';

// Better Auth's tables live in a separate database so Fieldstone's CMS schema push
// (which manages only collection/global tables) never touches them. The local-file
// fallback is dev-only — in production a local file silently breaks persistence.
// `building` is excluded so `vite build` succeeds; the guard fires at server start.
const authDatabaseUrl = env.AUTH_DATABASE_URL?.trim();
if (!authDatabaseUrl && !dev && !building) {
	throw new Error('AUTH_DATABASE_URL must be set in production.');
}
const client = createClient({ url: authDatabaseUrl || 'file:auth.db' });

let ensured: Promise<unknown> | undefined;

export function ensureAuthSchema() {
	ensured ??= client
		.executeMultiple(`
		create table if not exists user (
			id text primary key not null,
			name text not null,
			email text not null unique,
			"emailVerified" integer not null default 0,
			image text,
			"createdAt" integer not null,
			"updatedAt" integer not null
		);
		create table if not exists session (
			id text primary key not null,
			"expiresAt" integer not null,
			token text not null unique,
			"createdAt" integer not null,
			"updatedAt" integer not null,
			"ipAddress" text,
			"userAgent" text,
			"userId" text not null references user(id) on delete cascade
		);
		create table if not exists account (
			id text primary key not null,
			"accountId" text not null,
			"providerId" text not null,
			"userId" text not null references user(id) on delete cascade,
			"accessToken" text,
			"refreshToken" text,
			"idToken" text,
			"accessTokenExpiresAt" integer,
			"refreshTokenExpiresAt" integer,
			scope text,
			password text,
			"createdAt" integer not null,
			"updatedAt" integer not null
		);
		create table if not exists verification (
			id text primary key not null,
			identifier text not null,
			value text not null,
			"expiresAt" integer not null,
			"createdAt" integer,
			"updatedAt" integer
		);
	`)
		.catch((error) => {
			// Don't memoize a rejected promise — let the next request retry after a
			// transient DB failure.
			ensured = undefined;
			throw error;
		});
	return ensured;
}

export const authDb = drizzle(client, { schema });
