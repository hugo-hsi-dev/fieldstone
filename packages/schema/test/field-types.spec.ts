import { describe, expect, it } from "vitest";

import {
  array,
  boolean,
  collection,
  date,
  email,
  group,
  normalizeCollectionData,
  number,
  relationship,
  richText,
  select,
  text,
} from "../src/index.ts";
import type { FieldDefinition } from "../src/index.ts";

describe("field constructors", () => {
  it("builds typed field definitions", () => {
    expect(number({ name: "price", min: 0, max: 10, required: true })).toEqual({
      name: "price",
      min: 0,
      max: 10,
      required: true,
      type: "number",
    });
    expect(email({ name: "contact" })).toEqual({ name: "contact", type: "email" });
    expect(date({ name: "publishedAt" })).toEqual({
      name: "publishedAt",
      type: "date",
    });
  });

  it("normalizes select options from strings and objects", () => {
    expect(
      select({
        name: "status",
        options: ["draft", { label: "Is Live", value: "published" }],
      }),
    ).toEqual({
      name: "status",
      options: [
        { label: "draft", value: "draft" },
        { label: "Is Live", value: "published" },
      ],
      type: "select",
    });
  });
});

describe("field definition validation", () => {
  it("requires at least one select option", () => {
    expect(() =>
      collection({ fields: [select({ name: "status", options: [] })] }),
    ).toThrow('Select field "status" requires at least one option');
  });

  it("rejects duplicate select option values", () => {
    expect(() =>
      collection({
        fields: [select({ name: "status", options: ["a", "a"] })],
      }),
    ).toThrow("duplicate option value: a");
  });

  it("rejects number ranges where min exceeds max", () => {
    expect(() =>
      collection({ fields: [number({ name: "qty", min: 10, max: 1 })] }),
    ).toThrow('Number field "qty" has min greater than max');
  });

  it("rejects invalid text patterns and bad length ranges", () => {
    expect(() =>
      collection({ fields: [text({ name: "slug", pattern: "(" })] }),
    ).toThrow('Text field "slug" has an invalid pattern');
    expect(() =>
      collection({ fields: [text({ name: "slug", minLength: 5, maxLength: 2 })] }),
    ).toThrow("minLength greater than maxLength");
  });
});

function fields(...list: FieldDefinition[]) {
  return { fields: list };
}

