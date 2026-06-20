import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '$env/dynamic/private';

import * as schema from './auth-schema';

// Better Auth's tables live in a separate database so Fieldstone's CMS schema push
// (which manages only collection/global tables) never touches them.
const client = createClient({ url: env.AUTH_DATABASE_URL ?? 'file:auth.db' });

let ensured: Promise<unknown> | undefined;

export function ensureAuthSchema() {
	ensured ??= client.executeMultiple(`
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
	`);
	return ensured;
}

export const authDb = drizzle(client, { schema });
