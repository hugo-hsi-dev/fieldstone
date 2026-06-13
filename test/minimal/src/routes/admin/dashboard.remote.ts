import config from '$fieldstone-config';
import { createFieldstoneAdminRemotes } from '@fieldstone/remotes';

export const {
	createDocument,
	deleteDocument,
	getCollection,
	getDocument,
	listCollections,
	listDocuments,
	updateDocument
} = createFieldstoneAdminRemotes({ config });
