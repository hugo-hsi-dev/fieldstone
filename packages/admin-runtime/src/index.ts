import type {
  CollectionRuntimeConfig,
  CollectionSlug,
  FieldstoneConfig,
  GlobalRuntimeConfig,
  GlobalSlug,
} from "@fieldstone/schema";

import {
  getFieldstone,
  type CollectionInput,
  type CreateInput,
  type DocumentInput,
  type GlobalInput,
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

    listDocuments<TCollection extends CollectionSlug>(
      input: CollectionInput<TCollection>,
    ) {
      return stone.find(input);
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
