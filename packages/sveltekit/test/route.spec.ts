import { describe, expect, it } from 'vitest';

import { getAdminSegments } from '../src/admin/route.ts';

describe('admin route helpers', () => {
	it('preserves unsupported admin route segments for 404 handling', () => {
		expect(getAdminSegments('/admin/foo')).toEqual(['foo']);
	});

	it('extracts collection route segments', () => {
		expect(getAdminSegments('/admin/collections/posts')).toEqual(['collections', 'posts']);
	});
});
