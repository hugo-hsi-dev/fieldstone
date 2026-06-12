import { compileFieldstoneConfig } from '@fieldstone/core/schema';
import type { FieldstoneConfig } from '@fieldstone/core';

export function normalizeSqliteUrl(url: string) {
	if (/^[a-z]+:/i.test(url)) return url;
	return `file:${url}`;
}

export async function createDatabase(config: FieldstoneConfig) {
	const [{ createClient }, { desc, eq }, { drizzle }] = await Promise.all([
		import('@libsql/client'),
		import('drizzle-orm'),
		import('drizzle-orm/libsql')
	]);
	const compiled = compileFieldstoneConfig(config).renderRuntimeSchema();
	const client = createClient({ url: normalizeSqliteUrl(config.db.url) });
	const database = drizzle(client, { schema: compiled.schema });

	return { compiled, database, desc, eq };
}
