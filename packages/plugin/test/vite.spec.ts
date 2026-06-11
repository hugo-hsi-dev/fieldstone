import { describe, expect, it } from 'vitest';

import { fieldstone, fieldstoneCollectionScaffold } from '../src/vite.ts';

describe('fieldstone vite plugin', () => {
	it('rejects client imports of $fieldstone-config', () => {
		const plugin = fieldstone({ db: { dialect: 'sqlite', url: ':memory:' } });

		expect(() =>
			plugin.resolveId?.call({} as never, '$fieldstone-config', undefined, { ssr: false })
		).toThrow('$fieldstone-config is server-only');
	});

	it('scaffolds a new collection file from the filename', () => {
		expect(fieldstoneCollectionScaffold('blog-posts')).toBe(`import { collection, text } from '@fieldstone/plugin';

export default collection({
\tfields: [
\t\ttext({ name: 'title', required: true })
\t]
});
`);
	});
});
