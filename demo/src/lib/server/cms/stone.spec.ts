import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createStone } from './stone-factory';
describe('stone cms client', () => {
	let sqlite: Database.Database;
	let stone: ReturnType<typeof createStone>;

	beforeEach(() => {
		vi.useRealTimers();
		sqlite = new Database(':memory:');
		sqlite.exec(`
			create table posts (
				id text primary key not null,
				title text not null,
				description text not null,
				created_at integer not null,
				updated_at integer not null
			);
		`);
		stone = createStone(drizzle(sqlite));
	});

	it('finds posts by collection', async () => {
		const createdAt = new Date('2026-01-01T00:00:00.000Z');
		const updatedAt = new Date('2026-01-02T00:00:00.000Z');
		await stone.createPost({ title: 'First post', description: 'POC body', createdAt, updatedAt });

		const result = await stone.find({ collection: 'posts' });

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			title: 'First post',
			description: 'POC body',
			createdAt,
			updatedAt
		});
	});

	it('finds one post by id', async () => {
		const post = await stone.createPost({ title: 'Find me', description: 'By id' });

		const result = await stone.findById({ collection: 'posts', id: post.id });

		expect(result).toMatchObject({ id: post.id, title: 'Find me', description: 'By id' });
	});

	it('returns null when findById misses', async () => {
		await expect(stone.findById({ collection: 'posts', id: 'missing' })).resolves.toBeNull();
	});

	it('updates and deletes posts', async () => {
		const now = new Date('2026-01-03T00:00:00.000Z');
		vi.useFakeTimers();
		vi.setSystemTime(now);
		const post = await stone.createPost({ title: 'Old', description: 'Old body' });

		const updated = await stone.updatePost({
			id: post.id,
			title: 'New',
			description: 'New body'
		});
		const deleted = await stone.deletePost({ id: post.id });

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
		await expect(stone.find({ collection: 'pages' as 'posts' })).rejects.toThrow(
			'Unsupported collection'
		);
	});

	it('requires collection for find calls', async () => {
		// @ts-expect-error collection is required for forward-compatible collection routing
		await expect(stone.find({})).rejects.toThrow('Unsupported collection');
	});
});
