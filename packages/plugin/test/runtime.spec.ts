import { describe, expect, it } from 'vitest';

import { getFieldstone } from '../src/index.ts';

describe('fieldstone runtime', () => {
	it('does not treat inherited collection keys as valid collections', async () => {
		const stone = await getFieldstone({
			config: {
				db: { dialect: 'sqlite', url: ':memory:' },
				collections: {}
			}
		});

		expect(stone.getCollection('toString')).toBeNull();
		await expect(stone.find({ collection: 'toString' })).rejects.toThrow(
			'Unsupported collection: toString'
		);
	});
});
