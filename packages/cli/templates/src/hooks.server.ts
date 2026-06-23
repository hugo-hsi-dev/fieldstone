import { building } from '$app/environment';
import { base } from '$app/paths';
import { redirect, type Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';

import { auth } from '$lib/auth';
import { ensureAuthSchema } from '$lib/server/auth-db';

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return svelteKitHandler({ event, resolve, auth, building });

	await ensureAuthSchema();

	const result = await auth.api.getSession({ headers: event.request.headers });
	event.locals.session = result?.session ?? null;
	event.locals.user = result?.user ?? null;

	// Protect the admin UI. Auth endpoints (/api/auth/*) and the login page stay open.
	// `base` keeps this correct when the app is served under a kit.paths.base prefix.
	const adminPath = `${base}/admin`;
	const isAdminRoute =
		event.url.pathname === adminPath || event.url.pathname.startsWith(`${adminPath}/`);
	if (isAdminRoute && !event.locals.session) {
		const requested = event.url.pathname + event.url.search;
		redirect(303, `${base}/login?redirect=${encodeURIComponent(requested)}`);
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
