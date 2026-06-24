import { compileFieldstoneConfig } from "@hugo-hsi-dev/compiler";
import type { FieldstoneConfig } from "@hugo-hsi-dev/schema";
import { resolveStorage } from "@hugo-hsi-dev/storage";

export function normalizeSqliteUrl(url: string) {
  if (/^[a-z]+:/i.test(url)) return url;
  return `file:${url}`;
}

export async function createDatabase(config: FieldstoneConfig) {
  const [
    { createClient },
    {
      and,
      asc,
      count,
      desc,
      eq,
      gt,
      gte,
      inArray,
      isNotNull,
      isNull,
      like,
      lt,
      lte,
      ne,
      notInArray,
      or,
    },
    { drizzle },
  ] = await Promise.all([
    import("@libsql/client"),
    import("drizzle-orm"),
    import("drizzle-orm/libsql"),
  ]);
  const compiledConfig = compileFieldstoneConfig(config);
  const compiled = compiledConfig.renderRuntimeSchema();
  const client = createClient({ url: normalizeSqliteUrl(config.db.url) });
  const database = drizzle(client, { schema: compiled.schema });
  // Resolved from the declarative storage config; consumed by the upload pipeline
  // and the media-serving route in later slices.
  const storage = resolveStorage(config);

  return {
    collections: compiledConfig.createCollectionRuntimeConfigs(),
    globals: compiledConfig.createGlobalRuntimeConfigs(),
    compiled,
    compiledConfig,
    config,
    database,
    storage,
    and,
    asc,
    count,
    desc,
    eq,
    gt,
    gte,
    inArray,
    isNotNull,
    isNull,
    like,
    lt,
    lte,
    ne,
    notInArray,
    or,
  };
}
