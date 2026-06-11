import { desc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import * as schema from '$lib/server/db/schema';
import { posts } from '$lib/server/db/schema';

export type CollectionName = 'posts';
export type Post = typeof posts.$inferSelect;

type FindInput = {
	collection: CollectionName;
};

type FindByIdInput = FindInput & {
	id: string;
};

type PostInput = {
	title: string;
	description: string;
	createdAt?: Date;
	updatedAt?: Date;
};

type UpdatePostInput = PostInput & {
	id: string;
};

type DeletePostInput = {
	id: string;
};

function assertPostsCollection(collection: CollectionName) {
	if (collection !== 'posts') throw new Error(`Unsupported collection: ${collection}`);
}

function normalizePostInput(input: PostInput): PostInput {
	const title = input.title.trim();
	const description = input.description.trim();

	if (!title) throw new Error('Title is required');

	return { ...input, title, description };
}

export function createStone(database: BetterSQLite3Database<typeof schema>) {
	return {
		find: async ({ collection }: FindInput) => {
			assertPostsCollection(collection);

			return database.select().from(posts).orderBy(desc(posts.createdAt));
		},

		findById: async ({ collection, id }: FindByIdInput) => {
			assertPostsCollection(collection);

			const [post] = await database.select().from(posts).where(eq(posts.id, id)).limit(1);
			return post ?? null;
		},

		createPost: async (input: PostInput) => {
			const post = normalizePostInput(input);
			const now = new Date();
			const [created] = await database
				.insert(posts)
				.values({
					title: post.title,
					description: post.description,
					createdAt: post.createdAt ?? now,
					updatedAt: post.updatedAt ?? now
				})
				.returning();

			return created;
		},

		updatePost: async ({ id, ...input }: UpdatePostInput) => {
			const post = normalizePostInput(input);
			const [updated] = await database
				.update(posts)
				.set({
					title: post.title,
					description: post.description,
					updatedAt: post.updatedAt ?? new Date()
				})
				.where(eq(posts.id, id))
				.returning();

			if (!updated) throw new Error('Post not found');
			return updated;
		},

		deletePost: async ({ id }: DeletePostInput) => {
			const [deleted] = await database
				.delete(posts)
				.where(eq(posts.id, id))
				.returning({ id: posts.id });

			if (!deleted) throw new Error('Post not found');
			return deleted;
		}
	};
}
