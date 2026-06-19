// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="./fieldstone-config.d.ts" />

import { form, getRequestEvent, query } from "$app/server";
import { resolve } from "$app/paths";
import { error, invalid, redirect } from "@sveltejs/kit";
import * as v from "valibot";

import { createFieldstoneAdmin, isForbiddenError } from "@fieldstone/admin-runtime";
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
} from "@fieldstone/schema";
import { normalizeBooleanFieldValue, normalizeFieldValue } from "@fieldstone/schema";
import { compileFieldstoneConfig } from "@fieldstone/compiler";

import {
  adminCollectionPath,
  adminDocumentPath,
  adminGlobalPath,
  adminRouteId,
  adminRouteSegments,
} from "@fieldstone/routes";

function currentUser(): AccessUser {
  try {
    return (getRequestEvent().locals as { user?: AccessUser }).user ?? null;
  } catch {
    return null;
  }
}

function rethrowAsHttp(caught: unknown): never {
  if (isForbiddenError(caught)) error(403, "Forbidden");
  throw caught;
}

function resolveAdminPath(path: string) {
  return resolve(adminRouteId, { segments: adminRouteSegments(path) });
}

const collectionSchema = v.object({
  collection: v.string(),
});

const listSchema = v.object({
  collection: v.string(),
  limit: v.optional(v.number()),
  offset: v.optional(v.number()),
  search: v.optional(v.string()),
});

const findByIdSchema = v.object({
  collection: v.string(),
  id: v.string(),
});

const globalSchema = v.object({
  global: v.string(),
});

function createValueFieldSchema(field: CollectionRuntimeField) {
  return v.pipe(
    v.unknown(),
    v.rawTransform(({ dataset, addIssue, NEVER }) => {
      try {
        return normalizeFieldValue(field, dataset.value);
      } catch (caught) {
        addIssue({
          message: caught instanceof Error ? caught.message : `${field.name} is invalid`,
        });
        return NEVER;
      }
    }),
  );
}

function createBooleanFieldSchema() {
  // SvelteKit's `as('checkbox', boolean)` emits a `b:`-prefixed field that the
  // form runtime coerces to a real boolean (checked → true). An unchecked box is
  // omitted entirely, so default a missing value to false.
  return v.optional(
    v.pipe(
      v.unknown(),
      v.transform((value) => normalizeBooleanFieldValue(value)),
    ),
    false,
  );
}

function createCollectionDataSchema(
  collection: CollectionRuntimeConfig | GlobalRuntimeConfig,
) {
  const entries: Record<string, any> = {};

  for (const field of collection.fields) {
    if (field.type === "boolean") {
      entries[field.identifier] = createBooleanFieldSchema();
    } else if (field.type === "relationship" && field.hasMany && !field.required) {
      // An empty optional multi-select submits no key at all, so make it optional.
      // Required ones stay mandatory so an empty selection is a field validation
      // issue rather than a null forwarded to the runtime.
      entries[field.identifier] = v.optional(createValueFieldSchema(field));
    } else {
      entries[field.identifier] = createValueFieldSchema(field);
    }
  }

  return v.pipe(
    v.strictObject(entries),
    v.transform((data) => {
      const normalized: NormalizedDocumentData = {};
      for (const field of collection.fields) {
        normalized[field.name] = data[field.identifier] ?? null;
      }
      return normalized;
    }),
  );
}

function createFormDataSchema(
  collection: CollectionRuntimeConfig | GlobalRuntimeConfig,
) {
  const data = createCollectionDataSchema(collection);
  return collection.fields.length === 0 ? v.optional(data, {}) : data;
}

function createDocumentMutationSchema(
  collections: CollectionRuntimeConfig[],
  id: "none" | "optional" | "required",
) {
  const variants = collections.map((collection) => {
    const entries = {
      ...(id === "required" ? { id: v.string() } : {}),
      ...(id === "optional" ? { id: v.optional(v.string()) } : {}),
      collection: v.literal(collection.slug),
      data: createFormDataSchema(collection),
    };

    return v.strictObject(entries);
  });

  if (variants.length === 0) {
    return v.strictObject({
      ...(id === "required" ? { id: v.never() } : {}),
      ...(id === "optional" ? { id: v.optional(v.never()) } : {}),
      collection: v.never(),
      data: v.optional(v.strictObject({}), {}),
    });
  }

  return variants.length === 1
    ? variants[0]
    : v.variant("collection", variants as any);
}

function createGlobalMutationSchema(globals: GlobalRuntimeConfig[]) {
  const variants = globals.map((global) => {
    return v.strictObject({
      global: v.literal(global.slug),
      data: createFormDataSchema(global),
    });
  });

  if (variants.length === 0) {
    return v.strictObject({
      global: v.never(),
      data: v.optional(v.strictObject({}), {}),
    });
  }

  return variants.length === 1
    ? variants[0]
    : v.variant("global", variants as any);
}

function isDocumentNotFound(error: unknown) {
  return error instanceof Error && error.message === "Document not found";
}

