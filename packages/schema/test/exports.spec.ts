import { describe, expect, it } from "vitest";

import { collection, defineConfig, text } from "../src/index.ts";

describe("fieldstone schema exports", () => {
  it("exposes authoring helpers from the schema package", () => {
    expect(text({ name: "title", required: true })).toEqual({
      name: "title",
      required: true,
      type: "text",
    });
    expect(collection({ fields: [text({ name: "title" })] })).toEqual({
      fields: [{ name: "title", type: "text" }],
    });
    expect(defineConfig({ db: { dialect: "sqlite", url: ":memory:" } })).toEqual({
      db: { dialect: "sqlite", url: ":memory:" },
    });
  });
});
