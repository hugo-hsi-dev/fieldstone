import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeAll, describe, expect, it } from "vitest";

import { compileFieldstoneConfig } from "@hugo-hsi-dev/compiler";
import {
  boolean,
  collection,
  date,
  group,
  number,
  relationship,
  select,
  text,
  type FieldstoneConfig,
} from "@hugo-hsi-dev/schema";

import { buildWhere, type WhereClause } from "../src/where.js";

const config: FieldstoneConfig = {
  db: { dialect: "sqlite", url: ":memory:" },
  collections: {
    authors: { ...collection({ fields: [text({ name: "name" })] }), slug: "authors" },
    posts: {
      ...collection({
        fields: [
          text({ name: "title" }),
          number({ name: "views" }),
          date({ name: "publishedAt" }),
          boolean({ name: "featured" }),
          select({ name: "category", options: ["a", "b"] }),
          relationship({ name: "author", relationTo: "authors" }),
          relationship({ name: "tags", relationTo: "authors", hasMany: true }),
          group({ name: "seo", fields: [text({ name: "title" })] }),
        ],
      }),
      slug: "posts",
    },
  },
};

const compiled = compileFieldstoneConfig(config);
const fields = compiled.getCollection("posts")!.fields;
const table = compiled.renderRuntimeSchema().tables.posts;
const db = drizzle(createClient({ url: ":memory:" }));

function sqlFor(where: WhereClause) {
  const condition = buildWhere(where, table, fields);
  return db
    .select()
    .from(table)
    .where(condition as never)
    .toSQL();
}

describe("buildWhere — SQL translation", () => {
  it("returns undefined for an empty clause", () => {
    expect(buildWhere(undefined, table, fields)).toBeUndefined();
    expect(buildWhere({}, table, fields)).toBeUndefined();
  });

  it("maps scalar operators to SQL with bound params", () => {
    expect(sqlFor({ title: { equals: "hi" } })).toMatchObject({ params: ["hi"] });
    expect(sqlFor({ title: { equals: "hi" } }).sql).toMatch(/"title" = \?/);
    expect(sqlFor({ title: { not_equals: "hi" } }).sql).toMatch(/<>/);
    expect(sqlFor({ views: { greater_than: 10 } })).toMatchObject({ params: [10] });
    expect(sqlFor({ views: { greater_than_equal: 10 } }).sql).toMatch(/>=/);
    expect(sqlFor({ views: { less_than: 10 } }).sql).toMatch(/</);
    expect(sqlFor({ category: { in: ["a", "b"] } })).toMatchObject({ params: ["a", "b"] });
    expect(sqlFor({ category: { in: ["a", "b"] } }).sql).toMatch(/in \(\?, \?\)/);
    expect(sqlFor({ category: { not_in: ["a"] } }).sql).toMatch(/not in/);
    expect(sqlFor({ title: { like: "foo" } })).toMatchObject({ params: ["%foo%"] });
  });

  it("maps exists / null to IS [NOT] NULL", () => {
    expect(sqlFor({ title: { exists: true } }).sql).toMatch(/is not null/);
    expect(sqlFor({ title: { exists: false } }).sql).toMatch(/is null/);
    expect(sqlFor({ title: { equals: null } }).sql).toMatch(/is null/);
    expect(sqlFor({ title: { not_equals: null } }).sql).toMatch(/is not null/);
  });

  it("composes and / or groups", () => {
    const orSql = sqlFor({
      or: [{ title: { equals: "a" } }, { title: { equals: "b" } }],
    }).sql;
    expect(orSql).toMatch(/ or /);
    const andSql = sqlFor({
      and: [{ views: { greater_than: 1 } }, { featured: { equals: true } }],
    }).sql;
    expect(andSql).toMatch(/ and /);
  });

  it("filters on system columns (id / createdAt)", () => {
    expect(sqlFor({ id: { equals: "x" } }).sql).toMatch(/"id" = \?/);
    expect(sqlFor({ createdAt: { greater_than: new Date("2020-01-01") } }).sql).toMatch(/>/);
  });

  it("rejects unknown, non-scalar, and hasMany fields", () => {
    expect(() => sqlFor({ nope: { equals: 1 } })).toThrow(/Unknown field/);
    expect(() => sqlFor({ seo: { equals: 1 } })).toThrow(/JSON/);
    expect(() => sqlFor({ tags: { equals: "x" } })).toThrow(/hasMany/);
  });

  it("rejects operators that don't fit the column kind", () => {
    expect(() => sqlFor({ featured: { greater_than: 1 } })).toThrow(/not supported on boolean/);
    expect(() => sqlFor({ views: { like: "x" } })).toThrow(/not supported on number/);
    expect(() => sqlFor({ title: { in: "x" as unknown as unknown[] } })).toThrow(
      /expects an array/,
    );
  });

  it("rejects malformed values", () => {
    expect(() => sqlFor({ publishedAt: { equals: "not-a-date" } })).toThrow(/Invalid date/);
    expect(() => sqlFor({ views: { equals: "abc" } })).toThrow(/Invalid number/);
    expect(() => sqlFor({ title: "hi" as unknown as never })).toThrow(/must be an object/);
  });
});

