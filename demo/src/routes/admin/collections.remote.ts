import { query } from '$app/server';

import { stone } from '$lib/server/cms/stone';

export const getCollection = query(() => stone.getCollection('posts') ?? stone.collections[0] ?? null);
