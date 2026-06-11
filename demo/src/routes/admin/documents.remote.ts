import { command, query } from '$app/server';
import { error } from '@sveltejs/kit';

import { stone, type DocumentData } from '$lib/server/cms/stone';

type CollectionName = string;

type CollectionInput = {
	collection: CollectionName;
};

type FindByIdInput = CollectionInput & {
	id: string;
};

type MutationInput = CollectionInput & {
	data: DocumentData;
};

type UpdateInput = MutationInput & {
	id: string;
};

function requireCollection(collection: CollectionName) {
	if (!stone.getCollection(collection)) error(400, 'Unsupported collection');
}

export const listDocuments = query<CollectionInput, Awaited<ReturnType<typeof stone.find>>>(
	'unchecked',
	async (input) => {
		requireCollection(input.collection);
		return stone.find(input);
	}
);

export const getDocument = query<FindByIdInput, Awaited<ReturnType<typeof stone.findById>>>(
	'unchecked',
	async (input) => {
		requireCollection(input.collection);
		return stone.findById(input);
	}
);

export const createDocument = command<MutationInput, Awaited<ReturnType<typeof stone.create>>>(
	'unchecked',
	async (input) => {
		requireCollection(input.collection);
		return stone.create(input);
	}
);

export const updateDocument = command<UpdateInput, Awaited<ReturnType<typeof stone.update>>>(
	'unchecked',
	async (input) => {
		requireCollection(input.collection);
		return stone.update(input);
	}
);

export const deleteDocument = command<FindByIdInput, Awaited<ReturnType<typeof stone.delete>>>(
	'unchecked',
	async (input) => {
		requireCollection(input.collection);
		return stone.delete(input);
	}
);
