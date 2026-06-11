import { error, redirect, type RequestEvent } from '@sveltejs/kit';

export function requireAdminUser(event: RequestEvent) {
	if (!event.locals.user) error(401, 'Authentication required');
	return event.locals.user;
}

export function requireAdminPage(event: RequestEvent) {
	if (!event.locals.user) redirect(302, '/demo/better-auth/login');
	return event.locals.user;
}
