import { redirect } from '@sveltejs/kit';

import { cmsConfig } from '$lib/cms/config';

export function load() {
	const firstCollection = cmsConfig.collections[0];
	if (!firstCollection) return;

	redirect(302, `/admin/${firstCollection.slug}`);
}
