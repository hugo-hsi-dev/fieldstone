import { describe, expect, it } from "vitest";

import { collection, global, text } from "../src/index.js";

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
    expect(global({ fields: [text({ name: "siteTitle" })] })).toEqual({
      fields: [{ name: "siteTitle", type: "text" }],
    });
  });
});
