import { form, query } from '$app/server';
import { base } from '$app/paths';
import { error, invalid, redirect } from '@sveltejs/kit';
import * as v from 'valibot';

import { createFieldstoneAdmin } from '@fieldstone/client/admin';
import type {
	CollectionData,
	CollectionDocument,
	CollectionRuntimeConfig,
	CollectionRuntimeField,
	CollectionSlug,
	FieldstoneConfig,
	NormalizedDocumentData
} from '@fieldstone/core';
import { compileFieldstoneConfig } from '@fieldstone/core/schema';

import { adminCollectionPath, adminDocumentPath } from './route.ts';

const collectionSchema = v.object({
	collection: v.string()
});

const findByIdSchema = v.object({
	collection: v.string(),
	id: v.string()
});

function createTextFieldSchema(field: CollectionRuntimeField) {
	const text = v.pipe(v.string(), v.trim());
	if (field.required) return v.pipe(text, v.nonEmpty(`${field.name} is required`));
	return v.pipe(text, v.transform((value) => value || null));
}

function createCollectionDataSchema(collection: CollectionRuntimeConfig) {
	const entries: Record<string, ReturnType<typeof createTextFieldSchema>> = {};

	for (const field of collection.fields) {
		switch (field.type) {
			case 'text':
				entries[field.identifier] = createTextFieldSchema(field);
				break;
			default: {
				const exhaustive: never = field.type;
				throw new Error(`Unsupported field type: ${exhaustive}`);
			}
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
		})
	);
}

function createFormDataSchema(collection: CollectionRuntimeConfig) {
	const data = createCollectionDataSchema(collection);
	return collection.fields.length === 0 ? v.optional(data, {}) : data;
}

function createDocumentMutationSchema(
	collections: CollectionRuntimeConfig[],
	id: 'none' | 'optional' | 'required'
) {
	const variants = collections.map((collection) => {
		const entries = {
			...(id === 'required' ? { id: v.string() } : {}),
			...(id === 'optional' ? { id: v.optional(v.string()) } : {}),
			collection: v.literal(collection.slug),
			data: createFormDataSchema(collection)
		};

		return v.strictObject(entries);
	});

	if (variants.length === 0) {
		return v.strictObject({
			...(id === 'required' ? { id: v.never() } : {}),
			...(id === 'optional' ? { id: v.optional(v.never()) } : {}),
			collection: v.never(),
			data: v.optional(v.strictObject({}), {})
		});
	}

	return variants.length === 1 ? variants[0] : v.variant('collection', variants as any);
}

function isDocumentNotFound(error: unknown) {
	return error instanceof Error && error.message === 'Document not found';
}

export function createFieldstoneAdminRemotes({ config }: { config: FieldstoneConfig }) {
	const compiled = compileFieldstoneConfig(config);
	const collections = compiled.createCollectionRuntimeConfigs();
	const createSchema = createDocumentMutationSchema(collections, 'optional');
	const updateSchema = createDocumentMutationSchema(collections, 'required');
	const deleteSchema = v.strictObject({
		collection: v.string(),
		id: v.string()
	});
	const admin = createFieldstoneAdmin({ config });

	async function getFieldstoneAdmin() {
		return admin;
	}

	async function getAdminCollection(collectionSlug: string) {
		const fieldstoneAdmin = await getFieldstoneAdmin();
		const collection = fieldstoneAdmin.getCollection(collectionSlug);
		if (!collection) error(404, 'Collection not found');

		return { collection, fieldstoneAdmin };
	}

	return {
		listCollections: query(async () => {
			const fieldstoneAdmin = await getFieldstoneAdmin();
			return fieldstoneAdmin.collections;
		}),

		getCollection: query(collectionSchema, async ({ collection }) => {
			return (await getAdminCollection(collection)).collection;
		}),

		listDocuments: query(collectionSchema, async ({ collection }) => {
			const { collection: collectionSlug, fieldstoneAdmin } = await getAdminCollection(collection);
			return fieldstoneAdmin.listDocuments({
				collection: collectionSlug.slug as CollectionSlug
			}) as Promise<CollectionDocument<CollectionSlug>[]>;
		}),

		getDocument: query.batch(findByIdSchema, async (inputs) => {
			const fieldstoneAdmin = await getFieldstoneAdmin();
			const documents = await Promise.all(
				inputs.map(async (input) => {
					const collection = fieldstoneAdmin.getCollection(input.collection);
					if (!collection) error(404, 'Collection not found');
					return fieldstoneAdmin.getDocument({
						collection: collection.slug as CollectionSlug,
						id: input.id
					});
				})
			);

			return (_input, index) => {
				const document = documents[index];
				if (!document) error(404, 'Document not found');
				return document as CollectionDocument<CollectionSlug>;
			};
		}),

		createDocument: form(
			createSchema as any,
			async (input: { collection: string; data: NormalizedDocumentData; id?: string }) => {
				const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);
				const document = await fieldstoneAdmin.createDocument({
					collection: collection.slug as CollectionSlug,
					data: input.data as CollectionData<CollectionSlug>
				});

				redirect(303, adminDocumentPath(collection.slug, document.id, base));
			}
		),

		updateDocument: form(
			updateSchema as any,
			async (input: { collection: string; data: NormalizedDocumentData; id: string }) => {
				const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);

				try {
					const document = await fieldstoneAdmin.updateDocument({
						collection: collection.slug as CollectionSlug,
						data: input.data as CollectionData<CollectionSlug>,
						id: input.id
					});

					redirect(303, adminDocumentPath(collection.slug, document.id, base));
				} catch (caught) {
					if (isDocumentNotFound(caught)) invalid('Could not find requested document');
					throw caught;
				}
			}
		),

		deleteDocument: form(deleteSchema, async (input) => {
			const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);

			try {
				await fieldstoneAdmin.deleteDocument({
					collection: collection.slug as CollectionSlug,
					id: input.id
				});

				redirect(303, adminCollectionPath(collection.slug, base));
			} catch (caught) {
				if (isDocumentNotFound(caught)) invalid('Could not find requested document');
				throw caught;
			}
		})
	};
}

export type FieldstoneAdminRemotes = ReturnType<typeof createFieldstoneAdminRemotes>;
