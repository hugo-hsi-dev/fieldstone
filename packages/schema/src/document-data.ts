import type {
  CollectionConfig,
  CollectionRuntimeConfig,
  FieldDefinition,
  SelectOptionInput,
} from "./types.ts";

export type DocumentDataValue =
  | boolean
  | number
  | string
  | string[]
  | Date
  | null
  | { [key: string]: DocumentDataValue }
  | { [key: string]: DocumentDataValue }[];
export type NormalizedDocumentData = Record<string, DocumentDataValue>;

type NormalizableCollection = Pick<
  CollectionConfig | CollectionRuntimeConfig,
  "fields"
>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeTextFieldValue(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeBooleanFieldValue(value: unknown) {
  return value === true || value === "true" || value === "on" || value === "1";
}

export function normalizeNumberFieldValue(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeDateFieldValue(value: unknown): Date | null {
  if (value === "" || value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function selectOptionValues(options: readonly SelectOptionInput[] | undefined) {
  return (options ?? []).map((option) =>
    typeof option === "string" ? option : option.value,
  );
}

function normalizeStringLikeField(
  field: Extract<FieldDefinition, { type: "text" | "email" | "select" }>,
  raw: unknown,
): string | null {
  let value = normalizeTextFieldValue(raw);
  if (!value && field.defaultValue != null)
    value = normalizeTextFieldValue(field.defaultValue);

  if (!value) {
    if (field.required) throw new Error(`${field.name} is required`);
    return null;
  }

  if (field.type === "email" && !EMAIL_PATTERN.test(value))
    throw new Error(`${field.name} must be a valid email`);

  if (field.type === "text") {
    if (typeof field.minLength === "number" && value.length < field.minLength)
      throw new Error(
        `${field.name} must be at least ${field.minLength} characters`,
      );
    if (typeof field.maxLength === "number" && value.length > field.maxLength)
      throw new Error(
        `${field.name} must be at most ${field.maxLength} characters`,
      );
    if (field.pattern !== undefined && !new RegExp(field.pattern).test(value))
      throw new Error(`${field.name} is invalid`);
  }

  if (field.type === "select") {
    const allowed = selectOptionValues(field.options);
    if (!allowed.includes(value))
      throw new Error(`${field.name} must be one of: ${allowed.join(", ")}`);
  }

  return value;
}

function normalizeNumberField(
  field: Extract<FieldDefinition, { type: "number" }>,
  raw: unknown,
): number | null {
  let value = normalizeNumberFieldValue(raw);
  if (value === null && raw !== "" && raw !== null && raw !== undefined)
    throw new Error(`${field.name} must be a number`);

  if (value === null && field.defaultValue != null) value = field.defaultValue;

  if (value === null) {
    if (field.required) throw new Error(`${field.name} is required`);
    return null;
  }

  if (field.integer && !Number.isInteger(value))
    throw new Error(`${field.name} must be an integer`);
  if (typeof field.min === "number" && value < field.min)
    throw new Error(`${field.name} must be at least ${field.min}`);
  if (typeof field.max === "number" && value > field.max)
    throw new Error(`${field.name} must be at most ${field.max}`);

  return value;
}

function normalizeDateField(
  field: Extract<FieldDefinition, { type: "date" }>,
  raw: unknown,
): Date | null {
  let value = normalizeDateFieldValue(raw);
  if (value === null && raw !== "" && raw !== null && raw !== undefined)
    throw new Error(`${field.name} must be a valid date`);

  if (value === null && field.defaultValue != null)
    value = normalizeDateFieldValue(field.defaultValue);

  if (value === null) {
    if (field.required) throw new Error(`${field.name} is required`);
    return null;
  }

  return value;
}

function normalizeBooleanField(
  field: Extract<FieldDefinition, { type: "boolean" }>,
  raw: unknown,
): boolean {
  if (raw === undefined && field.defaultValue !== undefined)
    return field.defaultValue;
  return normalizeBooleanFieldValue(raw);
}

function normalizeRichTextField(
  field: Extract<FieldDefinition, { type: "richText" }>,
  raw: unknown,
): string | null {
  let html = String(raw ?? "").trim();
  if (!html && field.defaultValue != null) html = String(field.defaultValue).trim();
  const textContent = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (!textContent) {
    if (field.required) throw new Error(`${field.name} is required`);
    return null;
  }
  return html;
}

function normalizeRelationshipField(
  field: Extract<FieldDefinition, { type: "relationship" }>,
  raw: unknown,
): string | string[] | null {
  if (field.hasMany) {
    const list = Array.isArray(raw)
      ? raw
      : raw === undefined || raw === null || raw === ""
        ? []
        : [raw];
    const ids = list.map((entry) => String(entry).trim()).filter(Boolean);
    if (ids.length === 0) {
      if (field.required) throw new Error(`${field.name} is required`);
      return null;
    }
    return Array.from(new Set(ids));
  }

  const id = Array.isArray(raw)
    ? String(raw[0] ?? "").trim()
    : String(raw ?? "").trim();
  if (!id) {
    if (field.required) throw new Error(`${field.name} is required`);
    return null;
  }
  return id;
}

function parseNested(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function normalizeGroupField(
  field: Extract<FieldDefinition, { type: "group" }>,
  raw: unknown,
): { [key: string]: DocumentDataValue } {
  const parsed = parseNested(raw);
  const source =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const result: { [key: string]: DocumentDataValue } = {};
  for (const subField of field.fields) {
    result[subField.name] = normalizeFieldValue(subField, source[subField.name]);
  }
  return result;
}

function normalizeArrayField(
  field: Extract<FieldDefinition, { type: "array" }>,
  raw: unknown,
): { [key: string]: DocumentDataValue }[] {
  const parsed = parseNested(raw);
  const list = Array.isArray(parsed) ? parsed : [];
  const entries = list.map((item) => {
    const source =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    const entry: { [key: string]: DocumentDataValue } = {};
    for (const subField of field.fields) {
      entry[subField.name] = normalizeFieldValue(subField, source[subField.name]);
    }
    return entry;
  });
  if (field.required && entries.length === 0)
    throw new Error(`${field.name} is required`);
  return entries;
}

export function normalizeFieldValue(
  field: FieldDefinition,
  raw: unknown,
): DocumentDataValue {
  switch (field.type) {
    case "text":
    case "email":
    case "select":
      return normalizeStringLikeField(field, raw);
    case "number":
      return normalizeNumberField(field, raw);
    case "date":
      return normalizeDateField(field, raw);
    case "boolean":
      return normalizeBooleanField(field, raw);
    case "relationship":
      return normalizeRelationshipField(field, raw);
    case "richText":
      return normalizeRichTextField(field, raw);
    case "group":
      return normalizeGroupField(field, raw);
    case "array":
      return normalizeArrayField(field, raw);
    default:
      throw new Error("Unsupported field type");
  }
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
    normalized[field.name] = normalizeFieldValue(field, data[field.name]);
  }

  return normalized;
}
