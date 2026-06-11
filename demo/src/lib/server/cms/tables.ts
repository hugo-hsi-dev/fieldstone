import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { CollectionName } from '$lib/cms/config';
import { pages, posts } from '$lib/server/db/schema';

export const collectionTables = {
	posts,
	pages
} satisfies Record<CollectionName, SQLiteTable>;
