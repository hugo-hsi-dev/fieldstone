import type { PageServerLoad } from './$types';

import { requireAdminPage } from '$lib/server/cms/admin-auth';

export const load: PageServerLoad = (event) => {
	requireAdminPage(event);
	return {};
};
