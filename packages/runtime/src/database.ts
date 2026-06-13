import { compileFieldstoneConfig } from '@fieldstone/compiler';
import type { FieldstoneConfig } from '@fieldstone/schema';

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
	const compiledConfig = compileFieldstoneConfig(config);
	const compiled = compiledConfig.renderRuntimeSchema();
	const client = createClient({ url: normalizeSqliteUrl(config.db.url) });
	const database = drizzle(client, { schema: compiled.schema });

	return {
		collections: compiledConfig.createCollectionRuntimeConfigs(),
		compiled,
		compiledConfig,
		database,
		desc,
		eq
	};
}
