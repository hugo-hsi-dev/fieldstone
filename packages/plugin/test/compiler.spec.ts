import { describe, expect, it } from 'vitest';

import { collection, text } from '../src/index.ts';
import {
	compileFieldstoneConfig,
	generateDrizzleSchemaSource,
	generateTypes
} from '../src/schema.ts';
import type { FieldstoneConfig } from '../src/types.ts';

describe('fieldstone compiler', () => {
	it('builds sqlite tables with system fields from collection definitions', () => {
		const config: FieldstoneConfig = {
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				posts: {
					...collection({
						fields: [text({ name: 'title', required: true })]
					}),
					slug: 'posts'
				}
			}
		};

		const compiled = compileFieldstoneConfig(config);

		expect(compiled.tables.posts.id).toBeDefined();
		expect(compiled.tables.posts.title).toBeDefined();
		expect(compiled.tables.posts.createdAt).toBeDefined();
		expect(compiled.tables.posts.updatedAt).toBeDefined();
	});

	it('generates ambient config and collection types', () => {
		const output = generateTypes({
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				posts: {
					fields: [text({ name: 'title', required: true })],
					slug: 'posts'
				}
			}
		});

		expect(output).toContain('declare namespace Fieldstone');
		expect(output).toContain('"posts"');
		expect(output).toContain('"title": string');
	});

	it('rejects duplicate field names in one collection', () => {
		expect(() =>
			collection({
				fields: [
					text({ name: 'title', required: true }),
					text({ name: 'title', required: true })
				]
			})
		).toThrow('Duplicate field name: title');
	});

	it('rejects reserved system field names', () => {
		expect(() =>
			collection({
				fields: [text({ name: 'id', required: true })]
			})
		).toThrow('Reserved field name: id');
	});

	it('generates drizzle schema source for CLI migrations', () => {
		const output = generateDrizzleSchemaSource({
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				'blog-posts': {
					fields: [text({ name: 'title', required: true })],
					slug: 'blog-posts'
				}
			}
		});

		expect(output).toContain('export const blog_posts = sqliteTable("blog-posts"');
		expect(output).toContain('title: text("title").notNull()');
	});
});
