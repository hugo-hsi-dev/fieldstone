import type { InvalidField, RemoteFormInput } from "@sveltejs/kit";

import { createFieldstoneAdmin, isForbiddenError, isUploadError } from "./index.js";
import {
  adminCollectionPath,
  adminDocumentPath,
  adminGlobalPath,
  resolveAdminPath as resolveAdminRoutePath,
} from "./admin-paths.js";
import type {
  AccessUser,
  CollectionData,
  CollectionDocument,
  CollectionRuntimeConfig,
  CollectionRuntimeField,
  CollectionSlug,
  FieldstoneConfig,
  GlobalData,
  GlobalDocument,
  GlobalRuntimeConfig,
  GlobalSlug,
  NormalizedDocumentData,
} from "@hugo-hsi-dev/schema";
import { normalizeFieldValue } from "@hugo-hsi-dev/schema";

type SvelteKitRemoteDeps = {
  error(status: number, body: string): never;
  form: typeof import("$app/server").form;
  getRequestEvent: typeof import("$app/server").getRequestEvent;
  invalid(...issues: unknown[]): never;
  query: typeof import("$app/server").query;
  redirect(status: number, location: string | URL): never;
  resolve(routeId: string, params?: Record<string, string>): string;
};

let remoteDeps: SvelteKitRemoteDeps;

type CollectionInput = { collection: unknown };
type GlobalInputShape = { global: unknown };
type FindByIdInput = { collection: unknown; id: unknown };
type ListDocumentsInput = {
  collection: unknown;
  limit?: unknown;
  offset?: unknown;
  search?: unknown;
};
type DocumentMutationInput = RemoteFormInput & {
  collection: string;
  data?: RemoteFormInput;
  id?: string;
};
type GlobalMutationInput = RemoteFormInput & {
  data?: RemoteFormInput;
  global: string;
};
type DeleteDocumentInput = RemoteFormInput & {
  collection: string;
  id: string;
};
type UploadMediaInput = RemoteFormInput & {
  collection: string;
  file: File;
};

function currentUser(): AccessUser {
  try {
    return (remoteDeps.getRequestEvent().locals as { user?: AccessUser }).user ?? null;
  } catch {
    return null;
  }
}

function rethrowAsHttp(caught: unknown): never {
  if (isForbiddenError(caught)) remoteDeps.error(403, "Forbidden");
  throw caught;
}

function resolveAdminPath(path: string) {
  return resolveAdminRoutePath(remoteDeps.resolve, path);
}

function stringParam(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) remoteDeps.error(400, `${name} is required`);
  return value;
}

