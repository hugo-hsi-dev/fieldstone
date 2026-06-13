import type { FieldstoneConfig } from "./types.ts";

const reservedFieldNames = new Set([
  "__proto__",
  "id",
  "createdAt",
  "updatedAt",
  "created_at",
  "updated_at",
]);

export function validateCollectionFields(
  collectionFields: readonly FieldstoneConfig["collections"][string]["fields"][number][],
) {
  const seen = new Set<string>();

  for (const field of collectionFields) {
    if (reservedFieldNames.has(field.name)) throw new Error(`Reserved field name: ${field.name}`);
    const normalizedName = field.name.toLowerCase();
    if (seen.has(normalizedName)) throw new Error(`Duplicate field name: ${field.name}`);
    seen.add(normalizedName);
  }
}
