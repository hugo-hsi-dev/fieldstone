import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';

import { requireAdminUser } from '$lib/server/cms/admin-auth';
import { stone, type CollectionName } from '$lib/server/cms/stone';

type CollectionInput = {
	collection: CollectionName;
};

type FindByIdInput = CollectionInput & {
	id: string;
};

type PostMutationInput = CollectionInput & {
	title: string;
	description: string;
};

type UpdatePostInput = PostMutationInput & {
	id: string;
};

type DeletePostInput = FindByIdInput;

function requirePosts(input: CollectionInput) {
	if (input.collection !== 'posts') error(400, 'Unsupported collection');
}

export const listPosts = query<CollectionInput, Awaited<ReturnType<typeof stone.find>>>(
	'unchecked',
	async (input) => {
		requirePosts(input);
		return stone.find(input);
	}
);

export const getPost = query<FindByIdInput, Awaited<ReturnType<typeof stone.findById>>>(
	'unchecked',
	async (input) => {
		requirePosts(input);
		return stone.findById(input);
	}
);

export const createPost = command<PostMutationInput, Awaited<ReturnType<typeof stone.createPost>>>(
	'unchecked',
	async ({ collection, ...input }) => {
		requireAdminUser(getRequestEvent());
		requirePosts({ collection });
		return stone.createPost(input);
	}
);

export const updatePost = command<UpdatePostInput, Awaited<ReturnType<typeof stone.updatePost>>>(
	'unchecked',
	async ({ collection, ...input }) => {
		requireAdminUser(getRequestEvent());
		requirePosts({ collection });
		return stone.updatePost(input);
	}
);

export const deletePost = command<DeletePostInput, Awaited<ReturnType<typeof stone.deletePost>>>(
	'unchecked',
	async ({ collection, id }) => {
		requireAdminUser(getRequestEvent());
		requirePosts({ collection });
		return stone.deletePost({ id });
	}
);
