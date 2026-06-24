import type { AccessUser, FieldDefinition } from "@hugo-hsi-dev/schema";

type Doc = Record<string, unknown>;

type RelationField = FieldDefinition & {
  type: "relationship" | "upload";
  relationTo: string;
  hasMany?: boolean;
};

function isRelationField(field: FieldDefinition): field is RelationField {
  return field.type === "relationship" || field.type === "upload";
}

/**
 * Single-level `populate`: replace each top-level relation/upload field's stored
 * id(s) with the target document(s). Fetching goes through `fetchRelated`, which
 * applies the target collection's read access + afterRead hooks — so a populate
 * never escalates access. Single refs resolve to the doc or `null` (missing /
 * forbidden); hasMany refs resolve to the docs that were found (others dropped).
 *
 * Mutates `docs` in place, so a parent collection's afterRead hook must return
 * mutable, per-row objects. Populated docs are shared by reference across parents
 * that point to the same id, so the returned tree is read-only — don't mutate a
 * populated relation. Top-level fields only — group/array-nested relations are not
 * yet populated.
 */
export async function populateDocuments(
  docs: Doc[],
  fields: readonly FieldDefinition[],
  user: AccessUser | null | undefined,
  fetchRelated: (
    targetSlug: string,
    ids: string[],
    user: AccessUser | null | undefined,
  ) => Promise<Doc[]>,
): Promise<void> {
  if (!docs.length) return;
  const relations = fields.filter(isRelationField);
  if (!relations.length) return;

  for (const field of relations) {
    const ids = new Set<string>();
    for (const doc of docs) {
      const value = doc[field.name];
      if (field.hasMany && Array.isArray(value)) {
        for (const id of value) if (typeof id === "string") ids.add(id);
      } else if (typeof value === "string") {
        ids.add(value);
      }
    }
    if (!ids.size) continue;

    const related = await fetchRelated(field.relationTo, [...ids], user);
    const byId = new Map<string, Doc>();
    for (const doc of related) {
      if (typeof doc.id === "string") byId.set(doc.id, doc);
    }

    for (const doc of docs) {
      const value = doc[field.name];
      if (field.hasMany && Array.isArray(value)) {
        doc[field.name] = value.flatMap((id) =>
          typeof id === "string" && byId.has(id) ? [byId.get(id)!] : [],
        );
      } else if (typeof value === "string") {
        doc[field.name] = byId.get(value) ?? null;
      }
    }
  }
}
