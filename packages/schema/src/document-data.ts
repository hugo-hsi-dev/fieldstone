import type { CollectionConfig, CollectionRuntimeConfig } from "./types.ts";

export type DocumentDataValue = boolean | string | null;
export type NormalizedDocumentData = Record<string, DocumentDataValue>;

type NormalizableCollection = Pick<
  CollectionConfig | CollectionRuntimeConfig,
  "fields"
>;

export function normalizeTextFieldValue(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeBooleanFieldValue(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}

export function normalizeCollectionData(
  collection: NormalizableCollection,
  data: Record<string, unknown>,
): NormalizedDocumentData {
  const allowedFields = new Set(collection.fields.map((field) => field.name));
  const normalized: NormalizedDocumentData = {};

  for (const fieldName of Object.keys(data)) {
    if (!allowedFields.has(fieldName))
      throw new Error(`Unknown field: ${fieldName}`);
  }

  for (const field of collection.fields) {
    switch (field.type) {
      case "text": {
        const value = normalizeTextFieldValue(data[field.name]);
        if (field.required && !value)
          throw new Error(`${field.name} is required`);
        normalized[field.name] = value || null;
        break;
      }
      case "boolean": {
        normalized[field.name] = normalizeBooleanFieldValue(data[field.name]);
        break;
      }
      default:
        throw new Error("Unsupported field type");
    }
  }

  return normalized;
}
