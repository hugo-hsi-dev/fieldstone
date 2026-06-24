import config from '$fieldstone-config';
import { createFieldstoneMedia } from '@hugo-hsi-dev/admin-runtime';
import type { RequestHandler } from './$types';

const media = createFieldstoneMedia({ config });

export const GET: RequestHandler = ({ request, params }) => {
	const segments = (params.path ?? '').split('/').filter(Boolean);
	return media.handle(request, segments);
};
