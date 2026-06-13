import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("fieldstone remotes package exports", () => {
  it("exposes the SvelteKit remotes entrypoint only", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf-8")) as {
      exports: Record<string, unknown>;
    };
    const source = await readFile("src/index.ts", "utf-8");

    expect(packageJson.exports).toHaveProperty(".");
    expect(source).toContain("createFieldstoneAdminRemotes");
    expect(source).toContain("FieldstoneAdminRemotes");
  });
});
