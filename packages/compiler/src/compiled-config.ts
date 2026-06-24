import type { NormalizedDocumentData } from "@hugo-hsi-dev/schema";
import type {
  CollectionRuntimeConfig,
  FieldstoneConfig,
  GlobalRuntimeConfig,
} from "@hugo-hsi-dev/schema";
import {
  buildSchemaPlan,
  createCollectionRuntimeConfigs,
  createGlobalRuntimeConfigs,
  getCollectionConfig,
  getGlobalConfig,
  normalizeDocumentData,
  normalizeGlobalData,
} from "./collection-model.ts";
import type { SchemaPlan } from "./collection-model.ts";
import { createDrizzleSchemaSource } from "./drizzle-source.ts";
import { createSchemaFingerprint } from "./fingerprint.ts";
import { createRuntimeSchema, type RuntimeSchema } from "./runtime-schema.ts";
import { createTypesDeclaration } from "./types-output.ts";

export type FieldstoneCompiledConfig = {
  createCollectionRuntimeConfigs(): CollectionRuntimeConfig[];
  createGlobalRuntimeConfigs(): GlobalRuntimeConfig[];
  readonly schemaPlan: SchemaPlan;
  getCollection(slug: string): ReturnType<typeof getCollectionConfig>;
  getGlobal(slug: string): ReturnType<typeof getGlobalConfig>;
  normalizeDocumentData(
    slug: string,
    data: Record<string, unknown>,
  ): NormalizedDocumentData;
  normalizeGlobalData(
    slug: string,
    data: Record<string, unknown>,
  ): NormalizedDocumentData;
  renderRuntimeSchema(): RuntimeSchema;
  renderSchemaSource(): string;
  renderTypesDeclaration(): string;
  schemaFingerprint(): string;
};

export function compileFieldstoneConfig(
  config: FieldstoneConfig,
): FieldstoneCompiledConfig {
  const schemaPlan = buildSchemaPlan(config);
  let runtimeSchema: RuntimeSchema | undefined;
  let drizzleSchemaSource: string | undefined;
  let typesDeclaration: string | undefined;
  let fingerprint: string | undefined;

  return {
    createCollectionRuntimeConfigs: () =>
      createCollectionRuntimeConfigs(schemaPlan),
    createGlobalRuntimeConfigs: () => createGlobalRuntimeConfigs(schemaPlan),
    schemaPlan,
    getCollection(slug) {
      return getCollectionConfig(schemaPlan, slug);
    },
    getGlobal(slug) {
      return getGlobalConfig(schemaPlan, slug);
    },
    normalizeDocumentData(slug, data) {
      return normalizeDocumentData(schemaPlan, slug, data);
    },
    normalizeGlobalData(slug, data) {
      return normalizeGlobalData(schemaPlan, slug, data);
    },
    renderRuntimeSchema() {
      runtimeSchema ??= createRuntimeSchema(schemaPlan);
      return runtimeSchema;
    },
    renderSchemaSource() {
      drizzleSchemaSource ??= createDrizzleSchemaSource(schemaPlan);
      return drizzleSchemaSource;
    },
    renderTypesDeclaration() {
      typesDeclaration ??= createTypesDeclaration(schemaPlan);
      return typesDeclaration;
    },
    schemaFingerprint() {
      fingerprint ??= createSchemaFingerprint(schemaPlan);
      return fingerprint;
    },
  };
}
