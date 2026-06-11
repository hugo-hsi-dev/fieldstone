import { redirect } from '@sveltejs/kit';

import { stone } from '$lib/server/cms/stone';

export async function load() {
	const firstCollection = stone.getCollection('posts') ?? stone.collections[0];
	if (!firstCollection) return;

	redirect(302, `/admin/${firstCollection.slug}`);
}