function optionalNumberParam(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function optionalStringParam(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fieldIssue(
  issue: InvalidField<DocumentMutationInput> | InvalidField<GlobalMutationInput>,
  field: CollectionRuntimeField,
  message: string,
) {
  return (issue as any).data[field.identifier](message);
}

function normalizeRemoteData(
  collection: CollectionRuntimeConfig | GlobalRuntimeConfig,
  data: unknown,
  issue: InvalidField<DocumentMutationInput> | InvalidField<GlobalMutationInput>,
): NormalizedDocumentData {
  if (data !== undefined && !isRecord(data))
    remoteDeps.invalid((issue as any).data("data must be an object"));

  const raw: Record<string, unknown> = isRecord(data) ? data : {};
  const known = new Set(collection.fields.map((field) => field.identifier));
  const issues: unknown[] = [];

  for (const key of Object.keys(raw)) {
    if (!known.has(key)) issues.push((issue as any).data[key](`Unknown field: ${key}`));
  }

  const normalized: NormalizedDocumentData = {};
  for (const field of collection.fields) {
    try {
      normalized[field.name] = normalizeFieldValue(field, raw[field.identifier]);
    } catch (caught) {
      issues.push(
        fieldIssue(
          issue,
          field,
          caught instanceof Error ? caught.message : `${field.name} is invalid`,
        ),
      );
    }
  }

  if (issues.length > 0) remoteDeps.invalid(...issues);
  return normalized;
}

function isDocumentNotFound(error: unknown) {
  return error instanceof Error && error.message === "Document not found";
}

export function createFieldstoneAdminRemotes({
  config,
  kit,
}: {
  config: FieldstoneConfig;
  kit: SvelteKitRemoteDeps;
}) {
  remoteDeps = kit;
  const { error, form, invalid, query, redirect } = kit;
  const admin = createFieldstoneAdmin({ config });

  async function getAdminCollection(collectionSlug: string) {
    const fieldstoneAdmin = await admin;
    const collection = fieldstoneAdmin.getCollection(collectionSlug);
    if (!collection) error(404, "Collection not found");

    return { collection: collection!, fieldstoneAdmin };
  }

  async function getAdminGlobal(globalSlug: string) {
    const fieldstoneAdmin = await admin;
    const global = fieldstoneAdmin.getGlobalConfig(globalSlug);
    if (!global) error(404, "Global not found");

    return { fieldstoneAdmin, global: global! };
  }

  return {
    listCollections: query(async () => {
      const fieldstoneAdmin = await admin;
      return fieldstoneAdmin.collections;
    }),

    getCollection: query("unchecked", async (input: CollectionInput) => {
      const collection = stringParam(input.collection, "collection");
      return (await getAdminCollection(collection)).collection;
    }),

    listRelationOptions: query("unchecked", async (input: CollectionInput) => {
      const collection = stringParam(input.collection, "collection");
      const user = currentUser();
      const fieldstoneAdmin = await admin;
      return fieldstoneAdmin.listRelationOptions(collection, user).catch(rethrowAsHttp);
    }),

    listGlobals: query(async () => {
      const fieldstoneAdmin = await admin;
      return fieldstoneAdmin.globals;
    }),

    getGlobalConfig: query("unchecked", async (input: GlobalInputShape) => {
      const global = stringParam(input.global, "global");
      return (await getAdminGlobal(global)).global;
    }),

    getGlobal: query("unchecked", async (input: GlobalInputShape) => {
      const global = stringParam(input.global, "global");
      const { fieldstoneAdmin, global: globalConfig } = await getAdminGlobal(global);
      return fieldstoneAdmin.getGlobal({
        global: globalConfig.slug as GlobalSlug,
      }) as Promise<GlobalDocument<GlobalSlug> | null>;
    }),

    listDocuments: query("unchecked", async (queryInput: ListDocumentsInput) => {
      const collection = stringParam(queryInput.collection, "collection");
      const limit = optionalNumberParam(queryInput.limit);
      const offset = optionalNumberParam(queryInput.offset);
      const search = optionalStringParam(queryInput.search);
      const user = currentUser();
      const { collection: collectionConfig, fieldstoneAdmin } =
        await getAdminCollection(collection);
      const listInput = {
        collection: collectionConfig.slug as CollectionSlug,
        user,
        ...(typeof limit === "number" ? { limit } : {}),
        ...(typeof offset === "number" ? { offset } : {}),
        ...(search ? { search } : {}),
      };
      const [docs, total] = await Promise.all([
        fieldstoneAdmin.listDocuments(listInput),
        fieldstoneAdmin.countDocuments(listInput),
      ]).catch(rethrowAsHttp);
      return {
        docs: docs as CollectionDocument<CollectionSlug>[],
        total,
      };
    }),

    getDocument: query.batch("unchecked", async (inputs: FindByIdInput[]) => {
      const user = currentUser();
      const fieldstoneAdmin = await admin;
      const documents = await Promise.all(
        inputs.map(async (input) => {
          const collectionSlug = stringParam(input.collection, "collection");
          const id = stringParam(input.id, "id");
          const collection = fieldstoneAdmin.getCollection(collectionSlug);
          if (!collection) error(404, "Collection not found");
          return fieldstoneAdmin.getDocument({
            collection: collection!.slug as CollectionSlug,
            id,
            user,
          });
        }),
      ).catch(rethrowAsHttp);

      return (_input, index) => {
        const document = documents[index];
        if (!document) error(404, "Document not found");
        return document as CollectionDocument<CollectionSlug>;
      };
    }),

    createDocument: form("unchecked", async (input: DocumentMutationInput, issue) => {
      // Read the request user synchronously before any await — getRequestEvent()
      // is only reliable pre-await on adapters without AsyncLocalStorage.
      const user = currentUser();
      const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);
      const data = normalizeRemoteData(collection, input.data, issue);
      const document = await fieldstoneAdmin
        .createDocument({
          collection: collection.slug as CollectionSlug,
          data: data as CollectionData<CollectionSlug>,
          user,
        })
        .catch(rethrowAsHttp);

      redirect(303, resolveAdminPath(adminDocumentPath(collection.slug, document.id)));
    }),

    uploadMedia: form("unchecked", async (input: UploadMediaInput, issue) => {
      // Read the request user synchronously before any await — getRequestEvent()
      // is only reliable pre-await on adapters without AsyncLocalStorage, and the
      // large arrayBuffer() read below makes the ordering especially fragile here.
      const user = currentUser();
      const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);
      if (!(input.file instanceof File)) invalid(issue.file("file is required"));
      // Reject a crafted submit to a non-upload collection as a form error,
      // before buffering the body, rather than letting it 500 downstream.
      if (!collection.upload) invalid("Collection does not support uploads");
      const bytes = new Uint8Array(await input.file.arrayBuffer());

      let document: { id: string };
      try {
        document = await fieldstoneAdmin.uploadMedia({
          collection: collection.slug as CollectionSlug,
          file: { name: input.file.name, type: input.file.type, bytes },
          user,
        });
      } catch (caught) {
        if (isForbiddenError(caught)) error(403, "Forbidden");
        // A bad mime/oversize file is a form validation problem, not a 500.
        if (isUploadError(caught)) invalid(caught.message);
        throw caught;
      }

      redirect(303, resolveAdminPath(adminDocumentPath(collection.slug, document.id)));
    }),

    updateDocument: form("unchecked", async (input: DocumentMutationInput, issue) => {
      const user = currentUser();
      if (typeof input.id !== "string" || input.id.length === 0)
        invalid(issue.id("id is required"));
      const id = input.id!;
      const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);
      const data = normalizeRemoteData(collection, input.data, issue);

      try {
        const document = await fieldstoneAdmin.updateDocument({
          collection: collection.slug as CollectionSlug,
          data: data as CollectionData<CollectionSlug>,
          id,
          user,
        });

        redirect(303, resolveAdminPath(adminDocumentPath(collection.slug, document.id)));
      } catch (caught) {
        if (isForbiddenError(caught)) error(403, "Forbidden");
        if (isDocumentNotFound(caught)) invalid("Could not find requested document");
        throw caught;
      }
    }),

    updateGlobal: form("unchecked", async (input: GlobalMutationInput, issue) => {
      const { fieldstoneAdmin, global } = await getAdminGlobal(input.global);
      const data = normalizeRemoteData(global, input.data, issue);
      await fieldstoneAdmin.updateGlobal({
        global: global.slug as GlobalSlug,
        data: data as GlobalData<GlobalSlug>,
      });

      redirect(303, resolveAdminPath(adminGlobalPath(global.slug)));
    }),

    deleteDocument: form("unchecked", async (input: DeleteDocumentInput, issue) => {
      const user = currentUser();
      if (typeof input.collection !== "string" || input.collection.length === 0)
        invalid(issue.collection("collection is required"));
      if (typeof input.id !== "string" || input.id.length === 0)
        invalid(issue.id("id is required"));
      const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);

      try {
        await fieldstoneAdmin.deleteDocument({
          collection: collection.slug as CollectionSlug,
          id: input.id,
          user,
        });

        redirect(303, resolveAdminPath(adminCollectionPath(collection.slug)));
      } catch (caught) {
        if (isForbiddenError(caught)) error(403, "Forbidden");
        if (isDocumentNotFound(caught)) invalid("Could not find requested document");
        throw caught;
      }
    }),
  };
}

export type FieldstoneAdminRemotes = ReturnType<typeof createFieldstoneAdminRemotes>;
