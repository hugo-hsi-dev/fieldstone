import { describe, expect, it } from "vitest";

import * as vite from "../src/index.ts";

describe("fieldstone vite exports", () => {
  it("only exposes the Vite plugin factory", () => {
    expect(Object.keys(vite).sort()).toEqual(["fieldstone"]);
  });
});
