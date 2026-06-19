import { building } from '$app/environment';
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
	if (event.url.pathname.startsWith('/admin') && !event.locals.session) {
		redirect(303, `/login?redirect=${encodeURIComponent(event.url.pathname + event.url.search)}`);
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
