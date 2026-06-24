import type {
  AccessUser,
  CollectionData,
  CollectionRuntimeConfig,
  CollectionSlug,
  FieldstoneConfig,
  GlobalRuntimeConfig,
  GlobalSlug,
} from "@hugo-hsi-dev/schema";

import {
  getFieldstone,
  isForbiddenError,
  type CreateInput,
  type DocumentInput,
  type GlobalInput,
  type ListInput,
  type UpdateGlobalInput,
  type UpdateInput,
} from "@hugo-hsi-dev/runtime";

import {
  assertUploadAllowed,
  buildStorageKey,
  probeImageDimensions,
  type UploadFile,
} from "./upload.ts";
import { generateVariants, loadSharp } from "./variants.ts";

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
      const runtime = stone.getCollection(slug);
      if (!runtime) return null;
      // Surface the collection's upload options to the admin (the runtime config
      // from the compiler carries only fields + slug).
      const configCollection = Object.values(config.collections).find(
        (candidate) => candidate.slug === slug,
      );
      return configCollection?.upload
        ? { ...runtime, upload: configCollection.upload }
        : runtime;
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
      // Upload (media) collections are labeled by their stored filename — the
      // first user field (e.g. an optional `alt`) is often blank.
      const isUpload = Object.values(config.collections).some(
        (candidate) => candidate.slug === slug && Boolean(candidate.upload),
      );
      const labelField = isUpload
        ? "filename"
        : (collection.fields.find(
            (field) =>
              field.type === "text" ||
              field.type === "email" ||
              field.type === "select",
          )?.name ??
          collection.fields[0]?.name ??
          "id");
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

    // Store an uploaded file and persist its media document. Validates the
    // collection's mime/size rules, writes the original via the storage adapter
    // under a unique key, probes image dimensions, and creates the media doc
    // (which enforces create access). The bytes are removed if the DB write fails
    // so a rejected upload never orphans a file.
    async uploadMedia({
      collection: slug,
      file,
      data = {},
      user = null,
    }: {
      collection: string;
      file: UploadFile;
      data?: Record<string, unknown>;
      user?: AccessUser;
    }) {
      const collectionConfig = Object.values(config.collections).find(
        (candidate) => candidate.slug === slug,
      );
      if (!collectionConfig?.upload)
        throw new Error(`Collection "${slug}" is not an upload collection`);

      assertUploadAllowed(file, collectionConfig.upload);

      const key = buildStorageKey(slug, file.name);
      await stone.storage.put(key, file.bytes, { contentType: file.type });

      // Generate image variants (when sharp is installed); sharp's dimensions are
      // authoritative, with the pure-JS probe as the no-sharp fallback.
      const sharp = await loadSharp();
      const generated = await generateVariants({
        sharp,
        bytes: file.bytes,
        mimeType: file.type,
        originalKey: key,
        imageSizes: collectionConfig.upload.imageSizes,
        put: (variantKey, body, meta) => stone.storage.put(variantKey, body, meta),
      });
      // Only decode for dimensions if sharp didn't already provide them.
      const probe =
        generated.width == null || generated.height == null
          ? probeImageDimensions(file.bytes)
          : null;

      try {
        return await stone.create({
          collection: slug as CollectionSlug,
          // User fields only; the read-only metadata is set via the trusted
          // `system` channel so a user can never write filename/mimeType/etc.
          data: data as CollectionData<CollectionSlug>,
          system: {
            filename: key,
            mimeType: file.type,
            filesize: file.bytes.byteLength,
            width: generated.width ?? probe?.width ?? null,
            height: generated.height ?? probe?.height ?? null,
            sizes: generated.variants,
          },
          user,
        });
      } catch (caught) {
        // Don't orphan the original or any generated variant on a failed write.
        await stone.storage.delete(key).catch(() => {});
        for (const variant of generated.variants)
          await stone.storage.delete(variant.filename).catch(() => {});
        throw caught;
      }
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
export { createFieldstoneMedia, type FieldstoneMedia } from "./media.ts";
export {
  generateVariants,
  loadSharp,
  resetSharpForTests,
  type GenerateVariantsResult,
  type ImageVariant,
  type SharpModule,
} from "./variants.ts";
export {
  assertUploadAllowed,
  buildStorageKey,
  isUploadError,
  mimeAllowed,
  probeImageDimensions,
  UploadError,
  type UploadFile,
  type UploadValidationOptions,
} from "./upload.ts";
export { ForbiddenError, isForbiddenError } from "@hugo-hsi-dev/runtime";