describe("buildWhere — hardening (adversarial review fixes)", () => {
  it("rejects prototype-chain keys with a clean Unknown field error (not a TypeError)", () => {
    for (const key of ["constructor", "toString", "hasOwnProperty", "valueOf"]) {
      expect(() => buildWhere({ [key]: { equals: 1 } } as WhereClause, table, fields)).toThrow(
        /Unknown field/,
      );
    }
    // An own `__proto__` key, as JSON.parse produces from untrusted input.
    const viaJson = JSON.parse('{"__proto__":{"equals":1}}') as WhereClause;
    expect(() => buildWhere(viaJson, table, fields)).toThrow(/Unknown field/);
  });

  it("caps and/or nesting depth instead of overflowing the stack", () => {
    let nested: WhereClause = { title: { equals: "x" } };
    for (let i = 0; i < 100; i++) nested = { and: [nested] };
    expect(() => buildWhere(nested, table, fields)).toThrow(/nested too deeply/);
  });

  it("rejects null and empty arrays in in/not_in", () => {
    expect(() => sqlFor({ category: { in: ["a", null] } })).toThrow(/does not accept null/);
    expect(() => sqlFor({ category: { not_in: [null] } })).toThrow(/does not accept null/);
    expect(() => sqlFor({ category: { in: [] } })).toThrow(/non-empty array/);
  });

  it("rejects loose number coercions (empty, blank, boolean, array, Infinity)", () => {
    for (const bad of ["", "   ", true, [], "Infinity"]) {
      expect(() => sqlFor({ views: { equals: bad } })).toThrow(/Invalid number/);
    }
  });

  it("coerces exists from boolean and string forms", () => {
    expect(sqlFor({ title: { exists: false } }).sql).toMatch(/is null/);
    expect(sqlFor({ title: { exists: "false" as unknown as boolean } }).sql).toMatch(/is null/);
    expect(sqlFor({ title: { exists: "0" as unknown as boolean } }).sql).toMatch(/is null/);
    expect(sqlFor({ title: { exists: "1" as unknown as boolean } }).sql).toMatch(/is not null/);
    expect(() => sqlFor({ title: { exists: "maybe" as unknown as boolean } })).toThrow(
      /Invalid boolean/,
    );
  });

  it("rejects null in non-null operators and wrong-typed values", () => {
    // null only special-cased for equals/not_equals (→ IS [NOT] NULL), not others.
    expect(() => sqlFor({ views: { greater_than: null } })).toThrow(/Invalid number/);
    expect(() => sqlFor({ title: { exists: null as unknown as boolean } })).toThrow(
      /Invalid boolean/,
    );
    // wrong types must not slip into predicates (e.g. boolean → new Date)
    expect(() => sqlFor({ publishedAt: { equals: true } })).toThrow(/Invalid date/);
    expect(() => sqlFor({ title: { equals: {} } })).toThrow(/Invalid text/);
    expect(() => sqlFor({ title: { like: 123 } })).toThrow(/Invalid text/);
  });

  it("rejects malformed and/or entries with a clear message", () => {
    expect(() => buildWhere({ and: [null] } as unknown as WhereClause, table, fields)).toThrow(
      /must be a where-clause object/,
    );
    expect(() => buildWhere({ or: ["x"] } as unknown as WhereClause, table, fields)).toThrow(
      /must be a where-clause object/,
    );
  });

  it("keeps _status out of the where surface (drafts go through the status option)", () => {
    expect(() =>
      buildWhere({ _status: { equals: "draft" } } as WhereClause, table, fields),
    ).toThrow(/status/);
  });
});

describe("buildWhere — against a real :memory: database", () => {
  const client = createClient({ url: ":memory:" });
  const live = drizzle(client);

  beforeAll(async () => {
    await client.execute(
      `CREATE TABLE posts (
        id TEXT PRIMARY KEY,
        title TEXT,
        views REAL,
        publishedAt INTEGER,
        featured INTEGER NOT NULL DEFAULT 0,
        category TEXT,
        author TEXT,
        tags TEXT,
        seo TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );
    await live.insert(table).values([
      {
        id: "1",
        title: "Hello",
        views: 5,
        publishedAt: new Date("2020-06-01"),
        featured: false,
        category: "a",
        author: "x",
      },
      {
        id: "2",
        title: "World",
        views: 50,
        publishedAt: new Date("2022-06-01"),
        featured: true,
        category: "b",
        author: "y",
      },
      {
        id: "3",
        title: "Hello again",
        views: 5,
        publishedAt: new Date("2021-06-01"),
        featured: false,
        category: "a",
        author: "x",
      },
    ] as never);
  });

  async function idsWhere(where: WhereClause) {
    const condition = buildWhere(where, table, fields);
    const rows = (await live
      .select()
      .from(table)
      .where(condition as never)) as { id: string }[];
    return rows.map((row) => row.id).sort();
  }

  it("filters numbers, sets, and booleans", async () => {
    expect(await idsWhere({ views: { greater_than: 10 } })).toEqual(["2"]);
    expect(await idsWhere({ category: { in: ["a"] } })).toEqual(["1", "3"]);
    expect(await idsWhere({ featured: { equals: true } })).toEqual(["2"]);
  });

  it("filters date ranges (proves Date→epoch encoding)", async () => {
    expect(await idsWhere({ publishedAt: { greater_than: new Date("2021-01-01") } })).toEqual([
      "2",
      "3",
    ]);
    // string coercion to Date works too
    expect(await idsWhere({ publishedAt: { less_than: "2021-01-01" } })).toEqual(["1"]);
  });

  it("filters text with like and composes and/or", async () => {
    expect(await idsWhere({ title: { like: "Hello" } })).toEqual(["1", "3"]);
    expect(
      await idsWhere({ and: [{ category: { equals: "a" } }, { views: { equals: 5 } }] }),
    ).toEqual(["1", "3"]);
    expect(
      await idsWhere({ or: [{ views: { greater_than: 40 } }, { title: { like: "again" } }] }),
    ).toEqual(["2", "3"]);
  });
});
