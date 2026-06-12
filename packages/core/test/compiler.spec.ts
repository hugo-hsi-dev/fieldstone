import { describe, expect, it } from 'vitest';

import { collection, text } from '../src/index.ts';
import * as core from '../src/index.ts';
import * as schema from '../src/schema.ts';
import { compileFieldstoneConfig } from '../src/schema.ts';
import type { FieldstoneConfig } from '../src/types.ts';

describe('fieldstone compiler', () => {
	it('compiles deterministic collection facts once for compiler outputs', () => {
		const { schemaPlan } = compileFieldstoneConfig({
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				pages: {
					fields: [text({ name: 'headline', required: true })],
					slug: 'pages'
				},
				'blog-posts': {
					fields: [
						text({ name: 'seo-title', required: true }),
						text({ name: 'seo_title', required: false })
					],
					slug: 'blog-posts'
				},
				blog_posts: {
					fields: [text({ name: 'title', required: true })],
					slug: 'blog_posts'
				}
			}
		});

		expect(schemaPlan.collections.map((compiled) => compiled.slug)).toEqual([
			'blog-posts',
			'blog_posts',
			'pages'
		]);
		expect(schemaPlan.collections[1]?.tableIdentifier).toBe('collection_blog_posts_2');
		expect(schemaPlan.collections[0]).toMatchObject({
			slug: 'blog-posts',
			tableIdentifier: 'collection_blog_posts',
			columns: [
				{
					columnName: 'id',
					identifier: 'id',
					name: 'id',
					origin: 'system',
					required: true,
					runtimeKey: 'id',
					typeScriptType: 'string'
				},
				{
					columnName: 'seo-title',
					identifier: 'seo_title',
					name: 'seo-title',
					origin: 'field',
					required: true,
					runtimeKey: 'seo-title',
					typeScriptType: 'string'
				},
				{
					columnName: 'seo_title',
					identifier: 'seo_title_2',
					name: 'seo_title',
					origin: 'field',
					required: false,
					runtimeKey: 'seo_title',
					typeScriptType: 'string'
				},
				{
					columnName: 'created_at',
					identifier: 'createdAt',
					name: 'createdAt',
					origin: 'system',
					required: true,
					runtimeKey: 'createdAt',
					typeScriptType: 'Date'
				},
				{
					columnName: 'updated_at',
					identifier: 'updatedAt',
					name: 'updatedAt',
					origin: 'system',
					required: true,
					runtimeKey: 'updatedAt',
					typeScriptType: 'Date'
				}
			],
			fields: [
				{ identifier: 'seo_title', name: 'seo-title', required: true },
				{ identifier: 'seo_title_2', name: 'seo_title', required: false }
			],
			systemFields: [
				{ columnName: 'id', identifier: 'id', name: 'id' },
				{
					columnName: 'created_at',
					identifier: 'createdAt',
					name: 'createdAt'
				},
				{
					columnName: 'updated_at',
					identifier: 'updatedAt',
					name: 'updatedAt'
				}
			]
		});
		expect(schemaPlan.fingerprintPayload[0]).toEqual({
			fields: [
				{ multiline: false, name: 'seo-title', required: true, type: 'text' },
				{ multiline: false, name: 'seo_title', required: false, type: 'text' }
			],
			slug: 'blog-posts'
		});
	});

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

		const compiled = compileFieldstoneConfig(config).renderRuntimeSchema();

		expect(compiled.tables.posts.id).toBeDefined();
		expect(compiled.tables.posts.title).toBeDefined();
		expect(compiled.tables.posts.createdAt).toBeDefined();
		expect(compiled.tables.posts.updatedAt).toBeDefined();
	});

	it('generates ambient config and collection types', () => {
		const output = compileFieldstoneConfig({
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				posts: {
					fields: [
						text({ name: 'title', required: true }),
						text({ name: 'description', required: false })
					],
					slug: 'posts'
				}
			}
		}).renderTypesDeclaration();

		expect(output).toContain("declare module '@fieldstone/core'");
		expect(output).toContain('"posts"');
		expect(output).toContain('    id: string;');
		expect(output).toContain('"title": string');
		expect(output).toContain('"description"?: string');
		expect(output).toContain('    createdAt: Date;');
		expect(output).toContain('    updatedAt: Date;');
	});

	it('rejects duplicate field names in one collection', () => {
		expect(() =>
			collection({
				fields: [text({ name: 'title', required: true }), text({ name: 'title', required: true })]
			})
		).toThrow('Duplicate field name: title');
	});

	it.each(['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at'])(
		'rejects reserved system field name %s',
		(fieldName) => {
			expect(() =>
				collection({
					fields: [text({ name: fieldName, required: true })]
				})
			).toThrow(`Reserved field name: ${fieldName}`);
		}
	);

	it('rejects prototype-mutating field names', () => {
		expect(() =>
			collection({
				fields: [text({ name: '__proto__', required: true })]
			})
		).toThrow('Reserved field name: __proto__');
	});

	it('rejects case-only duplicate field names', () => {
		expect(() =>
			collection({
				fields: [text({ name: 'title', required: true }), text({ name: 'Title', required: true })]
			})
		).toThrow('Duplicate field name: Title');
	});

	it('generates drizzle schema source for CLI migrations', () => {
		const output = compileFieldstoneConfig({
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				'blog-posts': {
					fields: [text({ name: 'title', required: true })],
					slug: 'blog-posts'
				}
			}
		}).renderSchemaSource();

		expect(output).toContain('export const collection_blog_posts = sqliteTable("blog-posts"');
		expect(output).toContain("import crypto from 'node:crypto'");
		expect(output).toContain('title: text("title").notNull()');
	});

	it('preserves fields whose generated identifiers collide', () => {
		const output = compileFieldstoneConfig({
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				posts: {
					fields: [
						text({ name: 'seo-title', required: true }),
						text({ name: 'seo_title', required: false })
					],
					slug: 'posts'
				}
			}
		}).renderSchemaSource();

		expect(output).toContain('seo_title: text("seo-title").notNull()');
		expect(output).toContain('seo_title_2: text("seo_title")');
	});

	it('generates valid export identifiers for reserved collection slugs', () => {
		const output = compileFieldstoneConfig({
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				class: {
					fields: [text({ name: 'title', required: true })],
					slug: 'class'
				},
				'class-name': {
					fields: [text({ name: 'title', required: true })],
					slug: 'class-name'
				}
			}
		}).renderSchemaSource();

		expect(output).toContain('export const collection_class = sqliteTable("class"');
		expect(output).toContain('export const collection_class_name = sqliteTable("class-name"');
		expect(output).not.toContain('export const class =');
	});

	it('rejects case-only duplicate collection slugs', () => {
		expect(() =>
			compileFieldstoneConfig({
				db: { dialect: 'sqlite', url: ':memory:' },
				collections: {
					posts: {
						fields: [text({ name: 'title', required: true })],
						slug: 'posts'
					},
					Posts: {
						fields: [text({ name: 'title', required: true })],
						slug: 'Posts'
					}
				}
			}).renderSchemaSource()
		).toThrow('Duplicate collection slug: Posts');
	});

	it('rejects reserved field names in direct config input', () => {
		const config: FieldstoneConfig = {
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				posts: {
					fields: [text({ name: 'id', required: true })],
					slug: 'posts'
				}
			}
		};

		expect(() => compileFieldstoneConfig(config)).toThrow('Reserved field name: id');
	});

	it('rejects duplicate field names in direct config input', () => {
		const config: FieldstoneConfig = {
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				posts: {
					fields: [
						text({ name: 'title', required: true }),
						text({ name: 'Title', required: true })
					],
					slug: 'posts'
				}
			}
		};

		expect(() => compileFieldstoneConfig(config).renderSchemaSource()).toThrow(
			'Duplicate field name: Title'
		);
	});

	it('exposes schema artifacts through one compiled config result', () => {
		const compiled = compileFieldstoneConfig({
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				posts: {
					fields: [text({ name: 'title', required: true })],
					slug: 'posts'
				}
			}
		});

		expect(compiled.renderRuntimeSchema().tables.posts.title).toBeDefined();
		expect(compiled.renderSchemaSource()).toContain('title: text("title").notNull()');
		expect(compiled.renderTypesDeclaration()).toContain('"title": string');
		expect(compiled.schemaFingerprint()).toContain('"slug":"posts"');
	});

	it('caches lazy schema artifacts against later config mutation', () => {
		const config: FieldstoneConfig = {
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {
				posts: {
					fields: [text({ name: 'title', required: true })],
					slug: 'posts'
				}
			}
		};

		const compiled = compileFieldstoneConfig(config);
		const firstSource = compiled.renderSchemaSource();
		config.collections.posts?.fields.push(text({ name: 'body' }));

		expect(compiled.renderSchemaSource()).toBe(firstSource);
		expect(compiled.schemaFingerprint()).not.toContain('"name":"body"');
	});

	it('does not expose legacy compiler artifact functions or compiled method names', () => {
		const compiled = compileFieldstoneConfig({
			db: { dialect: 'sqlite', url: ':memory:' },
			collections: {}
		});

		expect(core).not.toHaveProperty('generateDrizzleSchemaSource');
		expect(core).not.toHaveProperty('generateTypes');
		expect(core).not.toHaveProperty('createSchemaFingerprint');
		expect(core).not.toHaveProperty('compileFieldstoneConfig');
		expect(schema).not.toHaveProperty('generateDrizzleSchemaSource');
		expect(schema).not.toHaveProperty('generateTypes');
		expect(schema).not.toHaveProperty('createSchemaFingerprint');
		expect(schema).toHaveProperty('compileFieldstoneConfig');
		expect(compiled).not.toHaveProperty('runtimeSchema');
		expect(compiled).not.toHaveProperty('drizzleSchemaSource');
		expect(compiled).not.toHaveProperty('typesDeclaration');
		expect(compiled).not.toHaveProperty('fingerprint');
	});
});
