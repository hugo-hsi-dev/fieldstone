import config from '$fieldstone-config';
import { createFieldstoneAdminRemotes } from '@fieldstone/sveltekit/admin/remote';

export const {
	createDocument,
	deleteDocument,
	getCollection,
	getDocument,
	listCollections,
	listDocuments,
	updateDocument
} = createFieldstoneAdminRemotes({ config });
