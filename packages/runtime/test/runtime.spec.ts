import { createClient } from "@libsql/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

import {
  boolean,
  collection,
  date,
  email,
  global,
  number,
  relationship,
  select,
  text,
  upload,
  type FieldstoneConfig,
} from "@hugo-hsi-dev/schema";
import { getFieldstone } from "../src/index.ts";

describe("fieldstone runtime", () => {
  it("does not treat inherited collection keys as valid collections", async () => {
    const stone = await getFieldstone({
      config: {
        db: { dialect: "sqlite", url: ":memory:" },
        collections: {},
      },
    });

    expect(stone.getCollection("toString")).toBeNull();
    await expect(stone.find({ collection: "toString" })).rejects.toThrow(
      "Unsupported collection: toString",
    );
  });

  it("provides the virtual config module declaration from the client entrypoint", { timeout: 20_000 }, () => {
    const source = `
			import { getFieldstone } from '@hugo-hsi-dev/runtime';
			import config from '$fieldstone-config';

			void getFieldstone({ config });
		`;
    const rootDir = process.cwd().replace(/\/packages\/runtime$/, "");
    const fileName = `${rootDir}/app.ts`;
    const compilerOptions = {
      allowImportingTsExtensions: true,
      baseUrl: rootDir,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      paths: {
        "@hugo-hsi-dev/runtime": ["packages/runtime/src/index.ts"],
        "@hugo-hsi-dev/schema": ["packages/schema/src/index.ts"],
      },
      strict: true,
      target: ts.ScriptTarget.ESNext,
    } satisfies ts.CompilerOptions;
    const host = ts.createCompilerHost(compilerOptions);
    const originalReadFile = host.readFile;
    const originalFileExists = host.fileExists;

    host.readFile = (requestedFileName) =>
      requestedFileName === fileName
        ? source
        : originalReadFile(requestedFileName);
    host.fileExists = (requestedFileName) =>
      requestedFileName === fileName || originalFileExists(requestedFileName);

    const program = ts.createProgram([fileName], compilerOptions, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      ),
    ).not.toContain(
      "Cannot find module '$fieldstone-config' or its corresponding type declarations.",
    );
  });

  it("types collection-specific documents and mutation data from generated collections", () => {
    const source = `
			import { getFieldstone } from '@hugo-hsi-dev/runtime';
			import type { FieldstoneConfig } from '@hugo-hsi-dev/schema';

			declare module '@hugo-hsi-dev/schema' {
				interface GeneratedCollections {
					"posts": {
						id: string;
						title: string;
						description: string | null;
						published: boolean;
						createdAt: Date;
						updatedAt: Date;
					};
				}
				interface GeneratedGlobals {
					"site-settings": {
						id: string;
						siteTitle: string;
						tagline: string | null;
						showBanner: boolean;
						createdAt: Date;
						updatedAt: Date;
					};
				}
			}

			const config = {
				db: { dialect: 'sqlite', url: ':memory:' },
				collections: {}
			} satisfies FieldstoneConfig;

			async function run() {
				const stone = await getFieldstone({ config });
				const posts = await stone.find({ collection: 'posts' });
				const title: string = posts[0].title;
				const description: string | null = posts[0].description;
				const published: boolean = posts[0].published;
				const createdAt: Date = posts[0].createdAt;

				await stone.create({
					collection: 'posts',
					data: { title: 'Hello', description: 'Body', published: true }
				});

				await stone.create({
					collection: 'posts',
					data: { title: 'Hello' }
				});

				const settings = await stone.getGlobal({ global: 'site-settings' });
				if (settings) {
					const siteTitle: string = settings.siteTitle;
					const tagline: string | null = settings.tagline;
					const showBanner: boolean = settings.showBanner;
				}

				await stone.updateGlobal({
					global: 'site-settings',
					data: { siteTitle: 'Fieldstone', showBanner: true }
				});

				// @ts-expect-error missing configured global field
				await stone.updateGlobal({ global: 'site-settings', data: { tagline: 'Nope' } });

				// @ts-expect-error unknown global
				await stone.getGlobal({ global: 'navigation' });

				// @ts-expect-error missing configured field
				await stone.create({ collection: 'posts', data: { description: 'Body' } });

				// @ts-expect-error unknown collection
				await stone.find({ collection: 'pages' });
			}
		`;
    const diagnostics = getDiagnostics(source);

    expect(diagnostics).toEqual([]);
  });

  it("types `where` clauses against generated collection fields", () => {
    const source = `
			import { getFieldstone } from '@hugo-hsi-dev/runtime';
			import type { FieldstoneConfig } from '@hugo-hsi-dev/schema';

			declare module '@hugo-hsi-dev/schema' {
				interface GeneratedCollections {
					"posts": {
						id: string;
						title: string;
						views: number;
						publishedAt: Date;
						featured: boolean;
						category: "news" | "blog";
						tags: string[];
						seo: { title: string };
						_status?: "draft" | "published";
						createdAt: Date;
						updatedAt: Date;
					};
				}
			}

			const config = {
				db: { dialect: 'sqlite', url: ':memory:' },
				collections: {}
			} satisfies FieldstoneConfig;

			async function run() {
				const stone = await getFieldstone({ config });

				await stone.find({ collection: 'posts', where: { title: { equals: 'x', like: 'y' } } });
				await stone.find({ collection: 'posts', where: { views: { greater_than: 10, in: [1, 2] } } });
				await stone.find({ collection: 'posts', where: { publishedAt: { less_than: new Date() } } });
				await stone.find({ collection: 'posts', where: { publishedAt: { less_than: '2020-01-01' } } });
				await stone.find({ collection: 'posts', where: { featured: { equals: true } } });
				await stone.find({ collection: 'posts', where: { category: { equals: 'news' } } });
				await stone.find({ collection: 'posts', where: { id: { equals: 'x' }, createdAt: { greater_than: new Date() } } });
				await stone.count({ collection: 'posts', where: { and: [{ views: { greater_than: 1 } }], or: [{ featured: { equals: false } }] } });

				// @ts-expect-error greater_than is not valid on a boolean field
				await stone.find({ collection: 'posts', where: { featured: { greater_than: 1 } } });
				// @ts-expect-error wrong value type for a number field
				await stone.find({ collection: 'posts', where: { views: { equals: 'nope' } } });
				// @ts-expect-error unknown field
				await stone.find({ collection: 'posts', where: { missing: { equals: 1 } } });
				// @ts-expect-error group field is not filterable
				await stone.find({ collection: 'posts', where: { seo: { equals: 'x' } } });
				// @ts-expect-error hasMany field is not filterable
				await stone.find({ collection: 'posts', where: { tags: { equals: 'x' } } });
				// @ts-expect-error _status is excluded from where (use the status option)
				await stone.find({ collection: 'posts', where: { _status: { equals: 'draft' } } });
				// @ts-expect-error value outside the select union
				await stone.find({ collection: 'posts', where: { category: { equals: 'other' } } });
				// @ts-expect-error like is not valid on a number field
				await stone.find({ collection: 'posts', where: { views: { like: 'x' } } });
			}
		`;
    const diagnostics = getDiagnostics(source);

    expect(diagnostics).toEqual([]);
  });

  it("types `depth`-populated relations as the target document", () => {
    const source = `
			import { getFieldstone } from '@hugo-hsi-dev/runtime';
			import type { FieldstoneConfig } from '@hugo-hsi-dev/schema';

			declare module '@hugo-hsi-dev/schema' {
				interface GeneratedCollections {
					"authors": { id: string; name: string; mentor: string; createdAt: Date; updatedAt: Date; };
					"posts": {
						id: string;
						title: string;
						author: string;
						editors: string[];
						createdAt: Date;
						updatedAt: Date;
					};
				}
				interface GeneratedCollectionRelations {
					"authors": { "mentor": { to: "authors"; many: false }; };
					"posts": {
						"author": { to: "authors"; many: false };
						"editors": { to: "authors"; many: true };
					};
				}
			}

			const config = {
				db: { dialect: 'sqlite', url: ':memory:' },
				collections: {}
			} satisfies FieldstoneConfig;

			async function run() {
				const stone = await getFieldstone({ config });

				// depth 0 (default): relations are ids
				const plain = await stone.find({ collection: 'posts' });
				const authorId: string = plain[0].author;
				const editorIds: string[] = plain[0].editors;
				const plainTitle: string = plain[0].title;

				// depth 1: relations become the target document(s)
				const populated = await stone.find({ collection: 'posts', depth: 1 });
				const author = populated[0].author;
				if (author) {
					const authorName: string = author.name;
				}
				// hasMany relations are Doc[] | null (an unset hasMany stays null)
				const editors = populated[0].editors;
				if (editors) {
					const editorName: string = editors[0].name;
				}
				const populatedTitle: string = populated[0].title;

				// findById depth 1
				const doc = await stone.findById({ collection: 'posts', id: 'x', depth: 1 });
				if (doc && doc.author) {
					const n: string = doc.author.name;
				}

				// depth 2: author.mentor becomes the mentor document
				const deep = await stone.find({ collection: 'posts', depth: 2 });
				const deepAuthor = deep[0].author;
				if (deepAuthor && deepAuthor.mentor) {
					const mentorName: string = deepAuthor.mentor.name;
				}

				// depth 1: author.mentor stays a string id
				const shallow = populated[0].author;
				if (shallow) {
					// @ts-expect-error author.mentor is a string id at depth 1, not a document
					const wrongMentor: string = shallow.mentor.name;
				}

				// @ts-expect-error at depth 0, author is a string id, not a document
				const wrong: string = plain[0].author.name;
			}
		`;
    const diagnostics = getDiagnostics(source);

    expect(diagnostics).toEqual([]);
  });

  it("handles Document reads, mutations, validation, timestamps, and missing rows", async () => {
    const { cleanup, config } = await createRuntimeFixture();

    try {
      const stone = await getFieldstone({ config });
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      const updatedAt = new Date("2026-01-02T00:00:00.000Z");

      await expect(
        stone.create({
          collection: "posts",
          data: { description: "Missing title" },
        }),
      ).rejects.toThrow("title is required");
      await expect(
        stone.create({
          collection: "posts",
          data: {
            title: "Hello",
            description: "Body",
            published: true,
            extra: "Nope",
          },
        }),
      ).rejects.toThrow("Unknown field: extra");

      const created = await stone.create({
        collection: "posts",
        createdAt,
        data: { title: " Hello ", description: " Body ", published: true },
        updatedAt,
      });

      expect(created).toMatchObject({
        title: "Hello",
        description: "Body",
        published: true,
        createdAt,
        updatedAt,
      });

      const emptyOptional = await stone.create({
        collection: "posts",
        data: { title: "Empty optional", description: "" },
      });
      expect(emptyOptional.description).toBeNull();
      expect(emptyOptional.published).toBe(false);

      const omittedOptional = await stone.create({
        collection: "posts",
        data: { title: "Omitted optional" },
      });
      expect(omittedOptional.description).toBeNull();
      expect(omittedOptional.published).toBe(false);

      const listed = await stone.find({ collection: "posts" });
      expect(listed).toHaveLength(3);
      expect(
        await stone.findById({ collection: "posts", id: created.id }),
      ).toMatchObject({
        id: created.id,
        title: "Hello",
        published: true,
      });
      expect(
        await stone.findById({ collection: "posts", id: "missing" }),
      ).toBeNull();

      const defaulted = await stone.create({
        collection: "posts",
        data: { title: "Default timestamps", description: "Generated" },
      });
      expect(defaulted.createdAt).toBeInstanceOf(Date);
      expect(defaulted.updatedAt).toBeInstanceOf(Date);

      const updateTime = new Date("2026-01-03T00:00:00.000Z");
      const updated = await stone.update({
        collection: "posts",
        data: { title: " Updated ", description: " Again ", published: false },
        id: created.id,
        updatedAt: updateTime,
      });
      expect(updated).toMatchObject({
        id: created.id,
        title: "Updated",
        description: "Again",
        published: false,
        updatedAt: updateTime,
      });

      const cleared = await stone.update({
        collection: "posts",
        data: { title: "Cleared optional" },
        id: created.id,
      });
      expect(cleared.description).toBeNull();
      expect(cleared.published).toBe(false);

      await expect(
        stone.update({
          collection: "posts",
          data: { title: "Missing", description: "Missing" },
          id: "missing",
        }),
      ).rejects.toThrow("Document not found");
      await expect(
        stone.delete({ collection: "posts", id: "missing" }),
      ).rejects.toThrow("Document not found");

      expect(await stone.getGlobal({ global: "site-settings" })).toBeNull();
      await expect(
        stone.updateGlobal({
          global: "site-settings",
          data: { tagline: "Missing title" },
        }),
      ).rejects.toThrow("siteTitle is required");

      const updatedGlobalAt = new Date("2026-01-04T00:00:00.000Z");
      const [firstConcurrentSave, secondConcurrentSave] = await Promise.all([
        stone.updateGlobal({
          global: "site-settings",
          data: {
            siteTitle: "Concurrent first save",
            tagline: "First",
            showBanner: true,
          },
        }),
        stone.updateGlobal({
          global: "site-settings",
          data: {
            siteTitle: "Concurrent first save",
            tagline: "Second",
            showBanner: false,
          },
        }),
      ]);
      expect(firstConcurrentSave.id).toBe("global");
      expect(secondConcurrentSave.id).toBe("global");
      await expect(
        stone.getGlobal({ global: "site-settings" }),
      ).resolves.toMatchObject({
        id: "global",
      });

      const settings = await stone.updateGlobal({
        global: "site-settings",
        data: { siteTitle: " Fieldstone ", tagline: " CMS ", showBanner: true },
        updatedAt: updatedGlobalAt,
      });
      expect(settings).toMatchObject({
        id: "global",
        siteTitle: "Fieldstone",
        tagline: "CMS",
        showBanner: true,
        updatedAt: updatedGlobalAt,
      });

      const changedSettings = await stone.updateGlobal({
        global: "site-settings",
        data: { siteTitle: "Fieldstone", tagline: "", showBanner: false },
      });
      expect(changedSettings.id).toBe("global");
      expect(changedSettings.tagline).toBeNull();
      await expect(
        stone.getGlobal({ global: "site-settings" }),
      ).resolves.toMatchObject({
        id: "global",
        siteTitle: "Fieldstone",
        tagline: null,
        showBanner: false,
      });
    } finally {
      await cleanup();
    }
  });

  it("stores and reads number, date, email, and select fields", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-types-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table products (
        id text primary key not null,
        name text not null,
        price real not null,
        launchDate integer,
        contact text,
        status text,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        products: {
          ...collection({
            fields: [
              text({ name: "name", required: true }),
              number({ name: "price", required: true, min: 0 }),
              date({ name: "launchDate" }),
              email({ name: "contact" }),
              select({
                name: "status",
                options: ["draft", "active"],
                defaultValue: "draft",
              }),
            ],
          }),
          slug: "products",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });

      const launch = new Date("2026-06-01T00:00:00.000Z");
      const created = await stone.create({
        collection: "products",
        data: {
          name: "Widget",
          price: "19.99",
          launchDate: launch.toISOString(),
          contact: "sales@example.com",
        },
      });

      expect(created).toMatchObject({
        name: "Widget",
        price: 19.99,
        contact: "sales@example.com",
        status: "draft",
      });
      expect(created.launchDate).toBeInstanceOf(Date);
      expect((created.launchDate as Date).toISOString()).toBe(
        launch.toISOString(),
      );

      const fetched = await stone.findById({
        collection: "products",
        id: created.id,
      });
      expect(fetched?.price).toBe(19.99);
      expect(fetched?.launchDate).toBeInstanceOf(Date);

      await expect(
        stone.create({
          collection: "products",
          data: { name: "Bad", price: "-5" },
        }),
      ).rejects.toThrow("price must be at least 0");
      await expect(
        stone.create({
          collection: "products",
          data: { name: "Bad", price: "1", contact: "nope" },
        }),
      ).rejects.toThrow("contact must be a valid email");
      await expect(
        stone.create({
          collection: "products",
          data: { name: "Bad", price: "1", status: "archived" },
        }),
      ).rejects.toThrow("status must be one of: draft, active");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("stores single and hasMany relationship ids", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-rel-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table authors (
        id text primary key not null,
        name text not null,
        created_at integer not null,
        updated_at integer not null
      );
      create table posts (
        id text primary key not null,
        title text not null,
        author text not null,
        editors text,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        authors: {
          ...collection({ fields: [text({ name: "name", required: true })] }),
          slug: "authors",
        },
        posts: {
          ...collection({
            fields: [
              text({ name: "title", required: true }),
              relationship({ name: "author", relationTo: "authors", required: true }),
              relationship({ name: "editors", relationTo: "authors", hasMany: true }),
            ],
          }),
          slug: "posts",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });
      const ada = await stone.create({
        collection: "authors",
        data: { name: "Ada" },
      });
      const grace = await stone.create({
        collection: "authors",
        data: { name: "Grace" },
      });

      const post = await stone.create({
        collection: "posts",
        data: {
          title: "Hello",
          author: ada.id,
          editors: [ada.id, grace.id],
        },
      });
      expect(post.author).toBe(ada.id);
      expect(post.editors).toEqual([ada.id, grace.id]);

      const fetched = await stone.findById({ collection: "posts", id: post.id });
      expect(fetched?.author).toBe(ada.id);
      expect(fetched?.editors).toEqual([ada.id, grace.id]);

      await expect(
        stone.create({ collection: "posts", data: { title: "No author" } }),
      ).rejects.toThrow("author is required");

      const noEditors = await stone.create({
        collection: "posts",
        data: { title: "Solo", author: grace.id },
      });
      expect(noEditors.editors).toBeNull();
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("populates relationship fields with depth (access-checked, missing → null)", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-populate-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table authors (
        id text primary key not null,
        name text not null,
        created_at integer not null,
        updated_at integer not null
      );
      create table posts (
        id text primary key not null,
        title text not null,
        author text,
        editors text,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        authors: {
          ...collection({
            fields: [text({ name: "name", required: true })],
            access: { read: ({ user }) => Boolean(user) },
          }),
          slug: "authors",
        },
        posts: {
          ...collection({
            fields: [
              text({ name: "title", required: true }),
              relationship({ name: "author", relationTo: "authors" }),
              relationship({ name: "editors", relationTo: "authors", hasMany: true }),
            ],
          }),
          slug: "posts",
        },
      },
    };

    const user = { id: "u1" };
    try {
      const stone = await getFieldstone({ config });
      const ada = await stone.create({ collection: "authors", data: { name: "Ada" } });
      const grace = await stone.create({ collection: "authors", data: { name: "Grace" } });
      const post = await stone.create({
        collection: "posts",
        data: { title: "Hello", author: ada.id, editors: [ada.id, grace.id] },
      });

      // depth 0 (default) → ids unchanged
      const plain = await stone.findById({ collection: "posts", id: post.id, user });
      expect(plain?.author).toBe(ada.id);
      expect(plain?.editors).toEqual([ada.id, grace.id]);

      // depth 1 → relation fields become the target documents
      const populated = await stone.findById({ collection: "posts", id: post.id, depth: 1, user });
      expect((populated!.author as { name: string }).name).toBe("Ada");
      expect((populated!.editors as { name: string }[]).map((editor) => editor.name)).toEqual([
        "Ada",
        "Grace",
      ]);

      // find() populates too
      const [listed] = await stone.find({ collection: "posts", depth: 1, user });
      expect((listed.author as { name: string }).name).toBe("Ada");

      // an unset (non-required) hasMany relation stays null at depth 1, not []
      const solo = await stone.create({
        collection: "posts",
        data: { title: "Solo", author: ada.id },
      });
      const soloPopulated = await stone.findById({
        collection: "posts",
        id: solo.id,
        depth: 1,
        user,
      });
      expect(soloPopulated!.editors).toBeNull();
      expect((soloPopulated!.author as { name: string }).name).toBe("Ada");

      // read-forbidden target (no user) → single null, hasMany []
      const forbidden = await stone.findById({ collection: "posts", id: post.id, depth: 1 });
      expect(forbidden?.author).toBeNull();
      expect(forbidden?.editors).toEqual([]);

      // missing ids → single null, hasMany drops the missing entry
      await stone.update({
        collection: "posts",
        id: post.id,
        merge: true,
        data: { author: "missing-id", editors: [ada.id, "missing-id"] },
      });
      const withMissing = await stone.findById({ collection: "posts", id: post.id, depth: 1, user });
      expect(withMissing!.author).toBeNull();
      expect((withMissing!.editors as { name: string }[]).map((editor) => editor.name)).toEqual([
        "Ada",
      ]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("applies row-grain read rules to populated relations (drops forbidden ids)", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-populate-row-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table authors (
        id text primary key not null,
        name text not null,
        created_at integer not null,
        updated_at integer not null
      );
      create table posts (
        id text primary key not null,
        title text not null,
        author text,
        editors text,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    let blockedId = "__none__";
    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        authors: {
          ...collection({
            fields: [text({ name: "name", required: true })],
            // Row-grain read rule: deny one author by id. Collection-grain listing
            // is allowed (the `!id` branch), so only populate's per-row check drops it.
            access: { read: ({ id }) => !id || id !== blockedId },
          }),
          slug: "authors",
        },
        posts: {
          ...collection({
            fields: [
              text({ name: "title", required: true }),
              relationship({ name: "author", relationTo: "authors" }),
              relationship({ name: "editors", relationTo: "authors", hasMany: true }),
            ],
          }),
          slug: "posts",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });
      const ada = await stone.create({ collection: "authors", data: { name: "Ada" } });
      const blocked = await stone.create({ collection: "authors", data: { name: "Blocked" } });
      blockedId = blocked.id;

      const post = await stone.create({
        collection: "posts",
        data: { title: "Hello", author: blocked.id, editors: [ada.id, blocked.id] },
      });

      const populated = await stone.findById({ collection: "posts", id: post.id, depth: 1 });
      // The blocked author is dropped per-row — populate can't embed a row the
      // caller couldn't read via findById.
      expect(populated!.author).toBeNull();
      expect((populated!.editors as { name: string }[]).map((editor) => editor.name)).toEqual([
        "Ada",
      ]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("populates recursively to the requested depth and bounds circular relations", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-populate-deep-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table authors (
        id text primary key not null,
        name text not null,
        mentor text,
        created_at integer not null,
        updated_at integer not null
      );
      create table posts (
        id text primary key not null,
        title text not null,
        author text,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        authors: {
          ...collection({
            fields: [
              text({ name: "name", required: true }),
              relationship({ name: "mentor", relationTo: "authors" }),
            ],
          }),
          slug: "authors",
        },
        posts: {
          ...collection({
            fields: [
              text({ name: "title", required: true }),
              relationship({ name: "author", relationTo: "authors" }),
            ],
          }),
          slug: "posts",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });
      const mentor = await stone.create({ collection: "authors", data: { name: "Mentor" } });
      const ada = await stone.create({
        collection: "authors",
        data: { name: "Ada", mentor: mentor.id },
      });
      const post = await stone.create({
        collection: "posts",
        data: { title: "Hello", author: ada.id },
      });

      // depth 1: author is a doc, but author.mentor stays an id
      const d1 = await stone.findById({ collection: "posts", id: post.id, depth: 1 });
      const d1Author = d1!.author as { name: string; mentor: unknown };
      expect(d1Author.name).toBe("Ada");
      expect(d1Author.mentor).toBe(mentor.id);

      // depth 2: author.mentor is now the mentor document
      const d2 = await stone.findById({ collection: "posts", id: post.id, depth: 2 });
      const d2Author = d2!.author as { mentor: { name: string } };
      expect(d2Author.mentor.name).toBe("Mentor");

      // circular relation (mentor mentors Ada) terminates — depth bounds it
      await stone.update({
        collection: "authors",
        id: mentor.id,
        merge: true,
        data: { mentor: ada.id },
      });
      const cyclic = await stone.findById({ collection: "posts", id: post.id, depth: 5 });
      expect((cyclic!.author as { name: string }).name).toBe("Ada");

      // a non-integer / Infinity depth is rejected (would otherwise recurse forever)
      await expect(
        stone.findById({ collection: "posts", id: post.id, depth: Infinity }),
      ).rejects.toThrow(/depth/);
      await expect(
        stone.findById({ collection: "posts", id: post.id, depth: 1.5 }),
      ).rejects.toThrow(/depth/);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("creates media docs and references them through upload fields", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-upload-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table media (
        id text primary key not null,
        alt text,
        filename text,
        mimeType text,
        filesize real,
        width real,
        height real,
        focalX real,
        focalY real,
        sizes text,
        created_at integer not null,
        updated_at integer not null
      );
      create table posts (
        id text primary key not null,
        title text not null,
        cover text not null,
        gallery text,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        media: {
          ...collection({ fields: [text({ name: "alt" })], upload: {} }),
          slug: "media",
        },
        posts: {
          ...collection({
            fields: [
              text({ name: "title", required: true }),
              upload({ name: "cover", relationTo: "media", required: true }),
              upload({ name: "gallery", relationTo: "media", hasMany: true }),
            ],
          }),
          slug: "posts",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });
      // A media doc is created with no injected metadata — the upload pipeline
      // populates it, so the create path must never force filename/mimeType/etc.
      const logo = await stone.create({
        collection: "media",
        data: { alt: "Logo" },
      });
      expect(logo.filename).toBeNull();
      const hero = await stone.create({
        collection: "media",
        data: { alt: "Hero" },
      });

      const post = await stone.create({
        collection: "posts",
        data: { title: "Hello", cover: logo.id, gallery: [logo.id, hero.id] },
      });
      expect(post.cover).toBe(logo.id);
      expect(post.gallery).toEqual([logo.id, hero.id]);

      const fetched = await stone.findById({ collection: "posts", id: post.id });
      expect(fetched?.cover).toBe(logo.id);
      expect(fetched?.gallery).toEqual([logo.id, hero.id]);

      await expect(
        stone.create({ collection: "posts", data: { title: "No cover" } }),
      ).rejects.toThrow("cover is required");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("defaults and filters draft status", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-drafts-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table posts (
        id text primary key not null,
        title text not null,
        _status text not null,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        posts: {
          ...collection({
            fields: [text({ name: "title", required: true })],
            drafts: true,
          }),
          slug: "posts",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });

      const draft = await stone.create({
        collection: "posts",
        data: { title: "A draft" },
      });
      expect((draft as Record<string, unknown>)._status).toBe("draft");

      const published = await stone.create({
        collection: "posts",
        data: { title: "Live", _status: "published" },
      });
      expect((published as Record<string, unknown>)._status).toBe("published");

      const onlyPublished = await stone.find({
        collection: "posts",
        status: "published",
      });
      expect(onlyPublished).toHaveLength(1);
      expect((onlyPublished[0] as Record<string, unknown>).title).toBe("Live");

      const everything = await stone.find({ collection: "posts" });
      expect(everything).toHaveLength(2);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("paginates, sorts, searches, and counts documents", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-list-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table posts (
        id text primary key not null,
        title text not null,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        posts: {
          ...collection({ fields: [text({ name: "title", required: true })] }),
          slug: "posts",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });
      const titles = ["Apple", "Banana", "Cherry", "apricot"];
      for (const [index, title] of titles.entries()) {
        await stone.create({
          collection: "posts",
          data: { title },
          createdAt: new Date(Date.UTC(2026, 0, index + 1)),
        });
      }

      expect(await stone.count({ collection: "posts" })).toBe(4);

      const matches = await stone.find({ collection: "posts", search: "ap" });
      expect(matches.map((doc) => doc.title).sort()).toEqual(["Apple", "apricot"]);
      expect(await stone.count({ collection: "posts", search: "ap" })).toBe(2);

      const page1 = await stone.find({ collection: "posts", limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);
      const page2 = await stone.find({ collection: "posts", limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
      expect(new Set([...page1, ...page2].map((doc) => doc.title)).size).toBe(4);

      const sorted = await stone.find({
        collection: "posts",
        sort: { field: "title", direction: "asc" },
      });
      expect(sorted.map((doc) => doc.title)).toEqual([
        "Apple",
        "Banana",
        "Cherry",
        "apricot",
      ]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("enforces collection access functions", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-access-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table secrets (
        id text primary key not null,
        title text not null,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        secrets: {
          ...collection({
            fields: [text({ name: "title", required: true })],
            access: {
              read: ({ user }) => Boolean(user),
              create: ({ user }) => Boolean(user),
              delete: () => false,
            },
          }),
          slug: "secrets",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });

      await expect(stone.find({ collection: "secrets" })).rejects.toThrow("Forbidden");
      expect(await stone.find({ collection: "secrets", user: { id: "u1" } })).toEqual([]);

      await expect(
        stone.create({ collection: "secrets", data: { title: "x" } }),
      ).rejects.toThrow("Forbidden");

      const created = await stone.create({
        collection: "secrets",
        data: { title: "Secret" },
        user: { id: "u1" },
      });
      expect(created.title).toBe("Secret");

      await expect(
        stone.delete({ collection: "secrets", id: created.id, user: { id: "u1" } }),
      ).rejects.toThrow("Forbidden");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("runs collection lifecycle hooks", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-hooks-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table notes (
        id text primary key not null,
        title text not null,
        slug text,
        created_at integer not null,
        updated_at integer not null
      );
    `);
    client.close();

    const events: string[] = [];
    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: dbPath },
      collections: {
        notes: {
          ...collection({
            fields: [
              text({ name: "title", required: true }),
              text({ name: "slug" }),
            ],
            hooks: {
              beforeChange: [
                ({ data, operation }) => {
                  events.push(`beforeChange:${operation}`);
                  if (!data.slug && typeof data.title === "string")
                    return {
                      ...data,
                      slug: data.title.toLowerCase().replace(/\s+/g, "-"),
                    };
                },
              ],
              afterChange: [
                ({ operation }) => {
                  events.push(`afterChange:${operation}`);
                },
              ],
              afterRead: [
                ({ doc }) => ({ ...doc, title: String(doc.title).toUpperCase() }),
              ],
              beforeDelete: [
                () => {
                  events.push("beforeDelete");
                },
              ],
              afterDelete: [
                ({ doc }) => {
                  events.push(`afterDelete:${String(doc.title)}`);
                },
              ],
            },
          }),
          slug: "notes",
        },
      },
    };

    try {
      const stone = await getFieldstone({ config });

      const created = await stone.create({
        collection: "notes",
        data: { title: "Hello World" },
      });
      // beforeChange derived the slug; afterRead is not applied to write results.
      expect(created.slug).toBe("hello-world");
      expect(created.title).toBe("Hello World");
      expect(events).toContain("beforeChange:create");
      expect(events).toContain("afterChange:create");

      const found = await stone.findById({ collection: "notes", id: created.id });
      expect(found?.title).toBe("HELLO WORLD");
      expect(found?.slug).toBe("hello-world");

      const listed = await stone.find({ collection: "notes" });
      expect(listed[0]?.title).toBe("HELLO WORLD");

      const updated = await stone.update({
        collection: "notes",
        data: { title: "New Title" },
        id: created.id,
      });
      expect(updated.slug).toBe("new-title");
      expect(events).toContain("beforeChange:update");
      expect(events).toContain("afterChange:update");

      // Updating a missing id must not fire change hooks for a row that never existed.
      events.length = 0;
      await expect(
        stone.update({ collection: "notes", data: { title: "x" }, id: "missing" }),
      ).rejects.toThrow("Document not found");
      expect(events).not.toContain("beforeChange:update");

      await stone.delete({ collection: "notes", id: created.id });
      expect(events).toContain("beforeDelete");
      expect(events).toContain("afterDelete:New Title");

      // Deleting a missing id must not fire delete hooks for a row that never existed.
      events.length = 0;
      await expect(
        stone.delete({ collection: "notes", id: "missing" }),
      ).rejects.toThrow("Document not found");
      expect(events).not.toContain("beforeDelete");
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});

async function createRuntimeFixture() {
  const tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-runtime-"));
  const dbPath = path.join(tempDir, "test.db");
  const client = createClient({ url: `file:${dbPath}` });
  await client.executeMultiple(`
			create table posts (
					id text primary key not null,
					title text not null,
					description text,
					published integer not null,
					created_at integer not null,
					updated_at integer not null
			);
			create table "site-settings" (
					id text primary key not null,
					siteTitle text not null,
					tagline text,
					showBanner integer not null,
					created_at integer not null,
					updated_at integer not null
			);
		`);
  client.close();

  const config: FieldstoneConfig = {
    db: { dialect: "sqlite", url: dbPath },
    collections: {
      posts: {
        ...collection({
          fields: [
            text({ name: "title", required: true }),
            text({ name: "description" }),
            boolean({ name: "published" }),
          ],
        }),
        slug: "posts",
      },
    },
    globals: {
      "site-settings": {
        ...global({
          fields: [
            text({ name: "siteTitle", required: true }),
            text({ name: "tagline" }),
            boolean({ name: "showBanner" }),
          ],
        }),
        slug: "site-settings",
      },
    },
  };

  return {
    cleanup: () => rm(tempDir, { force: true, recursive: true }),
    config,
  };
}

function getDiagnostics(source: string) {
  const rootDir = process.cwd().replace(/\/packages\/runtime$/, "");
  const fileName = `${rootDir}/type-test.ts`;
  const compilerOptions = {
    allowImportingTsExtensions: true,
    baseUrl: rootDir,
    ignoreDeprecations: "6.0",
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    paths: {
      "@hugo-hsi-dev/runtime": ["packages/runtime/src/index.ts"],
      "@hugo-hsi-dev/schema": ["packages/schema/src/index.ts"],
    },
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ESNext,
    typeRoots: [`${rootDir}/test/minimal/node_modules/@types`],
    types: ["node"],
  } satisfies ts.CompilerOptions;
  const host = ts.createCompilerHost(compilerOptions);
  const originalReadFile = host.readFile;
  const originalFileExists = host.fileExists;

  host.readFile = (requestedFileName) =>
    requestedFileName === fileName
      ? source
      : originalReadFile(requestedFileName);
  host.fileExists = (requestedFileName) =>
    requestedFileName === fileName || originalFileExists(requestedFileName);

  const program = ts.createProgram([fileName], compilerOptions, host);
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
}
