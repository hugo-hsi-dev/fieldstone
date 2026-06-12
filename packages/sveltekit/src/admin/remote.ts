import { command, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

import { createFieldstoneAdmin } from '@fieldstone/client/admin';
import type {
	CollectionData,
	CollectionDocument,
	CollectionRuntimeConfig,
	CollectionSlug,
	FieldstoneConfig
} from '@fieldstone/core';

type AdminView =
	| {
			type: 'index';
			collections: CollectionRuntimeConfig[];
			defaultCollection: CollectionRuntimeConfig | null;
	  }
	| {
			type: 'collection';
			collection: CollectionRuntimeConfig;
			collectionName: CollectionSlug;
			collections: CollectionRuntimeConfig[];
	  };

type DocumentListResult = {
	documents: CollectionDocument<CollectionSlug>[];
	error: string | null;
};

const routeSchema = v.object({
	segments: v.array(v.string())
});

const collectionSchema = v.object({
	collection: v.string()
});

const findByIdSchema = v.object({
	collection: v.string(),
	id: v.string()
});

const mutationSchema = v.object({
	collection: v.string(),
	data: v.record(v.string(), v.string())
});

const updateSchema = v.object({
	collection: v.string(),
	id: v.string(),
	data: v.record(v.string(), v.string())
});

function parseCollectionRoute(segments: string[]) {
	if (segments.length === 0) return null;
	if (segments.length === 2 && segments[0] === 'collections') return segments[1] ?? null;
	return undefined;
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'Could not load documents';
}

export function createAdminRemotes({ config }: { config: FieldstoneConfig }) {
	const admin = createFieldstoneAdmin({ config });

	async function requireCollection(collection: string) {
		const fieldstoneAdmin = await admin;
		if (!fieldstoneAdmin.getCollection(collection)) error(404, 'Collection not found');
	}

	return {
		getAdminIndex: query(async () => {
			const fieldstoneAdmin = await admin;
			return {
				collections: fieldstoneAdmin.collections,
				defaultCollection: fieldstoneAdmin.collections[0] ?? null,
				type: 'index'
			} satisfies AdminView;
		}),

		getAdminView: query(routeSchema, async ({ segments }) => {
			const fieldstoneAdmin = await admin;
			const collectionName = parseCollectionRoute(segments);

			if (collectionName === null) {
				return {
					collections: fieldstoneAdmin.collections,
					defaultCollection: fieldstoneAdmin.collections[0] ?? null,
					type: 'index'
				} satisfies AdminView;
			}

			if (collectionName === undefined) error(404, 'Admin route not found');

			const collection = fieldstoneAdmin.getCollection(collectionName);
			if (!collection) error(404, 'Collection not found');

			return {
				collection,
				collectionName: collectionName as CollectionSlug,
				collections: fieldstoneAdmin.collections,
				type: 'collection'
			} satisfies AdminView;
		}),

		listDocuments: query(collectionSchema, async (input) => {
			await requireCollection(input.collection);
			const fieldstoneAdmin = await admin;
			try {
				return {
					documents: (await fieldstoneAdmin.listDocuments({
						collection: input.collection as CollectionSlug
					})) as CollectionDocument<CollectionSlug>[],
					error: null
				} satisfies DocumentListResult;
			} catch (error) {
				return {
					documents: [],
					error: getErrorMessage(error)
				} satisfies DocumentListResult;
			}
		}),

		getDocument: query(findByIdSchema, async (input) => {
			await requireCollection(input.collection);
			const fieldstoneAdmin = await admin;
			return fieldstoneAdmin.getDocument({
				collection: input.collection as CollectionSlug,
				id: input.id
			}) as Promise<CollectionDocument<CollectionSlug> | null>;
		}),

		createDocument: command(mutationSchema, async (input) => {
			await requireCollection(input.collection);
			const fieldstoneAdmin = await admin;
			return fieldstoneAdmin.createDocument({
				collection: input.collection as CollectionSlug,
				data: input.data as CollectionData<CollectionSlug>
			});
		}),

		updateDocument: command(updateSchema, async (input) => {
			await requireCollection(input.collection);
			const fieldstoneAdmin = await admin;
			return fieldstoneAdmin.updateDocument({
				collection: input.collection as CollectionSlug,
				data: input.data as CollectionData<CollectionSlug>,
				id: input.id
			});
		}),

		deleteDocument: command(findByIdSchema, async (input) => {
			await requireCollection(input.collection);
			const fieldstoneAdmin = await admin;
			return fieldstoneAdmin.deleteDocument({
				collection: input.collection as CollectionSlug,
				id: input.id
			});
		})
	};
}

export type AdminRemotes = ReturnType<typeof createAdminRemotes>;
