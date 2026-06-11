import { describe, expect, it } from 'vitest';

import * as plugin from '../src/index.ts';

describe('fieldstone plugin exports', () => {
	it('does not export the runtime client', () => {
		expect(plugin).not.toHaveProperty('getFieldstone');
		expect(plugin).not.toHaveProperty('DocumentData');
	});
});
