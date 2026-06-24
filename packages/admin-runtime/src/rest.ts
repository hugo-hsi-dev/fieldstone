import type {
  AccessUser,
  CollectionData,
  CollectionSlug,
  CollectionWhere,
  DocumentStatus,
  FieldstoneConfig,
  GlobalData,
  GlobalSlug,
} from "@hugo-hsi-dev/schema";
import { isForbiddenError } from "@hugo-hsi-dev/runtime";

import { createFieldstoneAdmin } from "./index.ts";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data ?? null), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, message: string): Response {
  return json({ error: message }, status);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    return parsed as Record<string, unknown>;
  throw new Error("Request body must be a JSON object");
}

/**
 * PATCH semantics: overlay only the provided fields onto the current document so
 * omitted fields keep their stored values. Without this the full-replacement
 * normalizer would reset omitted optional/boolean/defaulted fields and reject
 * the request for any missing required field.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  // Only deep-merge plain group records; replace scalar object values wholesale.
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const existing = result[key];
    result[key] =
      isPlainObject(value) && isPlainObject(existing)
        ? deepMerge(existing, value)
        : value;
  }
  return result;
}

function mergePatch(
  content: { fields: ReadonlyArray<{ name: string }> },
  existing: Record<string, unknown>,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const known = new Set(content.fields.map((field) => field.name));
  // Reject unknown keys up front (like POST/PUT) instead of silently dropping a
  // typo such as { titel: "..." } and returning 200 with the document unchanged.
  for (const key of Object.keys(body)) {
    if (!known.has(key)) throw new Error(`Unknown field: ${key}`);
  }
  const merged: Record<string, unknown> = {};
  for (const { name } of content.fields) {
    if (Object.prototype.hasOwnProperty.call(body, name)) {
      const bodyValue = body[name];
      const existingValue = existing[name];
      // Deep-merge group objects so a partial group payload keeps omitted siblings.
      merged[name] =
        isPlainObject(bodyValue) && isPlainObject(existingValue)
          ? deepMerge(existingValue, bodyValue)
          : bodyValue;
    } else if (Object.prototype.hasOwnProperty.call(existing, name)) {
      merged[name] = existing[name];
    }
  }
  return merged;
}

/**
 * A framework-agnostic REST handler over the Fieldstone runtime. Mount it from a
 * SvelteKit `+server.ts` (or any web-standard request handler) and forward the path
 * segments after the API base, e.g. `/api/posts`, `/api/posts/:id`, `/api/globals/:slug`.
 */
