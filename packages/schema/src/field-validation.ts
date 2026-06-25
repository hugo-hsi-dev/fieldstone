import type {
  FieldDefinition,
  SelectOption,
  SelectOptionInput,
} from "./types.js";

const reservedFieldNames = new Set([
  "__proto__",
  "id",
  "createdAt",
  "updatedAt",
  "created_at",
  "updated_at",
  // `and`/`or` are where-clause logical keys; a field with either name would be
  // shadowed and unfilterable, so reject it at definition time.
  "and",
  "or",
]);

export function normalizeSelectOptions(
  options: readonly SelectOptionInput[],
): SelectOption[] {
  return options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option,
  );
}

function validateFieldDefinition(field: FieldDefinition) {
  switch (field.type) {
    case "select": {
      const options = normalizeSelectOptions(field.options ?? []);
      if (options.length === 0)
        throw new Error(`Select field "${field.name}" requires at least one option`);
      const seen = new Set<string>();
      for (const option of options) {
        if (option.value.trim() === "")
          throw new Error(
            `Select field "${field.name}" has a blank option value`,
          );
        if (option.value !== option.value.trim())
          throw new Error(
            `Select field "${field.name}" has a whitespace-padded option value: ${JSON.stringify(option.value)}`,
          );
        if (seen.has(option.value))
          throw new Error(
            `Select field "${field.name}" has duplicate option value: ${option.value}`,
          );
        seen.add(option.value);
      }
      if (field.defaultValue !== undefined && !seen.has(field.defaultValue))
        throw new Error(
          `Select field "${field.name}" has a defaultValue not in its options: ${field.defaultValue}`,
        );
      break;
    }
    case "number": {
      if (
        typeof field.min === "number" &&
        typeof field.max === "number" &&
        field.min > field.max
      )
        throw new Error(`Number field "${field.name}" has min greater than max`);
      if (field.defaultValue !== undefined) {
        const value = field.defaultValue;
        if (!Number.isFinite(value))
          throw new Error(
            `Number field "${field.name}" has a non-finite defaultValue: ${value}`,
          );
        if (field.integer && !Number.isInteger(value))
          throw new Error(
            `Number field "${field.name}" has a non-integer defaultValue: ${value}`,
          );
        if (typeof field.min === "number" && value < field.min)
          throw new Error(
            `Number field "${field.name}" has a defaultValue below min: ${value}`,
          );
        if (typeof field.max === "number" && value > field.max)
          throw new Error(
            `Number field "${field.name}" has a defaultValue above max: ${value}`,
          );
      }
      break;
    }
    case "text": {
      if (
        typeof field.minLength === "number" &&
        typeof field.maxLength === "number" &&
        field.minLength > field.maxLength
      )
        throw new Error(
          `Text field "${field.name}" has minLength greater than maxLength`,
        );
      if (field.pattern !== undefined) {
        try {
          new RegExp(field.pattern);
        } catch {
          throw new Error(`Text field "${field.name}" has an invalid pattern`);
        }
      }
      if (field.defaultValue !== undefined) {
        // Validate the trimmed value — that's what normalization stores and what
        // the min/max/pattern checks run against at mutation time.
        const value = field.defaultValue.trim();
        if (value === "")
          throw new Error(
            `Text field "${field.name}" has a blank defaultValue`,
          );
        if (typeof field.minLength === "number" && value.length < field.minLength)
          throw new Error(
            `Text field "${field.name}" has a defaultValue shorter than minLength`,
          );
        if (typeof field.maxLength === "number" && value.length > field.maxLength)
          throw new Error(
            `Text field "${field.name}" has a defaultValue longer than maxLength`,
          );
        if (field.pattern !== undefined && !new RegExp(field.pattern).test(value))
          throw new Error(
            `Text field "${field.name}" has a defaultValue that does not match its pattern`,
          );
      }
      break;
    }
    case "email": {
      if (
        field.defaultValue !== undefined &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.defaultValue)
      )
        throw new Error(
          `Email field "${field.name}" has an invalid defaultValue: ${field.defaultValue}`,
        );
      break;
    }
    case "date": {
      if (
        field.defaultValue !== undefined &&
        Number.isNaN(new Date(field.defaultValue).getTime())
      )
        throw new Error(
          `Date field "${field.name}" has an invalid defaultValue: ${field.defaultValue}`,
        );
      break;
    }
    case "richText": {
      // Normalization strips tags and treats empty text content as missing, so a
      // default with no text (e.g. "<br>") is unusable for an otherwise-defaulted field.
      if (
        field.defaultValue !== undefined &&
        field.defaultValue.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === ""
      )
        throw new Error(
          `Rich text field "${field.name}" has a defaultValue with no text content`,
        );
      break;
    }
    case "relationship": {
      if (!field.relationTo || field.relationTo.trim() === "")
        throw new Error(
          `Relationship field "${field.name}" requires a relationTo collection`,
        );
      break;
    }
    case "upload": {
      if (!field.relationTo || field.relationTo.trim() === "")
        throw new Error(
          `Upload field "${field.name}" requires a relationTo collection`,
        );
      break;
    }
    case "group":
    case "array": {
      if (!field.fields || field.fields.length === 0)
        throw new Error(
          `${field.type === "group" ? "Group" : "Array"} field "${field.name}" requires at least one field`,
        );
      // Nested fields live in a JSON column, so they can't collide with the
      // document's system columns (id/createdAt/...); only __proto__ stays reserved.
      validateCollectionFields(field.fields, false);
      break;
    }
    default:
      break;
  }
}

const nestedReservedFieldNames = new Set(["__proto__"]);

export function validateCollectionFields(
  collectionFields: readonly FieldDefinition[],
  topLevel = true,
) {
  const seen = new Set<string>();
  const reserved = topLevel ? reservedFieldNames : nestedReservedFieldNames;

  for (const field of collectionFields) {
    if (reserved.has(field.name)) throw new Error(`Reserved field name: ${field.name}`);
    const normalizedName = field.name.toLowerCase();
    if (seen.has(normalizedName)) throw new Error(`Duplicate field name: ${field.name}`);
    seen.add(normalizedName);
    validateFieldDefinition(field);
  }
}
