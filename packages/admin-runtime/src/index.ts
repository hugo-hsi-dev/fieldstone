import type {
  AccessUser,
  CollectionRuntimeConfig,
  CollectionSlug,
  FieldstoneConfig,
  GlobalRuntimeConfig,
  GlobalSlug,
} from "@fieldstone/schema";

import {
  getFieldstone,
  isForbiddenError,
  type CreateInput,
  type DocumentInput,
  type GlobalInput,
  type ListInput,
  type UpdateGlobalInput,
  type UpdateInput,
} from "@fieldstone/runtime";

export async function createFieldstoneAdmin({
  config,
}: {
  config: FieldstoneConfig;
}) {
  const stone = await getFieldstone({ config });

  return {
    collections: stone.collections,
    globals: stone.globals,

    getCollection(slug: string): CollectionRuntimeConfig | null {
      return stone.getCollection(slug);
    },

    getGlobalConfig(slug: string): GlobalRuntimeConfig | null {
      return stone.getGlobalConfig(slug);
    },

    async listRelationOptions(
      slug: string,
      user: AccessUser = null,
    ): Promise<{ value: string; label: string }[]> {
      const collection = stone.getCollection(slug);
      if (!collection) return [];
      // Pass the request user so relationship pickers honour the target
      // collection's access.read instead of being treated as anonymous. If the
      // target is unreadable, return no options so the source form still renders
      // (current ids are preserved via fallback options in the UI).
      let documents: Record<string, unknown>[];
      try {
        documents = (await stone.find({
          collection: slug as CollectionSlug,
          user,
        })) as Record<string, unknown>[];
      } catch (error) {
        if (isForbiddenError(error)) return [];
        throw error;
      }
      const labelField =
        collection.fields.find(
          (field) =>
            field.type === "text" ||
            field.type === "email" ||
            field.type === "select",
        )?.name ??
        collection.fields[0]?.name ??
        "id";
      return documents.map((document) => ({
        value: String(document.id),
        label: String(document[labelField] ?? document.id),
      }));
    },

    listDocuments<TCollection extends CollectionSlug>(
      input: ListInput<TCollection>,
    ) {
      return stone.find(input);
    },

    countDocuments<TCollection extends CollectionSlug>(
      input: ListInput<TCollection>,
    ) {
      return stone.count(input);
    },

    getDocument<TCollection extends CollectionSlug>(
      input: DocumentInput<TCollection>,
    ) {
      return stone.findById(input);
    },

    createDocument<TCollection extends CollectionSlug>(
      input: CreateInput<TCollection>,
    ) {
      return stone.create(input);
    },

    updateDocument<TCollection extends CollectionSlug>(
      input: UpdateInput<TCollection>,
    ) {
      return stone.update(input);
    },

    deleteDocument<TCollection extends CollectionSlug>(
      input: DocumentInput<TCollection>,
    ) {
      return stone.delete(input);
    },

    getGlobal<TGlobal extends GlobalSlug>(input: GlobalInput<TGlobal>) {
      return stone.getGlobal(input);
    },

    updateGlobal<TGlobal extends GlobalSlug>(
      input: UpdateGlobalInput<TGlobal>,
    ) {
      return stone.updateGlobal(input);
    },
  };
}

export { createFieldstoneRest } from "./rest.ts";
export { ForbiddenError, isForbiddenError } from "@fieldstone/runtime";
