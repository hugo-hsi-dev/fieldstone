import { createClient } from "@libsql/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collection, global, text } from "@fieldstone/schema";

import { createFieldstoneAdmin } from "../src/index.ts";

describe("fieldstone admin runtime", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-admin-"));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it("creates and lists documents through admin methods", async () => {
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
			create table posts (
				id text primary key not null,
				title text not null,
				description text not null,
				created_at integer not null,
				updated_at integer not null
			);
			create table "site-settings" (
				id text primary key not null,
				siteTitle text not null,
				created_at integer not null,
				updated_at integer not null
			);
		`);
    client.close();
    const admin = await createFieldstoneAdmin({
      config: {
        db: { dialect: "sqlite", url: dbPath },
        collections: {
          posts: {
            ...collection({
              fields: [
                text({ name: "title", required: true }),
                text({ name: "description", multiline: true, required: true }),
              ],
            }),
            slug: "posts",
          },
        },
        globals: {
          "site-settings": {
            ...global({
              fields: [text({ name: "siteTitle", required: true })],
            }),
            slug: "site-settings",
          },
        },
      },
    });

    await admin.createDocument({
      collection: "posts",
      data: { title: "Admin post", description: "Created from admin service" },
    });

    const documents = await admin.listDocuments({ collection: "posts" });

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      title: "Admin post",
      description: "Created from admin service",
    });
    expect(admin.getCollection("posts")).toMatchObject({ slug: "posts" });
    expect(admin.getCollection("posts")?.fields[0]).toMatchObject({
      identifier: "title",
      name: "title",
      required: true,
    });
    expect(admin.collections).toHaveLength(1);
    expect(admin.globals).toHaveLength(1);
    expect(admin.getGlobalConfig("site-settings")).toMatchObject({
      slug: "site-settings",
    });

    expect(await admin.getGlobal({ global: "site-settings" })).toBeNull();
    const settings = await admin.updateGlobal({
      global: "site-settings",
      data: { siteTitle: "Fieldstone" },
    });
    expect(settings).toMatchObject({ id: "global", siteTitle: "Fieldstone" });
    await expect(
      admin.getGlobal({ global: "site-settings" }),
    ).resolves.toMatchObject({
      siteTitle: "Fieldstone",
    });
  });
});
