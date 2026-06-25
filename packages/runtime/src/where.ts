import type { FieldDefinition } from "@hugo-hsi-dev/schema";
import { STATUS_FIELD_NAME } from "@hugo-hsi-dev/schema";
import {
  and,
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
} from "drizzle-orm";

// A field filter is a map of Payload-style operators to values. Only the
// operators valid for the field's column kind are accepted (see OPS_BY_KIND).
export type WhereOperators = {
  equals?: unknown;
  not_equals?: unknown;
  greater_than?: unknown;
  greater_than_equal?: unknown;
  less_than?: unknown;
  less_than_equal?: unknown;
  in?: unknown[];
  not_in?: unknown[];
  like?: unknown;
  exists?: boolean;
};

// A where clause is field filters AND-combined, with optional `and`/`or` groups.
// W2 generates a strict per-collection `Where<T>`; this is the runtime shape.
export type WhereClause = {
  and?: WhereClause[];
  or?: WhereClause[];
  [field: string]: WhereOperators | WhereClause[] | undefined;
};

type ColumnKind = "text" | "number" | "date" | "boolean";

// Cap on and/or nesting, so an adversarial deeply-nested clause (where becomes
// remote-facing in W2) fails cleanly instead of overflowing the stack.
const MAX_DEPTH = 20;

const OPS_BY_KIND: Record<ColumnKind, ReadonlySet<string>> = {
  text: new Set(["equals", "not_equals", "in", "not_in", "like", "exists"]),
  number: new Set([
    "equals",
    "not_equals",
    "in",
    "not_in",
    "greater_than",
    "greater_than_equal",
    "less_than",
    "less_than_equal",
    "exists",
  ]),
  date: new Set([
    "equals",
    "not_equals",
    "in",
    "not_in",
    "greater_than",
    "greater_than_equal",
    "less_than",
    "less_than_equal",
    "exists",
  ]),
  boolean: new Set(["equals", "not_equals", "exists"]),
};

// System columns are addressable by their identifier and are reserved field names
// (so a user field can never collide with them).
const SYSTEM_COLUMN_KINDS: Record<string, ColumnKind> = {
  id: "text",
  createdAt: "date",
  updatedAt: "date",
};

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function fieldKind(field: FieldDefinition, fieldName: string): ColumnKind {
  switch (field.type) {
    case "text":
    case "email":
    case "select":
    case "richText":
      return "text";
    case "number":
      return "number";
    case "date":
      return "date";
    case "boolean":
      return "boolean";
    case "relationship":
    case "upload":
      // A single reference is a text id column; hasMany is a JSON array with no
      // SQL-filterable column.
      if (field.hasMany) {
        throw new Error(
          `Cannot filter on hasMany ${field.type} field "${fieldName}" (stored as a JSON array)`,
        );
      }
      return "text";
    default:
      // group / array are serialized into a single JSON column.
      throw new Error(`Cannot filter on "${field.type}" field "${fieldName}" (stored as JSON)`);
  }
}

function resolveColumn(
  key: string,
  table: Record<string, unknown>,
  fields: readonly FieldDefinition[],
): { column: unknown; kind: ColumnKind } {
  // Drafts are filtered through the dedicated `status` option, not the where
  // clause, so the injected `_status` column stays out of the public surface.
  if (key === STATUS_FIELD_NAME) {
    throw new Error(`Use the "status" option to filter drafts, not a where clause`);
  }

  // hasOwn guards: a bare `obj[key]` would return inherited Object.prototype
  // members (constructor, toString, …) for crafted keys, on both the kind map and
  // the drizzle table (whose columns are own properties — same assumption the sort
  // guard in documents.ts relies on).
  const systemKind = Object.hasOwn(SYSTEM_COLUMN_KINDS, key) ? SYSTEM_COLUMN_KINDS[key] : undefined;
  if (systemKind) {
    const column = Object.hasOwn(table, key) ? table[key] : undefined;
    if (column == null) throw new Error(`No column for field "${key}"`);
    return { column, kind: systemKind };
  }

  const field = fields.find((candidate) => candidate.name === key);
  if (!field) throw new Error(`Unknown field in where clause: "${key}"`);

  const kind = fieldKind(field, key);
  const column = Object.hasOwn(table, key) ? table[key] : undefined;
  if (column == null) {
    throw new Error(`No column for field "${key}"`);
  }
  return { column, kind };
}

