import { describe, expect, it } from 'vitest';

import * as codegen from '../src/index.ts';

describe('fieldstone codegen exports', () => {
	it('exposes generation helpers without Vite plugin exports', () => {
		expect(codegen).toHaveProperty('loadFieldstoneConfig');
		expect(codegen).toHaveProperty('writeGeneratedFiles');
		expect(codegen).toHaveProperty('createCollectionScaffold');
		expect(codegen).not.toHaveProperty('fieldstone');
	});
});
