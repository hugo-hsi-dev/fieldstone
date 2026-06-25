import { describe, expect, it } from "vitest";

import { abortMessage, decidePush, normalizeSqliteUrl } from "../src/schema-push.js";

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

describe("abortMessage", () => {
  it("tells a non-interactive destructive push to pass BOTH flags", () => {
    // The regression: a no-TTY data-loss abort needs --yes too, not just --allow-data-loss.
    const msg = abortMessage("data-loss", true, false);
    expect(msg).toContain("--yes --allow-data-loss");
  });

  it("only asks for --allow-data-loss when already interactive (--yes given in a TTY)", () => {
    const msg = abortMessage("data-loss", true, true);
    expect(msg).toContain("--allow-data-loss");
    expect(msg).not.toContain("--yes");
  });

  it("asks for just --yes on a plain no-TTY warning, plus --allow-data-loss if destructive", () => {
    expect(abortMessage("no-tty", false, false)).toContain("--yes");
    expect(abortMessage("no-tty", false, false)).not.toContain("--allow-data-loss");
    expect(abortMessage("no-tty", true, false)).toContain("--yes --allow-data-loss");
  });
});

describe("normalizeSqliteUrl", () => {
  it("adds a file: scheme to bare paths and leaves schemes intact", () => {
    expect(normalizeSqliteUrl("local.db")).toBe("file:local.db");
    expect(normalizeSqliteUrl("file:local.db")).toBe("file:local.db");
    expect(normalizeSqliteUrl("libsql://host")).toBe("libsql://host");
  });
});
