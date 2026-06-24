import type { GlobalDocument, GlobalSlug } from "@hugo-hsi-dev/schema";

import type { createDatabase } from "./database.ts";
import type { GlobalInput, UpdateGlobalInput } from "./types.ts";

const GLOBAL_SINGLETON_ID = "global";

type DatabaseContext = Awaited<ReturnType<typeof createDatabase>>;

export function createGlobalRuntime(context: DatabaseContext) {
  const { compiled, compiledConfig, database, eq } = context;

  function getTable(globalSlug: string) {
    if (!compiledConfig.getGlobal(globalSlug)) {
      throw new Error(`Unsupported global: ${globalSlug}`);
    }
    return compiled.tables[globalSlug];
  }

  return {
    getGlobal: async <TGlobal extends GlobalSlug>({
      global: globalSlug,
    }: GlobalInput<TGlobal>) => {
      const table = getTable(globalSlug);
      const [document] = await database
        .select()
        .from(table)
        .where(eq(table.id, GLOBAL_SINGLETON_ID))
        .limit(1);
      return (document ?? null) as GlobalDocument<TGlobal> | null;
    },

    updateGlobal: async <TGlobal extends GlobalSlug>({
      data,
      global: globalSlug,
      updatedAt,
    }: UpdateGlobalInput<TGlobal>) => {
      const document = compiledConfig.normalizeGlobalData(globalSlug, data);
      const table = getTable(globalSlug);
      const now = new Date();
      const savedRows = (await database
        .insert(table)
        .values({
          ...document,
          id: GLOBAL_SINGLETON_ID,
          createdAt: now,
          updatedAt: updatedAt ?? now,
        })
        .onConflictDoUpdate({
          target: table.id,
          set: {
            ...document,
            updatedAt: updatedAt ?? now,
          },
        })
        .returning()) as unknown[];

      return savedRows[0] as GlobalDocument<TGlobal>;
    },
  };
}
