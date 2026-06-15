import { describe, expect, it } from "vitest";

import {
  boolean,
  collection,
  global,
  text,
  type FieldstoneConfig,
} from "@fieldstone/schema";
import * as schema from "@fieldstone/schema";
import * as compiler from "../src/index.ts";
import { compileFieldstoneConfig } from "../src/index.ts";

describe("fieldstone compiler", () => {
  it("compiles deterministic collection facts once for compiler outputs", () => {
    const { schemaPlan } = compileFieldstoneConfig({
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {
        pages: {
          fields: [text({ name: "headline", required: true })],
          slug: "pages",
        },
        "blog-posts": {
          fields: [
            text({ name: "seo-title", required: true }),
            text({ name: "seo_title", required: false }),
          ],
          slug: "blog-posts",
        },
        blog_posts: {
          fields: [text({ name: "title", required: true })],
          slug: "blog_posts",
        },
      },
    });

    expect(schemaPlan.collections.map((compiled) => compiled.slug)).toEqual([
      "blog-posts",
      "blog_posts",
      "pages",
    ]);
    expect(schemaPlan.collections[1]?.tableIdentifier).toBe(
      "collection_blog_posts_2",
    );
    expect(schemaPlan.collections[0]).toMatchObject({
      slug: "blog-posts",
      tableIdentifier: "collection_blog_posts",
      columns: [
        {
          columnName: "id",
          identifier: "id",
          name: "id",
          origin: "system",
          required: true,
          runtimeKey: "id",
          typeScriptType: "string",
        },
        {
          columnName: "seo-title",
          identifier: "seo_title",
          name: "seo-title",
          origin: "field",
          required: true,
          runtimeKey: "seo-title",
          typeScriptType: "string",
        },
        {
          columnName: "seo_title",
          identifier: "seo_title_2",
          name: "seo_title",
          origin: "field",
          required: false,
          runtimeKey: "seo_title",
          typeScriptType: "string",
        },
        {
          columnName: "created_at",
          identifier: "createdAt",
          name: "createdAt",
          origin: "system",
          required: true,
          runtimeKey: "createdAt",
          typeScriptType: "Date",
        },
        {
          columnName: "updated_at",
          identifier: "updatedAt",
          name: "updatedAt",
          origin: "system",
          required: true,
          runtimeKey: "updatedAt",
          typeScriptType: "Date",
        },
      ],
      fields: [
        { identifier: "seo_title", name: "seo-title", required: true },
        { identifier: "seo_title_2", name: "seo_title", required: false },
      ],
      systemFields: [
        { columnName: "id", identifier: "id", name: "id" },
        {
          columnName: "created_at",
          identifier: "createdAt",
          name: "createdAt",
        },
        {
          columnName: "updated_at",
          identifier: "updatedAt",
          name: "updatedAt",
        },
      ],
    });
    expect(schemaPlan.fingerprintPayload.collections[0]).toEqual({
      fields: [
        { multiline: false, name: "seo-title", required: true, type: "text" },
        { multiline: false, name: "seo_title", required: false, type: "text" },
      ],
      slug: "blog-posts",
    });

    expect(
      compileFieldstoneConfig({
        db: { dialect: "sqlite", url: ":memory:" },
        collections: {
          posts: {
            fields: [
              text({ name: "seo-title", required: true }),
              text({ name: "seo_title" }),
            ],
            slug: "posts",
          },
        },
      }).createCollectionRuntimeConfigs(),
    ).toEqual([
      {
        fields: [
          {
            identifier: "seo_title",
            multiline: undefined,
            name: "seo-title",
            required: true,
            type: "text",
          },
          {
            identifier: "seo_title_2",
            multiline: undefined,
            name: "seo_title",
            required: false,
            type: "text",
          },
        ],
        slug: "posts",
      },
    ]);
  });

  it("builds sqlite tables with system fields from collection definitions", () => {
    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {
        posts: {
          ...collection({
            fields: [text({ name: "title", required: true })],
          }),
          slug: "posts",
        },
      },
    };

    const compiled = compileFieldstoneConfig(config).renderRuntimeSchema();

    expect(compiled.tables.posts.id).toBeDefined();
    expect(compiled.tables.posts.title).toBeDefined();
    expect(compiled.tables.posts.createdAt).toBeDefined();
    expect(compiled.tables.posts.updatedAt).toBeDefined();
  });

  it("generates ambient config and collection types", () => {
    const output = compileFieldstoneConfig({
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {
        posts: {
          fields: [
            text({ name: "title", required: true }),
            text({ name: "description", required: false }),
            boolean({ name: "published" }),
          ],
          slug: "posts",
        },
      },
    }).renderTypesDeclaration();

    expect(output).toContain("declare module '@fieldstone/schema'");
    expect(output).toContain('"posts"');
    expect(output).toContain("    id: string;");
    expect(output).toContain('"title": string');
    expect(output).toContain('"description": string | null');
    expect(output).toContain('"published": boolean');
    expect(output).toContain("    createdAt: Date;");
    expect(output).toContain("    updatedAt: Date;");
  });

  it("rejects duplicate field names in one collection", () => {
    expect(() =>
      collection({
        fields: [
          text({ name: "title", required: true }),
          text({ name: "title", required: true }),
        ],
      }),
    ).toThrow("Duplicate field name: title");
  });

  it.each(["id", "createdAt", "updatedAt", "created_at", "updated_at"])(
    "rejects reserved system field name %s",
    (fieldName) => {
      expect(() =>
        collection({
          fields: [text({ name: fieldName, required: true })],
        }),
      ).toThrow(`Reserved field name: ${fieldName}`);
    },
  );

  it("rejects prototype-mutating field names", () => {
    expect(() =>
      collection({
        fields: [text({ name: "__proto__", required: true })],
      }),
    ).toThrow("Reserved field name: __proto__");
  });

  it("rejects case-only duplicate field names", () => {
    expect(() =>
      collection({
        fields: [
          text({ name: "title", required: true }),
          text({ name: "Title", required: true }),
        ],
      }),
    ).toThrow("Duplicate field name: Title");
  });

  it("generates drizzle schema source for CLI migrations", () => {
    const output = compileFieldstoneConfig({
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {
        "blog-posts": {
          fields: [
            text({ name: "title", required: true }),
            boolean({ name: "published" }),
          ],
          slug: "blog-posts",
        },
      },
    }).renderSchemaSource();

    expect(output).toContain(
      'export const collection_blog_posts = sqliteTable("blog-posts"',
    );
    expect(output).toContain("import crypto from 'node:crypto'");
    expect(output).toContain('title: text("title").notNull()');
    expect(output).toContain(
      "published: integer(\"published\", { mode: 'boolean' }).notNull()",
    );
  });

  it("preserves fields whose generated identifiers collide", () => {
    const output = compileFieldstoneConfig({
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {
        posts: {
          fields: [
            text({ name: "seo-title", required: true }),
            text({ name: "seo_title", required: false }),
          ],
          slug: "posts",
        },
      },
    }).renderSchemaSource();

    expect(output).toContain('seo_title: text("seo-title").notNull()');
    expect(output).toContain('seo_title_2: text("seo_title")');
  });

  it("compiles global runtime configs and tables", () => {
    const compiled = compileFieldstoneConfig({
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {},
      globals: {
        "site-settings": {
          ...global({
            fields: [
              text({ name: "siteTitle", required: true }),
              boolean({ name: "showBanner" }),
            ],
          }),
          slug: "site-settings",
        },
      },
    });

    expect(compiled.createGlobalRuntimeConfigs()).toEqual([
      {
        fields: [
          {
            identifier: "siteTitle",
            multiline: undefined,
            name: "siteTitle",
            required: true,
            type: "text",
          },
          {
            identifier: "showBanner",
            name: "showBanner",
            required: true,
            type: "boolean",
          },
        ],
        slug: "site-settings",
      },
    ]);
    expect(
      compiled.renderRuntimeSchema().tables["site-settings"].siteTitle,
    ).toBeDefined();
    expect(compiled.renderSchemaSource()).toContain(
      'export const global_site_settings = sqliteTable("site-settings"',
    );
    expect(compiled.renderTypesDeclaration()).toContain(
      "interface GeneratedGlobals",
    );
    expect(compiled.renderTypesDeclaration()).toContain('"site-settings"');
  });

  it("rejects collection and global slugs that collide", () => {
    expect(() =>
      compileFieldstoneConfig({
        db: { dialect: "sqlite", url: ":memory:" },
        collections: {
          settings: {
            fields: [text({ name: "title", required: true })],
            slug: "settings",
          },
        },
        globals: {
          Settings: {
            fields: [text({ name: "siteTitle", required: true })],
            slug: "Settings",
          },
        },
      }),
    ).toThrow("Duplicate content slug: Settings");
  });

  it("generates valid export identifiers for reserved collection slugs", () => {
    const output = compileFieldstoneConfig({
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {
        class: {
          fields: [text({ name: "title", required: true })],
          slug: "class",
        },
        "class-name": {
          fields: [text({ name: "title", required: true })],
          slug: "class-name",
        },
      },
    }).renderSchemaSource();

    expect(output).toContain(
      'export const collection_class = sqliteTable("class"',
    );
    expect(output).toContain(
      'export const collection_class_name = sqliteTable("class-name"',
    );
    expect(output).not.toContain("export const class =");
  });

  it("rejects case-only duplicate collection slugs", () => {
    expect(() =>
      compileFieldstoneConfig({
        db: { dialect: "sqlite", url: ":memory:" },
        collections: {
          posts: {
            fields: [text({ name: "title", required: true })],
            slug: "posts",
          },
          Posts: {
            fields: [text({ name: "title", required: true })],
            slug: "Posts",
          },
        },
      }).renderSchemaSource(),
    ).toThrow("Duplicate content slug: Posts");
  });

  it("rejects reserved field names in direct config input", () => {
    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {
        posts: {
          fields: [text({ name: "id", required: true })],
          slug: "posts",
        },
      },
    };

    expect(() => compileFieldstoneConfig(config)).toThrow(
      "Reserved field name: id",
    );
  });

  it("rejects duplicate field names in direct config input", () => {
    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {
        posts: {
          fields: [
            text({ name: "title", required: true }),
            text({ name: "Title", required: true }),
          ],
          slug: "posts",
        },
      },
    };

    expect(() => compileFieldstoneConfig(config).renderSchemaSource()).toThrow(
      "Duplicate field name: Title",
    );
  });

  it("exposes schema artifacts through one compiled config result", () => {
    const compiled = compileFieldstoneConfig({
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {
        posts: {
          fields: [text({ name: "title", required: true })],
          slug: "posts",
        },
      },
    });

    expect(compiled.renderRuntimeSchema().tables.posts.title).toBeDefined();
    expect(compiled.renderSchemaSource()).toContain(
      'title: text("title").notNull()',
    );
    expect(compiled.renderTypesDeclaration()).toContain('"title": string');
    expect(compiled.schemaFingerprint()).toContain('"slug":"posts"');
  });

  it("exposes Collection lookup and Document normalization through the schema plan", () => {
    const compiled = compileFieldstoneConfig({
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {
        posts: {
          fields: [
            text({ name: "title", required: true }),
            text({ name: "description", required: false }),
          ],
          slug: "posts",
        },
      },
    });

    expect(compiled.getCollection("posts")).toMatchObject({ slug: "posts" });
    expect(compiled.getCollection("missing")).toBeNull();
    expect(
      compiled.normalizeDocumentData("posts", {
        description: " Body ",
        title: " Hello ",
      }),
    ).toEqual({ description: "Body", title: "Hello" });
    expect(() =>
      compiled.normalizeDocumentData("posts", { description: "Missing title" }),
    ).toThrow("title is required");
    expect(() =>
      compiled.normalizeDocumentData("posts", {
        title: "Hello",
        extra: "Nope",
      }),
    ).toThrow("Unknown field: extra");
    expect(() => compiled.normalizeDocumentData("missing", {})).toThrow(
      "Unsupported collection: missing",
    );
  });

  it("caches lazy schema artifacts against later config mutation", () => {
    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {
        posts: {
          fields: [text({ name: "title", required: true })],
          slug: "posts",
        },
      },
    };

    const compiled = compileFieldstoneConfig(config);
    const firstSource = compiled.renderSchemaSource();
    config.collections.posts?.fields.push(text({ name: "body" }));

    expect(compiled.renderSchemaSource()).toBe(firstSource);
    expect(compiled.schemaFingerprint()).not.toContain('"name":"body"');
  });

  it("does not expose legacy compiler artifact functions or compiled method names", () => {
    const compiled = compileFieldstoneConfig({
      db: { dialect: "sqlite", url: ":memory:" },
      collections: {},
    });

    expect(schema).not.toHaveProperty("generateDrizzleSchemaSource");
    expect(schema).not.toHaveProperty("generateTypes");
    expect(schema).not.toHaveProperty("createSchemaFingerprint");
    expect(schema).not.toHaveProperty("compileFieldstoneConfig");
    expect(compiler).not.toHaveProperty("generateDrizzleSchemaSource");
    expect(compiler).not.toHaveProperty("generateTypes");
    expect(compiler).not.toHaveProperty("createSchemaFingerprint");
    expect(compiler).toHaveProperty("compileFieldstoneConfig");
    expect(schema).not.toHaveProperty("generateDrizzleSchemaSource");
    expect(schema).not.toHaveProperty("generateTypes");
    expect(schema).not.toHaveProperty("createSchemaFingerprint");
    expect(compiled).not.toHaveProperty("runtimeSchema");
    expect(compiled).not.toHaveProperty("drizzleSchemaSource");
    expect(compiled).not.toHaveProperty("typesDeclaration");
    expect(compiled).not.toHaveProperty("fingerprint");
  });
});
