import { getFieldstone, type CollectionRuntimeConfig } from '@fieldstone/plugin';
import config from '$fieldstone-config';

export type DocumentData = Record<string, string>;

type CollectionInput = {
	collection: string;
};

type DocumentInput = CollectionInput & {
	id: string;
};

type MutationInput = CollectionInput & {
	data: DocumentData;
};

type UpdateInput = DocumentInput & {
	data: DocumentData;
};

export async function createFieldstoneAdmin({
	config
}: {
	config: Parameters<typeof getFieldstone>[0]['config'];
}) {
	const stone = await getFieldstone({ config });

	return {
		collections: stone.collections,

		getCollection(slug: string): CollectionRuntimeConfig | null {
			return stone.getCollection(slug);
		},

		listDocuments(input: CollectionInput) {
			return stone.find(input);
		},

		getDocument(input: DocumentInput) {
			return stone.findById(input);
		},

		createDocument(input: MutationInput) {
			return stone.create(input);
		},

		updateDocument(input: UpdateInput) {
			return stone.update(input);
		},

		deleteDocument(input: DocumentInput) {
			return stone.delete(input);
		}
	};
}

export const fieldstoneAdmin = await createFieldstoneAdmin({ config });