function coerce(value: unknown, kind: ColumnKind): unknown {
  // null is only meaningful through equals/not_equals (handled before coerce) and
  // exists; every other path must reject it rather than emit `op NULL`.
  if (value === null) {
    throw new Error(`Invalid ${kind} value in where clause: null`);
  }
  if (kind === "date") {
    if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") {
      throw new Error(`Invalid date value in where clause: ${String(value)}`);
    }
    // Numeric inputs are epoch milliseconds (JS Date semantics).
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid date value in where clause: ${String(value)}`);
    }
    return date;
  }
  if (kind === "number") {
    // Number("") / Number("  ") / Number([]) are 0 and Number(true) is 1 — reject
    // those rather than silently filtering on 0/1.
    if (typeof value !== "number" && typeof value !== "string") {
      throw new Error(`Invalid number value in where clause: ${String(value)}`);
    }
    if (typeof value === "string" && value.trim() === "") {
      throw new Error(`Invalid number value in where clause: (empty string)`);
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error(`Invalid number value in where clause: ${String(value)}`);
    }
    return num;
  }
  if (kind === "boolean") {
    // Accept form/query string values too ('true'/'false'/'1'/'0').
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1" || value === 1) return true;
    if (value === "false" || value === "0" || value === 0) return false;
    throw new Error(`Invalid boolean value in where clause: ${String(value)}`);
  }
  // text-backed columns (text/email/select/richText/single relation/id)
  if (typeof value !== "string") {
    throw new Error(`Invalid text value in where clause: ${String(value)}`);
  }
  return value;
}

// in/not_in: require a non-empty array with no null elements. A null inside the
// list would make the whole predicate UNKNOWN (NOT IN) or silently skip null rows
// (IN); callers should use `exists`/`equals: null` for that instead.
function coerceList(value: unknown, op: string, kind: ColumnKind): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Operator "${op}" expects an array value`);
  }
  if (!value.length) {
    throw new Error(`Operator "${op}" requires a non-empty array`);
  }
  if (value.some((entry) => entry === null)) {
    throw new Error(`Operator "${op}" does not accept null; use the "exists" operator instead`);
  }
  return value.map((entry) => coerce(entry, kind));
}

function buildOperatorCondition(
  op: string,
  column: unknown,
  value: unknown,
  kind: ColumnKind,
): unknown {
  switch (op) {
    case "equals":
      return value === null ? isNull(column as any) : eq(column as any, coerce(value, kind));
    case "not_equals":
      return value === null ? isNotNull(column as any) : ne(column as any, coerce(value, kind));
    case "greater_than":
      return gt(column as any, coerce(value, kind));
    case "greater_than_equal":
      return gte(column as any, coerce(value, kind));
    case "less_than":
      return lt(column as any, coerce(value, kind));
    case "less_than_equal":
      return lte(column as any, coerce(value, kind));
    case "in":
      return inArray(column as any, coerceList(value, op, kind));
    case "not_in":
      return notInArray(column as any, coerceList(value, op, kind));
    case "like":
      // `%`/`_` in the value act as LIKE wildcards (Payload `like` parity). The
      // value is parameter-bound by drizzle, so this is not an injection surface.
      return like(column as any, `%${coerce(value, "text") as string}%`);
    case "exists":
      return coerce(value, "boolean") ? isNotNull(column as any) : isNull(column as any);
    default:
      throw new Error(`Unknown where operator: "${op}"`);
  }
}

/**
 * Translate a {@link WhereClause} into a single drizzle-orm condition (or
 * `undefined` when empty). Scalar columns only — `group`/`array`/hasMany relation
 * fields are JSON and rejected. Values are parameter-bound by drizzle, so the only
 * injection surface (field/operator names) is validated against the schema here.
 */
export function buildWhere(
  where: WhereClause | undefined,
  table: Record<string, unknown>,
  fields: readonly FieldDefinition[],
  depth = 0,
): unknown {
  if (!where) return undefined;
  if (depth > MAX_DEPTH) {
    throw new Error(`Where clause is nested too deeply (max ${MAX_DEPTH} and/or levels)`);
  }

  const conditions: unknown[] = [];

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;

    if (key === "and" || key === "or") {
      if (!Array.isArray(value)) {
        throw new Error(`"${key}" in a where clause must be an array`);
      }
      const sub: unknown[] = [];
      for (const clause of value) {
        if (!isPlainObject(clause)) {
          throw new Error(`Each entry in "${key}" must be a where-clause object`);
        }
        const condition = buildWhere(clause, table, fields, depth + 1);
        if (condition !== undefined) sub.push(condition);
      }
      if (!sub.length) continue;
      conditions.push(sub.length === 1 ? sub[0] : (key === "and" ? and : or)(...(sub as any[])));
      continue;
    }

    if (!isPlainObject(value)) {
      throw new Error(`Filter for field "${key}" must be an object of operators`);
    }

    const { column, kind } = resolveColumn(key, table, fields);
    const allowed = OPS_BY_KIND[kind];
    for (const [op, opValue] of Object.entries(value)) {
      if (opValue === undefined) continue;
      if (!allowed.has(op)) {
        throw new Error(`Operator "${op}" is not supported on ${kind} field "${key}"`);
      }
      conditions.push(buildOperatorCondition(op, column, opValue, kind));
    }
  }

  if (!conditions.length) return undefined;
  return conditions.length === 1 ? conditions[0] : and(...(conditions as any[]));
}
