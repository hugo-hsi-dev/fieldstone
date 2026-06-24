import type { FieldstoneConfig } from "@hugo-hsi-dev/schema";
export { validateCollectionFields } from "@hugo-hsi-dev/schema";
import { buildSchemaPlan } from "./collection-model.ts";

export function validateFieldstoneConfig(config: FieldstoneConfig) {
  buildSchemaPlan(config);
}
