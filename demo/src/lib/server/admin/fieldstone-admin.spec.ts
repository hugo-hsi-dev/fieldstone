import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { collection, text } from '@fieldstone/plugin';

import { createFieldstoneAdmin } from './fieldstone-admin';

describe('fieldstone admin service', () => {
	let sqlite: Database.Database;
	let admin: Awaited<ReturnType<typeof createFieldstoneAdmin>>;
	let tempDir: string;

	beforeEach(async () => {
		tempDir = mkdtempSync(path.join(tmpdir(), 'fieldstone-admin-'));
		const dbPath = path.join(tempDir, 'test.db');
		sqlite = new Database(dbPath);
		sqlite.exec(`
			create table posts (
				id text primary key not null,
				title text not null,
				description text not null,
				created_at integer not null,
				updated_at integer not null
			);
		`);
		sqlite.close();
		admin = await createFieldstoneAdmin({
			config: {
				db: { dialect: 'sqlite', url: dbPath },
				collections: {
					posts: {
						...collection({
							fields: [
								text({ name: 'title', required: true }),
								text({ name: 'description', multiline: true, required: true })
							]
						}),
						slug: 'posts'
					}
				}
			}
		});
	});

	afterEach(() => {
		rmSync(tempDir, { force: true, recursive: true });
	});

	it('creates and lists documents through admin methods', async () => {
		await admin.createDocument({
			collection: 'posts',
			data: { title: 'Admin post', description: 'Created from admin service' }
		});

		const documents = await admin.listDocuments({ collection: 'posts' });

		expect(documents).toHaveLength(1);
		expect(documents[0]).toMatchObject({
			title: 'Admin post',
			description: 'Created from admin service'
		});
	});

	it('exposes collection metadata for dashboard routing', () => {
		expect(admin.getCollection('posts')).toMatchObject({ slug: 'posts' });
		expect(admin.collections).toHaveLength(1);
	});
});