export function createFieldstoneAdminRemotes({
  config,
}: {
  config: FieldstoneConfig;
}) {
  const compiled = compileFieldstoneConfig(config);
  const collections = compiled.createCollectionRuntimeConfigs();
  const createSchema = createDocumentMutationSchema(collections, "optional");
  const globals = compiled.createGlobalRuntimeConfigs();
  const updateSchema = createDocumentMutationSchema(collections, "required");
  const updateGlobalSchema = createGlobalMutationSchema(globals);
  const deleteSchema = v.strictObject({
    collection: v.string(),
    id: v.string(),
  });
  const admin = createFieldstoneAdmin({ config });

  async function getFieldstoneAdmin() {
    return admin;
  }

  async function getAdminCollection(collectionSlug: string) {
    const fieldstoneAdmin = await getFieldstoneAdmin();
    const collection = fieldstoneAdmin.getCollection(collectionSlug);
    if (!collection) error(404, "Collection not found");

    return { collection, fieldstoneAdmin };
  }

  async function getAdminGlobal(globalSlug: string) {
    const fieldstoneAdmin = await getFieldstoneAdmin();
    const global = fieldstoneAdmin.getGlobalConfig(globalSlug);
    if (!global) error(404, "Global not found");

    return { fieldstoneAdmin, global };
  }

  return {
    listCollections: query(async () => {
      const fieldstoneAdmin = await getFieldstoneAdmin();
      return fieldstoneAdmin.collections;
    }),

    getCollection: query(collectionSchema, async ({ collection }) => {
      return (await getAdminCollection(collection)).collection;
    }),

    listRelationOptions: query(collectionSchema, async ({ collection }) => {
      const fieldstoneAdmin = await getFieldstoneAdmin();
      return fieldstoneAdmin
        .listRelationOptions(collection, currentUser())
        .catch(rethrowAsHttp);
    }),

    listGlobals: query(async () => {
      const fieldstoneAdmin = await getFieldstoneAdmin();
      return fieldstoneAdmin.globals;
    }),

    getGlobalConfig: query(globalSchema, async ({ global }) => {
      return (await getAdminGlobal(global)).global;
    }),

    getGlobal: query(globalSchema, async ({ global }) => {
      const { fieldstoneAdmin, global: globalConfig } =
        await getAdminGlobal(global);
      return fieldstoneAdmin.getGlobal({
        global: globalConfig.slug as GlobalSlug,
      }) as Promise<GlobalDocument<GlobalSlug> | null>;
    }),

    listDocuments: query(
      listSchema,
      async ({ collection, limit, offset, search }) => {
        const { collection: collectionConfig, fieldstoneAdmin } =
          await getAdminCollection(collection);
        const input = {
          collection: collectionConfig.slug as CollectionSlug,
          user: currentUser(),
          ...(typeof limit === "number" ? { limit } : {}),
          ...(typeof offset === "number" ? { offset } : {}),
          ...(search ? { search } : {}),
        };
        const [docs, total] = await Promise.all([
          fieldstoneAdmin.listDocuments(input),
          fieldstoneAdmin.countDocuments(input),
        ]).catch(rethrowAsHttp);
        return {
          docs: docs as CollectionDocument<CollectionSlug>[],
          total,
        };
      },
    ),

    getDocument: query.batch(findByIdSchema, async (inputs) => {
      const fieldstoneAdmin = await getFieldstoneAdmin();
      const user = currentUser();
      const documents = await Promise.all(
        inputs.map(async (input) => {
          const collection = fieldstoneAdmin.getCollection(input.collection);
          if (!collection) error(404, "Collection not found");
          return fieldstoneAdmin.getDocument({
            collection: collection.slug as CollectionSlug,
            id: input.id,
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

    createDocument: form(
      createSchema as any,
      async (input: {
        collection: string;
        data: NormalizedDocumentData;
        id?: string;
      }) => {
        const { collection, fieldstoneAdmin } = await getAdminCollection(
          input.collection,
        );
        const document = await fieldstoneAdmin
          .createDocument({
            collection: collection.slug as CollectionSlug,
            data: input.data as CollectionData<CollectionSlug>,
            user: currentUser(),
          })
          .catch(rethrowAsHttp);

        redirect(
          303,
          resolveAdminPath(adminDocumentPath(collection.slug, document.id)),
        );
      },
    ),

    updateDocument: form(
      updateSchema as any,
      async (input: {
        collection: string;
        data: NormalizedDocumentData;
        id: string;
      }) => {
        const { collection, fieldstoneAdmin } = await getAdminCollection(
          input.collection,
        );

        try {
          const document = await fieldstoneAdmin.updateDocument({
            collection: collection.slug as CollectionSlug,
            data: input.data as CollectionData<CollectionSlug>,
            id: input.id,
            user: currentUser(),
          });

          redirect(
            303,
            resolveAdminPath(adminDocumentPath(collection.slug, document.id)),
          );
        } catch (caught) {
          if (isForbiddenError(caught)) error(403, "Forbidden");
          if (isDocumentNotFound(caught))
            invalid("Could not find requested document");
          throw caught;
        }
      },
    ),

    updateGlobal: form(
      updateGlobalSchema as any,
      async (input: { data: NormalizedDocumentData; global: string }) => {
        const { fieldstoneAdmin, global } = await getAdminGlobal(input.global);
        await fieldstoneAdmin.updateGlobal({
          global: global.slug as GlobalSlug,
          data: input.data as GlobalData<GlobalSlug>,
        });

        redirect(303, resolveAdminPath(adminGlobalPath(global.slug)));
      },
    ),

    deleteDocument: form(deleteSchema, async (input) => {
      const { collection, fieldstoneAdmin } = await getAdminCollection(
        input.collection,
      );

      try {
        await fieldstoneAdmin.deleteDocument({
          collection: collection.slug as CollectionSlug,
          id: input.id,
          user: currentUser(),
        });

        redirect(303, resolveAdminPath(adminCollectionPath(collection.slug)));
      } catch (caught) {
        if (isForbiddenError(caught)) error(403, "Forbidden");
        if (isDocumentNotFound(caught))
          invalid("Could not find requested document");
        throw caught;
      }
    }),
  };
}

export type FieldstoneAdminRemotes = ReturnType<
  typeof createFieldstoneAdminRemotes
>;