describe("normalizeCollectionData across field types", () => {
  it("coerces and validates numbers", () => {
    const config = fields(
      number({ name: "price", required: true, min: 0, max: 100 }),
      number({ name: "qty", integer: true, defaultValue: 1 }),
    );

    expect(normalizeCollectionData(config, { price: "42.5" })).toEqual({
      price: 42.5,
      qty: 1,
    });
    expect(() => normalizeCollectionData(config, {})).toThrow(
      "price is required",
    );
    expect(() => normalizeCollectionData(config, { price: "x" })).toThrow(
      "price must be a number",
    );
    expect(() => normalizeCollectionData(config, { price: "-1" })).toThrow(
      "price must be at least 0",
    );
    expect(() => normalizeCollectionData(config, { price: "101" })).toThrow(
      "price must be at most 100",
    );
    expect(() =>
      normalizeCollectionData(config, { price: "5", qty: "1.5" }),
    ).toThrow("qty must be an integer");
  });

  it("validates email format", () => {
    const config = fields(email({ name: "contact", required: true }));
    expect(normalizeCollectionData(config, { contact: " a@b.co " })).toEqual({
      contact: "a@b.co",
    });
    expect(() => normalizeCollectionData(config, { contact: "nope" })).toThrow(
      "contact must be a valid email",
    );
  });

  it("parses dates and rejects invalid ones", () => {
    const config = fields(date({ name: "publishedAt", required: true }));
    const result = normalizeCollectionData(config, {
      publishedAt: "2026-01-02T03:04:00.000Z",
    });
    expect(result.publishedAt).toBeInstanceOf(Date);
    expect((result.publishedAt as Date).toISOString()).toBe(
      "2026-01-02T03:04:00.000Z",
    );
    expect(() =>
      normalizeCollectionData(config, { publishedAt: "not-a-date" }),
    ).toThrow("publishedAt must be a valid date");
  });

  it("enforces select membership and defaults", () => {
    const config = fields(
      select({
        name: "status",
        options: ["draft", "published"],
        defaultValue: "draft",
      }),
    );
    expect(normalizeCollectionData(config, {})).toEqual({ status: "draft" });
    expect(normalizeCollectionData(config, { status: "published" })).toEqual({
      status: "published",
    });
    expect(() =>
      normalizeCollectionData(config, { status: "archived" }),
    ).toThrow("status must be one of: draft, published");
  });

  it("applies text length, pattern, and default rules", () => {
    const config = fields(
      text({ name: "slug", minLength: 3, maxLength: 8, pattern: "^[a-z]+$" }),
      text({ name: "kind", defaultValue: "note" }),
    );
    expect(normalizeCollectionData(config, { slug: "abc" })).toEqual({
      slug: "abc",
      kind: "note",
    });
    expect(() => normalizeCollectionData(config, { slug: "ab" })).toThrow(
      "slug must be at least 3 characters",
    );
    expect(() =>
      normalizeCollectionData(config, { slug: "abcdefghij" }),
    ).toThrow("slug must be at most 8 characters");
    expect(() => normalizeCollectionData(config, { slug: "ABC" })).toThrow(
      "slug is invalid",
    );
  });

  it("applies boolean defaults", () => {
    const config = fields(boolean({ name: "featured", defaultValue: true }));
    expect(normalizeCollectionData(config, {})).toEqual({ featured: true });
    expect(normalizeCollectionData(config, { featured: "false" })).toEqual({
      featured: false,
    });
  });

  it("normalizes single and hasMany relationships", () => {
    const config = fields(
      relationship({ name: "author", relationTo: "users", required: true }),
      relationship({ name: "tags", relationTo: "tags", hasMany: true }),
    );

    expect(
      normalizeCollectionData(config, { author: " u1 ", tags: ["t1", "t1", "t2"] }),
    ).toEqual({ author: "u1", tags: ["t1", "t2"] });

    expect(normalizeCollectionData(config, { author: "u1" })).toEqual({
      author: "u1",
      tags: null,
    });

    expect(() => normalizeCollectionData(config, { tags: ["t1"] })).toThrow(
      "author is required",
    );
  });

  it("stores rich text html and validates required content by text", () => {
    const required = fields(richText({ name: "body", required: true }));
    expect(normalizeCollectionData(required, { body: "<p>Hello</p>" })).toEqual({
      body: "<p>Hello</p>",
    });
    expect(() => normalizeCollectionData(required, { body: "<p><br></p>" })).toThrow(
      "body is required",
    );
    expect(() => normalizeCollectionData(required, { body: "" })).toThrow(
      "body is required",
    );

    const optional = fields(richText({ name: "note" }));
    expect(normalizeCollectionData(optional, { note: "<br>" })).toEqual({
      note: null,
    });
  });

  it("normalizes nested group and array fields (objects and JSON strings)", () => {
    const config = fields(
      group({
        name: "meta",
        fields: [text({ name: "author", required: true }), number({ name: "rank" })],
      }),
      array({ name: "tags", fields: [text({ name: "label", required: true })] }),
    );

    expect(
      normalizeCollectionData(config, {
        meta: { author: " Ada ", rank: "5" },
        tags: [{ label: "a" }, { label: "b" }],
      }),
    ).toEqual({
      meta: { author: "Ada", rank: 5 },
      tags: [{ label: "a" }, { label: "b" }],
    });

    // Admin forms submit nested fields as JSON strings.
    expect(
      normalizeCollectionData(config, {
        meta: '{"author":"Bob"}',
        tags: '[{"label":"x"}]',
      }),
    ).toEqual({
      meta: { author: "Bob", rank: null },
      tags: [{ label: "x" }],
    });

    expect(() => normalizeCollectionData(config, { meta: {}, tags: [] })).toThrow(
      "author is required",
    );
  });

  it("enforces required arrays", () => {
    const config = fields(
      array({
        name: "items",
        required: true,
        fields: [text({ name: "value", required: true })],
      }),
    );
    expect(() => normalizeCollectionData(config, { items: [] })).toThrow(
      "items is required",
    );
  });

  it("requires a relationTo on relationship fields", () => {
    expect(() =>
      collection({
        fields: [relationship({ name: "author", relationTo: "" })],
      }),
    ).toThrow('Relationship field "author" requires a relationTo collection');
  });
});
