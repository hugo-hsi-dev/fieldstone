import { describe, expect, it } from 'vitest';

import { requireAdminPage, requireAdminUser } from './admin-auth';

describe('admin auth guards', () => {
	it('rejects unauthenticated remote mutations', () => {
		try {
			requireAdminUser({ locals: {} } as Parameters<typeof requireAdminUser>[0]);
			expect.fail('Expected requireAdminUser to throw');
		} catch (error) {
			expect(error).toMatchObject({ status: 401 });
		}
	});

	it('redirects unauthenticated admin pages to login', () => {
		try {
			requireAdminPage({ locals: {} } as Parameters<typeof requireAdminPage>[0]);
			expect.fail('Expected requireAdminPage to throw');
		} catch (error) {
			expect(error).toMatchObject({ status: 302, location: '/demo/better-auth/login' });
		}
	});
});
