import type {
  AccessUser,
  CollectionData,
  CollectionRuntimeConfig,
  CollectionSlug,
  FieldstoneConfig,
  GlobalRuntimeConfig,
} from "@hugo-hsi-dev/schema";

import { getFieldstone, isForbiddenError } from "@hugo-hsi-dev/runtime";

import { assertUploadAllowed, buildStorageKey, type UploadFile } from "./upload.js";
import { generateVariants, loadSharp } from "./variants.js";

export async function createFieldstoneAdmin({ config }: { config: FieldstoneConfig }) {
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
      return configCollection?.upload ? { ...runtime, upload: configCollection.upload } : runtime;
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
            (field) => field.type === "text" || field.type === "email" || field.type === "select",
          )?.name ??
          collection.fields[0]?.name ??
          "id");
      return documents.map((document) => ({
        value: String(document.id),
        label: String(document[labelField] ?? document.id),
      }));
    },

    listDocuments: stone.find,
    countDocuments: stone.count,
    getDocument: stone.findById,
    createDocument: stone.create,

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
      await stone.storage.put(key, file.bytes);

      // Generate image variants (when sharp is installed); sharp's dimensions are
      // authoritative. Without sharp, dimensions stay null.
      const sharp = await loadSharp();
      const generated = await generateVariants({
        sharp,
        bytes: file.bytes,
        mimeType: file.type,
        originalKey: key,
        imageSizes: collectionConfig.upload.imageSizes,
        put: (variantKey, body) => stone.storage.put(variantKey, body),
      });
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
            width: generated.width,
            height: generated.height,
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

    updateDocument: stone.update,
    deleteDocument: stone.delete,
    getGlobal: stone.getGlobal,
    updateGlobal: stone.updateGlobal,
  };
}

export { createFieldstoneMedia, type FieldstoneMedia } from "./media.js";
export { isUploadError } from "./upload.js";
export { ForbiddenError, isForbiddenError } from "@hugo-hsi-dev/runtime";