export function createFieldstoneRest({
  config,
  getUser,
}: {
  config: FieldstoneConfig;
  /** Resolve the requesting user from the request (e.g. from a session) for access control. */
  getUser?: (request: Request) => AccessUser | Promise<AccessUser>;
}) {
  const adminPromise = createFieldstoneAdmin({ config });

  async function route(
    request: Request,
    segments: string[],
    user: AccessUser,
  ): Promise<Response> {
    const admin = await adminPromise;
    const method = request.method.toUpperCase();
    const url = new URL(request.url);
    const path = segments.filter(Boolean);

    if (path.length === 0) {
      if (method !== "GET") return errorResponse(405, "Method not allowed");
      return json({ collections: admin.collections, globals: admin.globals });
    }

    if (path[0] === "globals") {
      const slug = path[1];
      if (!slug || path.length !== 2) return errorResponse(404, "Not found");
      if (!admin.getGlobalConfig(slug))
        return errorResponse(404, "Global not found");

      if (method === "GET") {
        return json(await admin.getGlobal({ global: slug as GlobalSlug }));
      }
      if (method === "POST" || method === "PUT" || method === "PATCH") {
        const body = await readBody(request);
        let data = body as GlobalData<GlobalSlug>;
        if (method === "PATCH") {
          const existing = await admin.getGlobal({ global: slug as GlobalSlug });
          const globalConfig = admin.getGlobalConfig(slug);
          if (existing && globalConfig)
            data = mergePatch(
              globalConfig,
              existing as Record<string, unknown>,
              body,
            ) as GlobalData<GlobalSlug>;
        }
        return json(await admin.updateGlobal({ global: slug as GlobalSlug, data }));
      }
      return errorResponse(405, "Method not allowed");
    }

    const collectionSlug = path[0];
    if (!admin.getCollection(collectionSlug))
      return errorResponse(404, "Collection not found");

    if (path.length === 1) {
      if (method === "GET") {
        const params = url.searchParams;
        const statusParam = params.get("status");
        // Reject an invalid status rather than dropping the filter — silently
        // ignoring e.g. ?status=publised would return drafts too.
        if (
          statusParam !== null &&
          statusParam !== "draft" &&
          statusParam !== "published"
        )
          return errorResponse(400, `Invalid status: ${statusParam}`);
        const status: DocumentStatus | undefined =
          statusParam === "draft" || statusParam === "published"
            ? statusParam
            : undefined;
        const search = params.get("search") ?? undefined;
        const limitParam = params.has("limit") ? Number(params.get("limit")) : undefined;
        const limit =
          limitParam !== undefined && !Number.isNaN(limitParam) ? limitParam : undefined;
        const offsetParam = params.has("offset") ? Number(params.get("offset")) : undefined;
        const offset =
          offsetParam !== undefined && !Number.isNaN(offsetParam) ? offsetParam : undefined;
        const sortField = params.get("sort") ?? undefined;
        const sort = sortField
          ? { field: sortField, direction: params.get("order") === "asc" ? ("asc" as const) : ("desc" as const) }
          : undefined;
        // `where` is a URL-encoded JSON object; the runtime validates its shape
        // (and a bad field/operator surfaces as a 400 via the error wrapper).
        const whereParam = params.get("where");
        let where: CollectionWhere<CollectionSlug> | undefined;
        if (whereParam) {
          try {
            where = JSON.parse(whereParam) as CollectionWhere<CollectionSlug>;
          } catch {
            return errorResponse(400, "Invalid where parameter: must be URL-encoded JSON");
          }
        }
        const input = {
          collection: collectionSlug as CollectionSlug,
          user,
          ...(status ? { status } : {}),
          ...(search ? { search } : {}),
          ...(limit !== undefined ? { limit } : {}),
          ...(offset !== undefined ? { offset } : {}),
          ...(sort ? { sort } : {}),
          ...(where ? { where } : {}),
        };
        const [docs, total] = await Promise.all([
          admin.listDocuments(input),
          admin.countDocuments(input),
        ]);
        return json({ docs, total, limit: limit ?? docs.length, offset: offset ?? 0 });
      }
      if (method === "POST") {
        const data = (await readBody(request)) as CollectionData<CollectionSlug>;
        const doc = await admin.createDocument({
          collection: collectionSlug as CollectionSlug,
          data,
          user,
        });
        return json(doc, 201);
      }
      return errorResponse(405, "Method not allowed");
    }

    if (path.length === 2) {
      const id = path[1]!;
      if (method === "GET") {
        const doc = await admin.getDocument({
          collection: collectionSlug as CollectionSlug,
          id,
          user,
        });
        if (!doc) return errorResponse(404, "Document not found");
        return json(doc);
      }
      if (method === "PATCH" || method === "PUT") {
        const data = (await readBody(request)) as CollectionData<CollectionSlug>;
        // PATCH merges onto the stored row inside the runtime (under the same
        // update access, reading the raw row — no afterRead, no read-gating).
        // PUT stays a full replacement.
        const doc = await admin.updateDocument({
          collection: collectionSlug as CollectionSlug,
          id,
          data,
          user,
          ...(method === "PATCH" ? { merge: true } : {}),
        });
        return json(doc);
      }
      if (method === "DELETE") {
        await admin.deleteDocument({
          collection: collectionSlug as CollectionSlug,
          id,
          user,
        });
        return json({ id });
      }
      return errorResponse(405, "Method not allowed");
    }

    return errorResponse(404, "Not found");
  }

  async function handle(
    request: Request,
    segments: string[],
  ): Promise<Response> {
    const user = getUser ? await getUser(request) : null;
    try {
      return await route(request, segments, user);
    } catch (error) {
      if (isForbiddenError(error)) return errorResponse(403, errorMessage(error));
      const message = errorMessage(error);
      if (message === "Document not found") return errorResponse(404, message);
      return errorResponse(400, message);
    }
  }

  return { handle };
}
