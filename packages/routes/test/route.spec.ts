import { describe, expect, it } from "vitest";

import {
  adminDocumentPath,
  adminGlobalPath,
  adminIndexPath,
  adminRouteSegments,
  getAdminSegments,
  mediaPath,
  parseAdminRoute,
} from "../src/index.ts";

describe("admin route helpers", () => {
  it("preserves unsupported admin route segments for 404 handling", () => {
    expect(getAdminSegments("/admin/foo")).toEqual(["foo"]);
  });

  it("extracts collection route segments", () => {
    expect(getAdminSegments("/admin/collections/posts")).toEqual([
      "collections",
      "posts",
    ]);
  });

  it("parses route-driven admin document routes", () => {
    expect(parseAdminRoute([])).toEqual({ type: "index" });
    expect(parseAdminRoute(["collections", "posts"])).toEqual({
      collection: "posts",
      type: "collectionList",
    });
    expect(parseAdminRoute(["collections", "posts", "new"])).toEqual({
      collection: "posts",
      type: "collectionNew",
    });
    expect(parseAdminRoute(["collections", "posts", "123"])).toEqual({
      collection: "posts",
      id: "123",
      type: "documentDetail",
    });
    expect(parseAdminRoute(["collections", "posts", "123", "edit"])).toEqual({
      collection: "posts",
      id: "123",
      type: "documentEdit",
    });
    expect(parseAdminRoute(["globals", "site-settings"])).toEqual({
      global: "site-settings",
      type: "globalEdit",
    });
    expect(parseAdminRoute(["foo"])).toEqual({ type: "notFound" });
  });

  it("builds encoded document paths with template syntax", () => {
    expect(adminDocumentPath("blog posts", "doc/1")).toBe(
      "/admin/collections/blog%20posts/doc%2F1",
    );
    expect(adminGlobalPath("site settings")).toBe(
      "/admin/globals/site%20settings",
    );
  });

  it("preserves configured base path in generated admin URLs", () => {
    expect(adminDocumentPath("blog posts", "doc/1", "/cms")).toBe(
      "/cms/admin/collections/blog%20posts/doc%2F1",
    );
  });

  it("extracts SvelteKit rest route segments from generated admin paths", () => {
    expect(adminRouteSegments(adminIndexPath())).toBe("");
    expect(adminRouteSegments(adminDocumentPath("blog posts", "doc/1"))).toBe(
      "collections/blog%20posts/doc%2F1",
    );
  });

  it("builds media URLs from a storage key, encoding each segment", () => {
    expect(mediaPath("media/abc-photo.jpg")).toBe("/media/media/abc-photo.jpg");
    expect(mediaPath("a b/c.png", "/files")).toBe("/files/a%20b/c.png");
    expect(mediaPath("x.gif", "/media/")).toBe("/media/x.gif");
  });
});
