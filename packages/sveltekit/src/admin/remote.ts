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

import { requireSupportedCollection } from './collections.ts';

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

export function createFieldstoneAdminRemotes({ config }: { config: FieldstoneConfig }) {
	const admin = createFieldstoneAdmin({ config });

	async function getAdminCollection(collection: string) {
		const fieldstoneAdmin = await admin;
		return {
			collection: requireSupportedCollection(fieldstoneAdmin.getCollection, collection),
			fieldstoneAdmin
		};
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
			const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);
			try {
				return {
					documents: (await fieldstoneAdmin.listDocuments({
						collection
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
			const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);
			return fieldstoneAdmin.getDocument({
				collection,
				id: input.id
			}) as Promise<CollectionDocument<CollectionSlug> | null>;
		}),

		createDocument: command(mutationSchema, async (input) => {
			const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);
			return fieldstoneAdmin.createDocument({
				collection,
				data: input.data as CollectionData<CollectionSlug>
			});
		}),

		updateDocument: command(updateSchema, async (input) => {
			const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);
			return fieldstoneAdmin.updateDocument({
				collection,
				data: input.data as CollectionData<CollectionSlug>,
				id: input.id
			});
		}),

		deleteDocument: command(findByIdSchema, async (input) => {
			const { collection, fieldstoneAdmin } = await getAdminCollection(input.collection);
			return fieldstoneAdmin.deleteDocument({
				collection,
				id: input.id
			});
		})
	};
}

export type FieldstoneAdminRemotes = ReturnType<typeof createFieldstoneAdminRemotes>;
