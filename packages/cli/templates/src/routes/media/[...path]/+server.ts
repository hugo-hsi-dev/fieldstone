import config from '$fieldstone-config';
import { createFieldstoneMedia } from '@fieldstone/admin-runtime';
import type { RequestHandler } from './$types';

// Serves uploaded files from the configured storage. Files are public by default;
// see storage.staticURL to change the prefix. Large uploads need BODY_SIZE_LIMIT
// raised on your adapter (see .env.example).
const media = createFieldstoneMedia({ config });

export const GET: RequestHandler = ({ request, params }) => {
	const segments = (params.path ?? '').split('/').filter(Boolean);
	return media.handle(request, segments);
};
