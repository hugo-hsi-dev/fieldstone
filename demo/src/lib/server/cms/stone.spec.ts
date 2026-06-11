import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { collection, getFieldstone, text } from '@fieldstone/plugin';

describe('stone cms client', () => {
	let sqlite: Database.Database;
	let stone: Awaited<ReturnType<typeof getFieldstone>>;
	let tempDir: string;

	beforeEach(async () => {
		vi.useRealTimers();
		tempDir = mkdtempSync(path.join(tmpdir(), 'fieldstone-'));
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

			create table pages (
				id text primary key not null,
				headline text not null,
				path text not null,
				summary text not null,
				created_at integer not null,
				updated_at integer not null
			);
		`);
		sqlite.close();
		stone = await getFieldstone({
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
					},
					pages: {
						...collection({
							fields: [
								text({ name: 'headline', required: true }),
								text({ name: 'path', required: true }),
								text({ name: 'summary' })
							]
						}),
						slug: 'pages'
					}
				}
			}
		});
	});

	afterEach(() => {
		rmSync(tempDir, { force: true, recursive: true });
	});

	it('creates and finds posts through generic collection methods', async () => {
		const createdAt = new Date('2026-01-01T00:00:00.000Z');
		const updatedAt = new Date('2026-01-02T00:00:00.000Z');
		await stone.create({
			collection: 'posts',
			data: { title: 'First post', description: 'POC body' },
			createdAt,
			updatedAt
		});

		const result = await stone.find({ collection: 'posts' });

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			title: 'First post',
			description: 'POC body',
			createdAt,
			updatedAt
		});
	});

	it('uses different text fields for different collections', async () => {
		await stone.create({
			collection: 'pages',
			data: { headline: 'About', path: '/about', summary: 'Company page' }
		});

		const result = await stone.find({ collection: 'pages' });

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			headline: 'About',
			path: '/about',
			summary: 'Company page'
		});
	});

	it('finds one document by id', async () => {
		const post = await stone.create({
			collection: 'posts',
			data: { title: 'Find me', description: 'By id' }
		});

		const result = await stone.findById({ collection: 'posts', id: post.id });

		expect(result).toMatchObject({ id: post.id, title: 'Find me', description: 'By id' });
	});

	it('returns null when findById misses', async () => {
		await expect(stone.findById({ collection: 'posts', id: 'missing' })).resolves.toBeNull();
	});

	it('updates and deletes documents', async () => {
		const now = new Date('2026-01-03T00:00:00.000Z');
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const post = await stone.create({
			collection: 'posts',
			data: { title: 'Old', description: 'Old body' }
		});

		const updated = await stone.update({
			collection: 'posts',
			id: post.id,
			data: { title: 'New', description: 'New body' }
		});
		const deleted = await stone.delete({ collection: 'posts', id: post.id });

		expect(updated).toMatchObject({
			id: post.id,
			title: 'New',
			description: 'New body',
			updatedAt: now
		});
		expect(deleted).toEqual({ id: post.id });
		await expect(stone.findById({ collection: 'posts', id: post.id })).resolves.toBeNull();
	});

	it('requires valid collections', async () => {
		await expect(stone.find({ collection: 'unknown' as 'posts' })).rejects.toThrow(
			'Unsupported collection'
		);
	});

	it('requires required fields', async () => {
		await expect(
			stone.create({ collection: 'posts', data: { title: '', description: 'Missing title' } })
		).rejects.toThrow('title is required');
	});

	it('rejects unknown fields', async () => {
		await expect(
			stone.create({
				collection: 'posts',
				data: { title: 'Known', description: 'Known', extra: 'Nope' }
			})
		).rejects.toThrow('Unknown field: extra');
	});

	it('requires collection for find calls', async () => {
		await expect(stone.find({} as { collection: string })).rejects.toThrow('Unsupported collection');
	});
});
