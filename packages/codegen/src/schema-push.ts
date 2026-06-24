import { createInterface } from "node:readline/promises";

import { createClient } from "@libsql/client";
import type { FieldstoneConfig } from "@hugo-hsi-dev/schema";
import type { FieldstoneCompiledConfig } from "@hugo-hsi-dev/compiler";
import { drizzle } from "drizzle-orm/libsql";

export interface PushSchemaOptions {
  /** Apply schema changes without an interactive prompt (e.g. in CI). */
  yes?: boolean;
  /** Additionally accept destructive changes that may lose data. */
  allowDataLoss?: boolean;
}

export type PushDecision =
  | { action: "apply" }
  | { action: "prompt" }
  | { action: "abort"; reason: "data-loss" | "no-tty" };

/**
 * Pure decision for how to handle a push that drizzle-kit flagged with
 * `warnings` / `hasDataLoss`, given the user's flags and whether a terminal is
 * available to confirm. Kept side-effect-free so it can be unit-tested.
 *
 * - No warnings → apply.
 * - Unattended (`yes`, or no TTY): destructive diffs need `allowDataLoss`, and a
 *   missing TTY without `yes` aborts rather than hanging on a prompt.
 * - Interactive TTY with no `yes` → prompt the developer.
 */
export function decidePush(
  warnings: string[],
  hasDataLoss: boolean,
  options: PushSchemaOptions,
  interactive: boolean,
): PushDecision {
  if (!warnings.length) return { action: "apply" };

  if (options.yes || !interactive) {
    if (hasDataLoss && !options.allowDataLoss) {
      return { action: "abort", reason: "data-loss" };
    }
    if (!options.yes) {
      return { action: "abort", reason: "no-tty" };
    }
    return { action: "apply" };
  }

  return { action: "prompt" };
}

export function normalizeSqliteUrl(url: string) {
  if (/^[a-z]+:/i.test(url)) return url;
  return `file:${url}`;
}

function formatWarnings(warnings: string[], hasDataLoss: boolean) {
  return [
    "Fieldstone schema push warnings:",
    "",
    ...warnings,
    hasDataLoss ? "\nDATA LOSS WARNING: possible data loss detected." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function confirmWarnings(
  warnings: string[],
  hasDataLoss: boolean,
  options: PushSchemaOptions,
) {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const decision = decidePush(warnings, hasDataLoss, options, interactive);

  if (decision.action === "apply") {
    if (warnings.length) console.warn(formatWarnings(warnings, hasDataLoss));
    return true;
  }

  if (decision.action === "abort") {
    console.error(formatWarnings(warnings, hasDataLoss));
    console.error(
      decision.reason === "data-loss"
        ? "\nRefusing to push: this change may lose data. Re-run with --allow-data-loss to apply."
        : `\nSchema push has warnings and there is no terminal to confirm. Re-run with --yes${
            hasDataLoss ? " --allow-data-loss" : ""
          } to apply.`,
    );
    return false;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `${formatWarnings(warnings, hasDataLoss)}\n\nAccept warnings and push schema? (y/N) `,
    );
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}

export async function pushSchema(
  config: FieldstoneConfig,
  compiledConfig: FieldstoneCompiledConfig,
  options: PushSchemaOptions = {},
) {
  const { pushSQLiteSchema } = await import("drizzle-kit/api");
  const compiled = compiledConfig.renderRuntimeSchema();
  const client = createClient({ url: normalizeSqliteUrl(config.db.url) });
  const database = drizzle(client, { schema: compiled.schema });
  const { apply, hasDataLoss, warnings } = await pushSQLiteSchema(compiled.schema, database);

  if (!(await confirmWarnings(warnings, hasDataLoss, options))) return false;
  await apply();
  return true;
}
