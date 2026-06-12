import { createInterface } from 'node:readline/promises';

import { createClient } from '@libsql/client';
import { compileFieldstoneConfig } from '@fieldstone/core';
import type { FieldstoneConfig } from '@fieldstone/core';
import { drizzle } from 'drizzle-orm/libsql';

export function normalizeSqliteUrl(url: string) {
	if (/^[a-z]+:/i.test(url)) return url;
	return `file:${url}`;
}

async function confirmWarnings(warnings: string[], hasDataLoss: boolean) {
	if (!warnings.length) return true;

	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const message = [
		'Fieldstone schema push warnings:',
		'',
		...warnings,
		hasDataLoss ? '\nDATA LOSS WARNING: possible data loss detected.' : '',
		'',
		'Accept warnings and push schema? (y/N) '
	].join('\n');

	try {
		const answer = await rl.question(message);
		return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
	} finally {
		rl.close();
	}
}

export async function pushSchema(config: FieldstoneConfig) {
	const { pushSQLiteSchema } = await import('drizzle-kit/api');
	const compiled = compileFieldstoneConfig(config).runtimeSchema();
	const client = createClient({ url: normalizeSqliteUrl(config.db.url) });
	const database = drizzle(client, { schema: compiled.schema });
	const { apply, hasDataLoss, warnings } = await pushSQLiteSchema(compiled.schema, database);

	if (!(await confirmWarnings(warnings, hasDataLoss))) return false;
	await apply();
	return true;
}
