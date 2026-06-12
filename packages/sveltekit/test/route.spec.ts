import { describe, expect, it } from 'vitest';

import { requireSupportedCollection } from '../src/admin/collections.ts';
import { getAdminSegments } from '../src/admin/route.ts';

describe('admin route helpers', () => {
	it('preserves unsupported admin route segments for 404 handling', () => {
		expect(getAdminSegments('/admin/foo')).toEqual(['foo']);
	});

	it('extracts collection route segments', () => {
		expect(getAdminSegments('/admin/collections/posts')).toEqual(['collections', 'posts']);
	});

	it('maps unsupported admin collections to a 404', () => {
		expect(() => requireSupportedCollection(() => null, 'missing')).toThrow(
			expect.objectContaining({ status: 404 })
		);
	});
});
