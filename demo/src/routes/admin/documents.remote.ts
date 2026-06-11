import { command, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

import { fieldstoneAdmin, type DocumentData } from '$lib/server/admin/fieldstone-admin';

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

function requireCollection(collection: CollectionName) {
	if (!fieldstoneAdmin.getCollection(collection)) error(400, 'Unsupported collection');
}

export const listDocuments = query(collectionSchema, async (input) => {
	requireCollection(input.collection);
	return fieldstoneAdmin.listDocuments(input);
});

export const getDocument = query(findByIdSchema, async (input) => {
	requireCollection(input.collection);
	return fieldstoneAdmin.getDocument(input);
});

export const createDocument = command(mutationSchema, async (input) => {
	requireCollection(input.collection);
	return fieldstoneAdmin.createDocument(input);
});

export const updateDocument = command(updateSchema, async (input) => {
	requireCollection(input.collection);
	return fieldstoneAdmin.updateDocument(input);
});

export const deleteDocument = command(findByIdSchema, async (input) => {
	requireCollection(input.collection);
	return fieldstoneAdmin.deleteDocument(input);
});
