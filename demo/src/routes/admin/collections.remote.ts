import { query } from '$app/server';

import { fieldstoneAdmin } from '$lib/server/admin/fieldstone-admin';

export const getCollection = query(
	() => fieldstoneAdmin.getCollection('posts') ?? fieldstoneAdmin.collections[0] ?? null
);
