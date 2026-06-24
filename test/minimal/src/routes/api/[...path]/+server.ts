import config from '$fieldstone-config';
import { createFieldstoneRest } from '@hugo-hsi-dev/admin-runtime';
import type { RequestHandler } from './$types';

import { auth } from '$lib/auth';

const rest = createFieldstoneRest({
	config,
	getUser: async (request) => {
		const result = await auth.api.getSession({ headers: request.headers });
		return (result?.user ?? null) as Record<string, unknown> | null;
	}
});

const handler: RequestHandler = ({ request, params }) => {
	const segments = (params.path ?? '').split('/').filter(Boolean);
	return rest.handle(request, segments);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
