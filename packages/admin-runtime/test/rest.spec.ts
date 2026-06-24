import { createClient } from "@libsql/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collection, global, number, text } from "@hugo-hsi-dev/schema";

import { createFieldstoneRest } from "../src/index.ts";

describe("fieldstone REST handler", () => {
  let tempDir: string;
  let rest: ReturnType<typeof createFieldstoneRest>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-rest-"));
    const dbPath = path.join(tempDir, "test.db");
    const client = createClient({ url: `file:${dbPath}` });
    await client.executeMultiple(`
      create table posts (
        id text primary key not null,
        title text not null,
        views real,
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

    rest = createFieldstoneRest({
      config: {
        db: { dialect: "sqlite", url: dbPath },
        collections: {
          posts: {
            ...collection({
              fields: [
                text({ name: "title", required: true }),
                number({ name: "views" }),
              ],
            }),
            slug: "posts",
          },
        },
        globals: {
          "site-settings": {
            ...global({ fields: [text({ name: "siteTitle", required: true })] }),
            slug: "site-settings",
          },
        },
      },
    });
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  function call(method: string, segments: string[], body?: unknown) {
    const request = new Request(`http://localhost/api/${segments.join("/")}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return rest.handle(request, segments);
  }

  it("performs collection CRUD over HTTP", async () => {
    const createRes = await call("POST", ["posts"], { title: "Hello", views: 5 });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as Record<string, unknown>;
    expect(created.title).toBe("Hello");
    expect(created.views).toBe(5);
    const id = created.id as string;

    const listRes = await call("GET", ["posts"]);
    expect(listRes.status).toBe(200);
    const { docs } = (await listRes.json()) as { docs: unknown[] };
    expect(docs).toHaveLength(1);

    const getRes = await call("GET", ["posts", id]);
    expect(((await getRes.json()) as Record<string, unknown>).title).toBe("Hello");

    const updateRes = await call("PATCH", ["posts", id], {
      title: "Updated",
      views: 9,
    });
    expect(updateRes.status).toBe(200);
    expect(((await updateRes.json()) as Record<string, unknown>).title).toBe(
      "Updated",
    );

    const missingRes = await call("GET", ["posts", "missing"]);
    expect(missingRes.status).toBe(404);

    const invalidRes = await call("POST", ["posts"], {});
    expect(invalidRes.status).toBe(400);
    expect(((await invalidRes.json()) as { error: string }).error).toContain(
      "title is required",
    );

    const deleteRes = await call("DELETE", ["posts", id]);
    expect(deleteRes.status).toBe(200);
    expect((await call("GET", ["posts", id])).status).toBe(404);
  });

  it("merges partial PATCH bodies instead of replacing the document", async () => {
    const created = (await (
      await call("POST", ["posts"], { title: "Original", views: 5 })
    ).json()) as Record<string, unknown>;
    const id = created.id as string;

    // Omitting the required `title` must not fail or clear it.
    const patched = (await (
      await call("PATCH", ["posts", id], { views: 9 })
    ).json()) as Record<string, unknown>;
    expect(patched.title).toBe("Original");
    expect(patched.views).toBe(9);

    // Omitting the optional `views` must preserve it rather than reset to null.
    const renamed = (await (
      await call("PATCH", ["posts", id], { title: "Renamed" })
    ).json()) as Record<string, unknown>;
    expect(renamed.title).toBe("Renamed");
    expect(renamed.views).toBe(9);

    expect((await call("PATCH", ["posts", "missing"], { views: 1 })).status).toBe(404);

    // A typo'd field is rejected, not silently dropped.
    const unknown = await call("PATCH", ["posts", id], { titel: "typo" });
    expect(unknown.status).toBe(400);
    expect(((await unknown.json()) as { error: string }).error).toContain("Unknown field");
  });

  it("rejects an invalid status query value instead of dropping the filter", async () => {
    const req = new Request("http://localhost/api/posts?status=publised", { method: "GET" });
    const res = await rest.handle(req, ["posts"]);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("Invalid status");
  });

  it("filters a collection list with a typed where param", async () => {
    await call("POST", ["posts"], { title: "Alpha", views: 5 });
    await call("POST", ["posts"], { title: "Beta", views: 50 });
    await call("POST", ["posts"], { title: "Gamma", views: 5 });

    const where = encodeURIComponent(JSON.stringify({ views: { greater_than: 10 } }));
    const res = await rest.handle(
      new Request(`http://localhost/api/posts?where=${where}`, { method: "GET" }),
      ["posts"],
    );
    expect(res.status).toBe(200);
    const { docs, total } = (await res.json()) as {
      docs: { title: string }[];
      total: number;
    };
    expect(docs.map((doc) => doc.title)).toEqual(["Beta"]);
    expect(total).toBe(1);

    // an invalid field surfaces as a 400 via the runtime validation + error wrapper
    const badWhere = encodeURIComponent(JSON.stringify({ nope: { equals: 1 } }));
    const badRes = await rest.handle(
      new Request(`http://localhost/api/posts?where=${badWhere}`, { method: "GET" }),
      ["posts"],
    );
    expect(badRes.status).toBe(400);

    // malformed JSON → 400
    const malformedRes = await rest.handle(
      new Request("http://localhost/api/posts?where=not-json", { method: "GET" }),
      ["posts"],
    );
    expect(malformedRes.status).toBe(400);
    expect(((await malformedRes.json()) as { error: string }).error).toContain(
      "Invalid where",
    );
  });

  it("handles globals, unknown routes, and method errors", async () => {
    expect(await (await call("GET", ["globals", "site-settings"])).json()).toBeNull();

    const saved = await call("POST", ["globals", "site-settings"], {
      siteTitle: "Hi",
    });
    expect(((await saved.json()) as Record<string, unknown>).siteTitle).toBe("Hi");

    expect((await call("GET", ["nope"])).status).toBe(404);
    expect((await call("DELETE", ["posts"])).status).toBe(405);
    expect((await call("GET", ["globals", "missing"])).status).toBe(404);
  });
});
