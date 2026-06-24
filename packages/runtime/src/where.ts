import type { FieldDefinition } from "@hugo-hsi-dev/schema";
import { STATUS_FIELD_NAME } from "@hugo-hsi-dev/schema";

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

// drizzle-orm operators, injected so this module stays pure/testable and keeps the
// runtime's dynamic-import-of-drizzle pattern (see database.ts). Params are `any`
// so the real drizzle operator signatures (Column | SQL | …) are assignable.
export interface WhereOps {
  and: (...conditions: any[]) => unknown;
  or: (...conditions: any[]) => unknown;
  eq: (column: any, value: any) => unknown;
  ne: (column: any, value: any) => unknown;
  gt: (column: any, value: any) => unknown;
  gte: (column: any, value: any) => unknown;
  lt: (column: any, value: any) => unknown;
  lte: (column: any, value: any) => unknown;
  like: (column: any, value: any) => unknown;
  inArray: (column: any, values: any[]) => unknown;
  notInArray: (column: any, values: any[]) => unknown;
  isNull: (column: any) => unknown;
  isNotNull: (column: any) => unknown;
}

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

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
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
      throw new Error(
        `Cannot filter on "${field.type}" field "${fieldName}" (stored as JSON)`,
      );
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

  // hasOwn guard: a bare `SYSTEM_COLUMN_KINDS[key]` would return inherited
  // Object.prototype members (constructor, toString, …) for crafted keys.
  const systemKind = hasOwn(SYSTEM_COLUMN_KINDS, key) ? SYSTEM_COLUMN_KINDS[key] : undefined;
  if (systemKind) return { column: table[key], kind: systemKind };

  const field = fields.find((candidate) => candidate.name === key);
  if (!field) throw new Error(`Unknown field in where clause: "${key}"`);

  const kind = fieldKind(field, key);
  const column = table[key];
  if (column == null) {
    throw new Error(`No column for field "${key}"`);
  }
  return { column, kind };
}

function coerce(value: unknown, kind: ColumnKind): unknown {
  if (value === null) return null;
  if (kind === "date") {
    // Numeric inputs are epoch milliseconds (JS Date semantics).
    const date = value instanceof Date ? value : new Date(value as string | number);
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
    // Accept REST-style string forms too ('true'/'false'/'1'/'0').
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1" || value === 1) return true;
    if (value === "false" || value === "0" || value === 0) return false;
    throw new Error(`Invalid boolean value in where clause: ${String(value)}`);
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
  ops: WhereOps,
): unknown {
  switch (op) {
    case "equals":
      return value === null ? ops.isNull(column) : ops.eq(column, coerce(value, kind));
    case "not_equals":
      return value === null ? ops.isNotNull(column) : ops.ne(column, coerce(value, kind));
    case "greater_than":
      return ops.gt(column, coerce(value, kind));
    case "greater_than_equal":
      return ops.gte(column, coerce(value, kind));
    case "less_than":
      return ops.lt(column, coerce(value, kind));
    case "less_than_equal":
      return ops.lte(column, coerce(value, kind));
    case "in":
      return ops.inArray(column, coerceList(value, op, kind));
    case "not_in":
      return ops.notInArray(column, coerceList(value, op, kind));
    case "like":
      // `%`/`_` in the value act as LIKE wildcards (Payload `like` parity). The
      // value is parameter-bound by drizzle, so this is not an injection surface.
      return ops.like(column, `%${String(value)}%`);
    case "exists":
      return coerce(value, "boolean") ? ops.isNotNull(column) : ops.isNull(column);
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
  ops: WhereOps,
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
        const condition = buildWhere(clause, table, fields, ops, depth + 1);
        if (condition !== undefined) sub.push(condition);
      }
      if (!sub.length) continue;
      conditions.push(sub.length === 1 ? sub[0] : (key === "and" ? ops.and : ops.or)(...sub));
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
      conditions.push(buildOperatorCondition(op, column, opValue, kind, ops));
    }
  }

  if (!conditions.length) return undefined;
  return conditions.length === 1 ? conditions[0] : ops.and(...conditions);
}
