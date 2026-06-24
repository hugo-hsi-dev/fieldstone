import { describe, expect, it } from "vitest";

import { decidePush, normalizeSqliteUrl } from "../src/schema-push.ts";

describe("decidePush", () => {
  it("applies when there are no warnings, whatever the context", () => {
    expect(decidePush([], false, {}, true)).toEqual({ action: "apply" });
    expect(decidePush([], true, {}, false)).toEqual({ action: "apply" });
  });

  it("prompts in an interactive terminal when not pre-confirmed", () => {
    expect(decidePush(["w"], false, {}, true)).toEqual({ action: "prompt" });
    // Data loss is still surfaced via the interactive prompt for developers.
    expect(decidePush(["w"], true, {}, true)).toEqual({ action: "prompt" });
  });

  it("applies non-interactively with --yes when there is no data loss", () => {
    expect(decidePush(["w"], false, { yes: true }, true)).toEqual({ action: "apply" });
    expect(decidePush(["w"], false, { yes: true }, false)).toEqual({ action: "apply" });
  });

  it("aborts without hanging when there is no TTY and no --yes", () => {
    expect(decidePush(["w"], false, {}, false)).toEqual({
      action: "abort",
      reason: "no-tty",
    });
  });

  it("requires --allow-data-loss for destructive non-interactive pushes", () => {
    expect(decidePush(["w"], true, { yes: true }, true)).toEqual({
      action: "abort",
      reason: "data-loss",
    });
    // data-loss takes precedence over the no-tty reason
    expect(decidePush(["w"], true, {}, false)).toEqual({
      action: "abort",
      reason: "data-loss",
    });
  });

  it("applies destructive changes only with both --yes and --allow-data-loss", () => {
    expect(decidePush(["w"], true, { yes: true, allowDataLoss: true }, false)).toEqual({
      action: "apply",
    });
  });
});

describe("normalizeSqliteUrl", () => {
  it("adds a file: scheme to bare paths and leaves schemes intact", () => {
    expect(normalizeSqliteUrl("local.db")).toBe("file:local.db");
    expect(normalizeSqliteUrl("file:local.db")).toBe("file:local.db");
    expect(normalizeSqliteUrl("libsql://host")).toBe("libsql://host");
  });
});
