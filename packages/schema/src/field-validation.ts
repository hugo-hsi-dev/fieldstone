import type {
  FieldDefinition,
  SelectOption,
  SelectOptionInput,
} from "./types.ts";

const reservedFieldNames = new Set([
  "__proto__",
  "id",
  "createdAt",
  "updatedAt",
  "created_at",
  "updated_at",
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
      break;
    }
    case "relationship": {
      if (!field.relationTo || field.relationTo.trim() === "")
        throw new Error(
          `Relationship field "${field.name}" requires a relationTo collection`,
        );
      break;
    }
    case "group":
    case "array": {
      if (!field.fields || field.fields.length === 0)
        throw new Error(
          `${field.type === "group" ? "Group" : "Array"} field "${field.name}" requires at least one field`,
        );
      validateCollectionFields(field.fields);
      break;
    }
    default:
      break;
  }
}

export function validateCollectionFields(
  collectionFields: readonly FieldDefinition[],
) {
  const seen = new Set<string>();

  for (const field of collectionFields) {
    if (reservedFieldNames.has(field.name)) throw new Error(`Reserved field name: ${field.name}`);
    const normalizedName = field.name.toLowerCase();
    if (seen.has(normalizedName)) throw new Error(`Duplicate field name: ${field.name}`);
    seen.add(normalizedName);
    validateFieldDefinition(field);
  }
}
